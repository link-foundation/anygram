import { requestLimits, schemaDefinition } from './requests.js';

const object = (_, fields = {}) => ({ _, ...fields });
const union = (value) => schemaDefinition(value?._)?.type;
const failure = (type) => {
  throw new TypeError(`Cannot resolve value as ${type}`);
};

export const mediaInputTypes = new Set([
  'InputPhoto',
  'InputDocument',
  'InputChatPhoto',
  'InputMedia',
]);

/** Convert already-canonical TL data, without uploading or resolving peers. */
export function castInputMedia(value, type, depth = 0) {
  if (depth > requestLimits.maxDepth) {
    throw new RangeError('TL depth limit exceeded');
  }
  if (!value || typeof value !== 'object') {
    return failure(type);
  }
  if (union(value) === type) {
    return value;
  }
  const next = (input, target = type) =>
    castInputMedia(input, target, depth + 1);
  const cast = {
    InputPhoto: photo,
    InputDocument: document,
    InputChatPhoto: chatPhoto,
    InputMedia: media,
  }[type];
  return cast?.(value, next) ?? failure(type);
}

function reference(value, type) {
  if (
    value.id === undefined ||
    value.access_hash === undefined ||
    !(value.file_reference instanceof Uint8Array)
  ) {
    return failure(type);
  }
  return object(type, {
    id: value.id,
    access_hash: value.access_hash,
    file_reference: value.file_reference,
  });
}

function photo(value, next) {
  if (value._ === 'photo') {
    return reference(value, 'inputPhoto');
  }
  if (
    [
      'photoEmpty',
      'userEmpty',
      'chatEmpty',
      'chatForbidden',
      'channelForbidden',
    ].includes(value._)
  ) {
    return object('inputPhotoEmpty');
  }
  const field = {
    message: 'media',
    'photos.photo': 'photo',
    messageMediaPhoto: 'photo',
    'messages.chatFull': 'full_chat',
    channelFull: 'chat_photo',
    userFull: 'profile_photo',
    channel: 'photo',
    chat: 'photo',
    user: 'photo',
  }[value._];
  return field && next(value[field]);
}

function document(value, next) {
  if (value._ === 'document') {
    return reference(value, 'inputDocument');
  }
  if (value._ === 'documentEmpty') {
    return object('inputDocumentEmpty');
  }
  if (value._ === 'messageMediaDocument') {
    return next(value.document);
  }
  return value._ === 'message' ? next(value.media) : undefined;
}

function chatPhoto(value, next) {
  if (union(value) === 'InputFile') {
    return object('inputChatUploadedPhoto', { file: value });
  }
  const input = next(value, 'InputPhoto');
  return input._ === 'inputPhotoEmpty'
    ? object('inputChatPhotoEmpty')
    : object('inputChatPhoto', { id: input });
}

function media(value, next) {
  const type = union(value);
  if (type === 'InputPhoto' || type === 'Photo' || value._ === 'photos.photo') {
    return object('inputMediaPhoto', { id: next(value, 'InputPhoto') });
  }
  if (type === 'InputDocument' || type === 'Document') {
    return object('inputMediaDocument', { id: next(value, 'InputDocument') });
  }
  if (type === 'InputFile') {
    return uploadedDocument(value);
  }
  if (value._ === 'messageMediaPhoto' || value._ === 'messageMediaDocument') {
    const isPhoto = value._ === 'messageMediaPhoto';
    return object(isPhoto ? 'inputMediaPhoto' : 'inputMediaDocument', {
      id: next(
        value[isPhoto ? 'photo' : 'document'],
        isPhoto ? 'InputPhoto' : 'InputDocument'
      ),
      ttl_seconds: value.ttl_seconds,
    });
  }
  return otherMedia(value, next);
}

function geo(value) {
  if (union(value) === 'InputGeoPoint') {
    return value;
  }
  if (value?._ === 'geoPoint') {
    return object('inputGeoPoint', { lat: value.lat, long: value.long });
  }
  return value?._ === 'geoPointEmpty'
    ? object('inputGeoPointEmpty')
    : failure('InputGeoPoint');
}

function otherMedia(value, next) {
  const converters = {
    messageMediaContact: () =>
      object('inputMediaContact', {
        phone_number: value.phone_number,
        first_name: value.first_name,
        last_name: value.last_name,
        vcard: '',
      }),
    messageMediaGeo: () =>
      object('inputMediaGeoPoint', { geo_point: geo(value.geo) }),
    messageMediaVenue: () =>
      object('inputMediaVenue', {
        geo_point: geo(value.geo),
        title: value.title,
        address: value.address,
        provider: value.provider,
        venue_id: value.venue_id,
        venue_type: '',
      }),
    messageMediaDice: () =>
      object('inputMediaDice', { emoticon: value.emoticon }),
    messageMediaGame: () =>
      object('inputMediaGame', {
        id: object('inputGameID', {
          id: value.game?.id,
          access_hash: value.game?.access_hash,
        }),
      }),
    message: () => next(value.media),
    poll: () => object('inputMediaPoll', { poll: value }),
    messageMediaPoll: () => pollMedia(value, next),
  };
  const simple = Object.hasOwn(converters, value._) && converters[value._];
  if (simple) {
    return simple();
  }
  if (
    [
      'messageMediaEmpty',
      'messageMediaUnsupported',
      'chatPhotoEmpty',
      'userProfilePhotoEmpty',
      'chatPhoto',
      'userProfilePhoto',
    ].includes(value._)
  ) {
    return object('inputMediaEmpty');
  }
  return failure('InputMedia');
}

function pollMedia(value, next) {
  const { poll, results } = value;
  if (!poll || !results) {
    return failure('InputMediaPoll');
  }
  return object('inputMediaPoll', {
    poll,
    correct_answers: poll.quiz ? correctAnswers(poll, results) : undefined,
    solution: results.solution,
    solution_entities: results.solution_entities,
    attached_media: value.attached_media && next(value.attached_media),
    solution_media: results.solution_media && next(results.solution_media),
  });
}

function correctAnswers(poll, results) {
  if (!Array.isArray(results.results) || !Array.isArray(poll.answers)) {
    throw new TypeError('Cannot resolve an unanswered quiz as InputMedia');
  }
  const indices = new Map();
  for (const [index, answer] of poll.answers.entries()) {
    if (!(answer.option instanceof Uint8Array)) {
      return failure('quiz answer');
    }
    const key = Buffer.from(answer.option).toString('hex');
    if (indices.has(key)) {
      throw new TypeError('Ambiguous duplicate quiz option');
    }
    indices.set(key, index);
  }
  const correct = new Set();
  for (const result of results.results) {
    if (!result.correct) {
      continue;
    }
    const index =
      result.option instanceof Uint8Array
        ? indices.get(Buffer.from(result.option).toString('hex'))
        : undefined;
    if (index === undefined) {
      throw new TypeError('Unknown correct quiz option');
    }
    correct.add(index);
  }
  return [...correct];
}

function uploadedDocument(file) {
  const name = file.name || 'unnamed';
  const extension = name.split('.').at(-1).toLowerCase();
  const mime = Object.hasOwn(fileTypes, extension)
    ? fileTypes[extension]
    : 'application/octet-stream';
  const attributes = [
    object('documentAttributeFilename', {
      file_name: name.split(/[\\/]/).at(-1),
    }),
  ];
  if (mime.startsWith('audio/')) {
    attributes.push(object('documentAttributeAudio', { duration: 0 }));
  }
  if (mime.startsWith('video/')) {
    attributes.push(
      object('documentAttributeVideo', { duration: 0, w: 1, h: 1 })
    );
  }
  return object('inputMediaUploadedDocument', {
    file,
    mime_type: mime,
    attributes,
  });
}

// Common registered media types; an explicit InputMedia retains caller metadata.
const fileTypes = {
  txt: 'text/plain',
  csv: 'text/csv',
  html: 'text/html',
  css: 'text/css',
  json: 'application/json',
  pdf: 'application/pdf',
  zip: 'application/zip',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  m4v: 'video/x-m4v',
  mov: 'video/quicktime',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
};
