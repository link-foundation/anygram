import { createHash } from 'node:crypto';
import { TelegramError, UnsupportedError } from './errors.js';

const PART_SIZE = 512 * 1024;
function validatePartSize(size) {
  if (
    !Number.isInteger(size) ||
    size < 1024 ||
    PART_SIZE % size ||
    size % 1024
  ) {
    throw new RangeError(
      'Upload part size must divide 512 KiB and be a multiple of 1 KiB'
    );
  }
}

function uploadParts(size, partSize, maxParts) {
  const parts = Math.ceil(size / partSize);
  if (
    !Number.isSafeInteger(size) ||
    parts < 1 ||
    !Number.isInteger(maxParts) ||
    maxParts < 1 ||
    parts > maxParts
  ) {
    throw new RangeError(
      'Upload exceeds the configured part limit or is empty'
    );
  }
  return parts;
}

function downloadEnd({ offset, size, maxBytes }) {
  if (
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset % 4096 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0
  ) {
    throw new RangeError('Invalid download offset or byte limit');
  }
  if (
    size !== undefined &&
    (!Number.isSafeInteger(size) || size < 0 || size > maxBytes)
  ) {
    throw new RangeError('Download exceeds configured byte limit');
  }
  return size ?? maxBytes;
}

async function sourceOf(file) {
  if (file?.data instanceof Uint8Array) {
    const result = await sourceOf(file.data);
    return { ...result, name: file.filename ?? file.name ?? result.name };
  }
  if (file instanceof Uint8Array) {
    return {
      size: file.length,
      name: 'file',
      read: (offset, length) => file.subarray(offset, offset + length),
    };
  }
  if (file instanceof globalThis.Blob) {
    return {
      size: file.size,
      name: file.name ?? 'file',
      read: async (offset, length) =>
        new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
    };
  }
  if (typeof file === 'string') {
    const { open } = await import('node:fs/promises');
    const handle = await open(file, 'r');
    try {
      const { size } = await handle.stat();
      return {
        size,
        name: file.split(/[\\/]/).at(-1),
        read: async (offset, length) => {
          const buffer = Buffer.alloc(length);
          let bytesRead = 0;
          while (bytesRead < length) {
            const chunk = await handle.read(
              buffer,
              bytesRead,
              length - bytesRead,
              offset + bytesRead
            );
            if (!chunk.bytesRead) {
              throw new Error('Upload file changed or ended unexpectedly');
            }
            bytesRead += chunk.bytesRead;
          }
          return buffer;
        },
        close: () => handle.close(),
      };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
  throw new TypeError(
    'Upload requires bytes, a Blob, a local path or an InputFile'
  );
}

function locationOf(media) {
  media = media.media ?? media;
  media = media.document ?? media.photo ?? media;
  if (media._?.startsWith('input') && media._.endsWith('FileLocation')) {
    return media;
  }
  const common = {
    id: media.id,
    access_hash: media.access_hash,
    file_reference: media.file_reference,
  };
  if (media._ === 'document') {
    return { _: 'inputDocumentFileLocation', ...common, thumb_size: '' };
  }
  if (media._ === 'photo') {
    const size = media.sizes
      ?.filter(
        (entry) =>
          entry._ !== 'photoStrippedSize' && entry._ !== 'photoPathSize'
      )
      .at(-1);
    if (!size) {
      throw new TypeError('Photo has no downloadable size');
    }
    return { _: 'inputPhotoFileLocation', ...common, thumb_size: size.type };
  }
  throw new TypeError(
    'Download requires a document, photo or InputFileLocation'
  );
}

/** File operations shared by adapters with only raw MTProto support. */
export class MediaOperations {
  async uploadFile(
    file,
    {
      partSize = PART_SIZE,
      maxParts = 4000,
      filename,
      onProgress,
      ...options
    } = {}
  ) {
    validatePartSize(partSize);
    const source = await sourceOf(file);
    try {
      const parts = uploadParts(source.size, partSize, maxParts);
      const id = new DataView(
        globalThis.crypto.getRandomValues(new Uint8Array(8)).buffer
      ).getBigInt64(0, true);
      const big = source.size > 10 * 1024 * 1024;
      const checksum = createHash('md5');
      for (let part = 0; part < parts; part++) {
        options.signal?.throwIfAborted();
        const bytes = await source.read(
          part * partSize,
          Math.min(partSize, source.size - part * partSize)
        );
        const saved = await this.rpc(
          big ? 'upload.saveBigFilePart' : 'upload.saveFilePart',
          {
            file_id: id,
            file_part: part,
            ...(big ? { file_total_parts: parts } : {}),
            bytes,
          },
          options
        );
        if (saved !== true) {
          throw new TelegramError('Telegram did not save file part');
        }
        if (!big) {
          checksum.update(bytes);
        }
        await onProgress?.(
          Math.min((part + 1) * partSize, source.size),
          source.size
        );
      }
      return {
        _: big ? 'inputFileBig' : 'inputFile',
        id,
        parts,
        name: filename ?? source.name,
        ...(!big ? { md5_checksum: checksum.digest('hex') } : {}),
      };
    } finally {
      await source.close?.();
    }
  }

  async sendFile(
    peer,
    {
      file,
      caption = '',
      forceDocument = true,
      mimeType = 'application/octet-stream',
      attributes,
      ...options
    }
  ) {
    let media;
    if (typeof file === 'string' && /^https?:\/\//.test(file)) {
      media = {
        _: forceDocument
          ? 'inputMediaDocumentExternal'
          : 'inputMediaPhotoExternal',
        url: file,
      };
    } else {
      const input = ['inputFile', 'inputFileBig'].includes(file?._)
        ? file
        : await this.uploadFile(file, options);
      media = forceDocument
        ? {
            _: 'inputMediaUploadedDocument',
            file: input,
            mime_type: mimeType,
            attributes: attributes ?? [
              { _: 'documentAttributeFilename', file_name: input.name },
            ],
          }
        : { _: 'inputMediaUploadedPhoto', file: input };
    }
    const random = new DataView(
      globalThis.crypto.getRandomValues(new Uint8Array(8)).buffer
    ).getBigInt64(0, true);
    return this.rpc(
      'messages.sendMedia',
      {
        ...options,
        peer: await this.resolvePeer(peer),
        media,
        message: caption,
        random_id: options.randomId ?? random,
      },
      options
    );
  }

  async *iterDownload(
    media,
    {
      offset = 0,
      size,
      maxBytes = 512 * 1024 * 1024,
      refreshFileReference,
      onProgress,
      ...options
    } = {}
  ) {
    const end = downloadEnd({ offset, size, maxBytes });
    let location = locationOf(media);
    for (let position = offset; position < end; position += PART_SIZE) {
      options.signal?.throwIfAborted();
      const result = await this.getFileChunk(
        location,
        position,
        options,
        refreshFileReference
      );
      location = result.location;
      const bytes = result.value.bytes;
      if (!(bytes instanceof Uint8Array) || bytes.length > PART_SIZE) {
        throw new TelegramError('Invalid download chunk');
      }
      const chunk = bytes.subarray(0, end - position);
      if (chunk.length) {
        yield chunk;
      }
      await onProgress?.(position + chunk.length, size);
      if (bytes.length < PART_SIZE) {
        if (size !== undefined && position + bytes.length < end) {
          throw new TelegramError('Download ended before the advertised size', {
            type: 'TRUNCATED_FILE',
          });
        }
        return;
      }
    }
    if (size === undefined) {
      throw new RangeError('Download exceeds configured byte limit');
    }
  }

  async getFileChunk(location, offset, options, refresh) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const value = await this.rpc(
          'upload.getFile',
          {
            location,
            offset: BigInt(offset),
            limit: PART_SIZE,
            cdn_supported: false,
          },
          options
        );
        if (value._ === 'upload.fileCdnRedirect') {
          throw new UnsupportedError(
            'Unexpected CDN redirect with cdn_supported disabled'
          );
        }
        return { value, location };
      } catch (error) {
        if (
          !refresh ||
          attempt ||
          !/FILE_REFERENCE_(?:EXPIRED|\d+_EXPIRED|EMPTY)/.test(
            error.type ?? error.message
          )
        ) {
          throw error;
        }
        location = locationOf(await refresh(location));
      }
    }
  }

  async downloadMedia(media, options = {}) {
    const maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    const chunks = [];
    let length = 0;
    for await (const chunk of this.iterDownload(media, {
      ...options,
      maxBytes,
    })) {
      chunks.push(chunk);
      length += chunk.length;
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    return bytes;
  }
}
