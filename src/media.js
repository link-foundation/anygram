import { TelegramError, UnsupportedError } from './errors.js';
import { randomId } from './random.js';
import { joinBytes } from './bytes.js';
import { PART_SIZE, withFileSource, uploadSource } from './file-source.js';
import { accountTextOptions, accountSendOptions } from './account-text.js';
import { fileCaption, albumCaptions } from './media-text.js';
import { canonicalValue, schemaDefinition } from './requests.js';
import { castInputMedia } from './tl-media.js';
import {
  uploadEncryptedFile,
  downloadEncryptedFile,
  iterDownloadEncryptedFile,
} from './secret-files.js';

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

function fileOf(media) {
  media = media.media ?? media;
  return media.document ?? media.photo ?? media;
}

function advertisedSize(file, size) {
  return size === undefined && file._ === 'document' && file.size !== undefined
    ? Number(file.size)
    : size;
}

function mediaValue(file) {
  const definition = schemaDefinition(file?._ ?? file?.className);
  if (definition && definition.type !== 'InputFile') {
    return {
      media: castInputMedia(
        canonicalValue(file, { copyBytes: true }),
        'InputMedia'
      ),
    };
  }
  return { file: definition ? canonicalValue(file) : file };
}

function locationOf(media) {
  media = fileOf(media);
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
  originRefresh(media, options) {
    if (!media.peer_id || !media.id) {
      return undefined;
    }
    return async (location) => {
      const messages = await this.getMessages(media.peer_id, {
        ...options,
        ids: [media.id],
      });
      const fresh = messages.find((message) => message.id === media.id);
      if (!fresh?.media || fileOf(fresh).id !== location.id) {
        throw new TelegramError(
          'The original message no longer contains this file',
          {
            type: 'FILE_REFERENCE_CHANGED',
          }
        );
      }
      return fresh;
    };
  }

  uploadFile(file, options = {}) {
    return withFileSource(file, options, (source, settings) =>
      uploadSource(this.rpc.bind(this), source, settings)
    );
  }

  uploadEncryptedFile(file, options) {
    return uploadEncryptedFile(this.rpc.bind(this), file, options);
  }

  downloadEncryptedFile(file, options) {
    return downloadEncryptedFile(this.rpc.bind(this), file, options);
  }

  iterDownloadEncryptedFile(file, options) {
    return iterDownloadEncryptedFile(this.rpc.bind(this), file, options);
  }

  async prepareMedia({
    file,
    forceDocument = true,
    mimeType = 'application/octet-stream',
    attributes,
    ...options
  }) {
    const known = mediaValue(file);
    if (known.media) {
      return known.media;
    }
    file = known.file;
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
    return media;
  }

  async sendFile(peer, { file, caption = '', ...options }) {
    if (Array.isArray(file)) {
      return this.sendAlbum(peer, file, { ...options, caption });
    }
    const content = await fileCaption(caption, options, (user) =>
      this.resolvePeer(user, options)
    );
    const input = await this.resolvePeer(peer, options);
    const media = await this.prepareMedia({
      file,
      ...accountTextOptions(options),
    });
    return this.rpc(
      'messages.sendMedia',
      {
        ...accountSendOptions(options, 'messages.sendMedia'),
        ...content,
        peer: input,
        media,
        random_id: options.randomId ?? randomId(),
      },
      options
    );
  }

  async reusableMedia(peer, media, options) {
    if (['inputMediaPhoto', 'inputMediaDocument'].includes(media._)) {
      return media;
    }
    const result = await this.rpc(
      'messages.uploadMedia',
      { peer, media },
      options
    );
    const value = result.photo ?? result.document;
    if (!['photo', 'document'].includes(value?._)) {
      throw new TelegramError('Telegram did not return reusable album media');
    }
    const type = value._ === 'photo' ? 'Photo' : 'Document';
    return {
      _: `inputMedia${type}`,
      id: {
        _: `input${type}`,
        id: value.id,
        access_hash: value.access_hash,
        file_reference: value.file_reference,
      },
    };
  }

  async sendAlbum(peer, files, { caption = '', ...options } = {}) {
    if (!Array.isArray(files) || files.length < 2 || files.length > 10) {
      throw new RangeError('An album requires 2 to 10 items');
    }
    const captions = await albumCaptions(files, caption, options, (user) =>
      this.resolvePeer(user, options)
    );
    const input = await this.resolvePeer(peer, options);
    const multi_media = [];
    for (const { settings, content, randomId: itemRandomId } of captions) {
      options.signal?.throwIfAborted();
      const media = await this.reusableMedia(
        input,
        await this.prepareMedia(settings),
        options
      );
      multi_media.push({
        _: 'inputSingleMedia',
        media,
        ...content,
        random_id: itemRandomId ?? randomId(),
      });
    }
    return this.rpc(
      'messages.sendMultiMedia',
      {
        ...accountSendOptions(options, 'messages.sendMultiMedia'),
        peer: input,
        multi_media,
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
    const file = fileOf(media);
    size = advertisedSize(file, size);
    const end = downloadEnd({ offset, size, maxBytes });
    options = { dc: file.dc_id, ...options };
    refreshFileReference ??= this.originRefresh(media, options);
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
    return joinBytes(chunks, length);
  }
}
