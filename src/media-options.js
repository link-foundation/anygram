import { canonicalValue, schemaDefinition } from './requests.js';
import { castInputMedia } from './tl-media.js';
import { fileMetadata, documentMetadata } from './file-metadata.js';
import { validateUploadOptions, validateUploadSource } from './file-source.js';
import { TlCodec } from './tl.js';

const metadataCodec = new TlCodec({ maxBytes: 256 * 1024, maxVector: 1000 });

function checkedMetadata(value) {
  try {
    metadataCodec.encode(value);
  } catch (cause) {
    throw new TypeError('Invalid media attribute or reference', { cause });
  }
  return value;
}

function canonicalMetadata(value, type) {
  const input = canonicalValue(value, { maxVector: 1000 });
  const result = type ? castInputMedia(input, type) : input;
  checkedMetadata(result);
  return canonicalValue(result, { copyBytes: true, maxVector: 1000 });
}

const booleans = [
  'forceDocument',
  'asImage',
  'voiceNote',
  'videoNote',
  'supportsStreaming',
  'spoiler',
  'nosoundVideo',
  'forceFile',
  'livePhoto',
];
const flagNames = {
  spoiler: 'spoiler',
  ttlSeconds: 'ttl_seconds',
  nosoundVideo: 'nosound_video',
  forceFile: 'force_file',
  videoTimestamp: 'video_timestamp',
  livePhoto: 'live_photo',
};

function mediaAttributes(attributes) {
  if (attributes === undefined) {
    return undefined;
  }
  if (!Array.isArray(attributes) || attributes.length > 1000) {
    throw new RangeError('Media attribute limit exceeded');
  }
  return attributes.map((attribute) => {
    const result = canonicalMetadata(attribute);
    if (schemaDefinition(result?._)?.type !== 'DocumentAttribute') {
      throw new TypeError('Media requires DocumentAttribute values');
    }
    return result;
  });
}

function mediaReferences(options) {
  const result = {};
  for (const [option, field, type] of [
    ['videoCover', 'video_cover', 'InputPhoto'],
    ['video', 'video', 'InputDocument'],
  ]) {
    if (options[option] !== undefined) {
      result[field] = canonicalMetadata(options[option], type);
    }
  }
  if (options.stickers !== undefined) {
    if (!Array.isArray(options.stickers) || options.stickers.length > 1000) {
      throw new RangeError('Media sticker limit exceeded');
    }
    result.stickers = options.stickers.map((value) =>
      canonicalMetadata(value, 'InputDocument')
    );
  }
  return result;
}

function validateThumbnail(thumb) {
  if (thumb !== undefined) {
    const type = schemaDefinition(thumb?._ ?? thumb?.className)?.type;
    if (type && type !== 'InputFile') {
      throw new TypeError('Media thumbnail requires InputFile');
    }
    if (type) {
      checkedMetadata(canonicalValue(thumb));
    } else {
      validateUploadSource(thumb);
    }
  }
}

function validateMediaNumbers(options) {
  for (const key of ['ttlSeconds', 'videoTimestamp']) {
    const value = options[key];
    if (
      value !== undefined &&
      (!Number.isInteger(value) || value < 0 || value > 2147483647)
    ) {
      throw new RangeError(
        `Media ${key} must be a nonnegative signed 32-bit integer`
      );
    }
  }
}

function validatedOptions(options) {
  validateUploadOptions(options);
  validateThumbnail(options.thumb);
  validateMediaNumbers(options);
  for (const key of booleans) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new TypeError(`Media ${key} must be a boolean`);
    }
  }
  if (
    options.mimeType !== undefined &&
    (typeof options.mimeType !== 'string' ||
      !options.mimeType ||
      options.mimeType.length > 255)
  ) {
    throw new TypeError(
      'Media MIME type must be a nonempty string of at most 255 characters'
    );
  }
  return { ...options, attributes: mediaAttributes(options.attributes) };
}

function mediaAliases(options) {
  const result = { ...options };
  for (const [option, field] of [
    ...Object.entries(flagNames),
    ['videoCover', 'video_cover'],
  ]) {
    if (result[option] === undefined && result[field] !== undefined) {
      result[option] = result[field];
    }
  }
  return result;
}

function withMediaFlags(media, options, references) {
  const allowed = new Set(
    schemaDefinition(media._)?.params.map(({ name }) => name)
  );
  const result = { ...media };
  for (const [option, field] of Object.entries(flagNames)) {
    if (options[option] !== undefined && allowed.has(field)) {
      result[field] = options[option];
    }
  }
  for (const [field, value] of Object.entries(references)) {
    if (allowed.has(field)) {
      result[field] = value;
    }
  }
  if (
    allowed.has('live_photo') &&
    ((result.live_photo === true && !result.video) ||
      (result.live_photo === false && result.video))
  ) {
    throw new TypeError('Live-photo flags require a matching video reference');
  }
  return result;
}

function uploadedMedia(file, options) {
  if (schemaDefinition(file?._)?.type === 'InputFile') {
    checkedMetadata(file);
  } else {
    validateUploadSource(file, options);
  }
  const facts = fileMetadata(file, options);
  const image = options.asImage ?? (facts.image && !options.forceDocument);
  const external = typeof file === 'string' && /^https?:\/\//i.test(file);
  const type = `inputMedia${image ? 'Photo' : 'Document'}External`;
  return external
    ? { _: type, url: file }
    : image
      ? {
          _: 'inputMediaUploadedPhoto',
        }
      : {
          _: 'inputMediaUploadedDocument',
          ...documentMetadata(file, {
            ...options,
            forceDocument: options.forceDocument && !facts.image,
          }),
          ...(options.forceDocument && !facts.image
            ? { force_file: true }
            : {}),
        };
}

/** Pure preflight: never reads an upload source or performs an RPC. */
export function mediaSettings(options) {
  options = validatedOptions(mediaAliases(options));
  const references = mediaReferences(options);
  const definition = schemaDefinition(
    options.file?._ ?? options.file?.className
  );
  const file = definition
    ? canonicalValue(options.file, { copyBytes: true })
    : options.file;
  const media =
    definition && definition.type !== 'InputFile'
      ? castInputMedia(file, 'InputMedia')
      : uploadedMedia(file, options);
  return {
    ...options,
    file,
    media: withMediaFlags(media, options, references),
  };
}

export function reusableMediaFlags(media) {
  return Object.fromEntries(
    [
      'spoiler',
      'ttl_seconds',
      'video_cover',
      'video_timestamp',
      'live_photo',
      'video',
    ]
      .filter((key) => media[key] !== undefined)
      .map((key) => [key, media[key]])
  );
}
