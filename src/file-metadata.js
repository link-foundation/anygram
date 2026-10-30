import fileTypes from './schema/file-types.json' with { type: 'json' };

/** Shared filename facts for raw TL casts and high-level file preparation. */
export function fileMetadata(file, options = {}) {
  let name =
    options.filename ??
    (typeof file === 'string' ? file : (file?.filename ?? file?.name)) ??
    'unnamed';
  if (typeof name !== 'string') {
    throw new TypeError('Media filename must be a string');
  }
  if (/^https?:\/\//i.test(name)) {
    name = new globalThis.URL(name).pathname;
  }
  const basename = name.split(/[\\/]/).at(-1) || 'unnamed';
  const extension = basename.split('.').at(-1).toLowerCase();
  const mimeType = Object.hasOwn(fileTypes, extension)
    ? fileTypes[extension]
    : 'application/octet-stream';
  return {
    name: basename,
    mimeType,
    image: ['png', 'jpg', 'jpeg'].includes(extension),
  };
}

export function documentMetadata(file, options = {}) {
  const facts = fileMetadata(file, options);
  const attributes = new Map([
    [
      'documentAttributeFilename',
      {
        _: 'documentAttributeFilename',
        file_name: facts.name,
      },
    ],
  ]);
  if (facts.mimeType.startsWith('audio/') || options.voiceNote) {
    attributes.set('documentAttributeAudio', {
      _: 'documentAttributeAudio',
      duration: 0,
      ...(options.voiceNote ? { voice: true } : {}),
    });
  }
  if (
    (!options.forceDocument && facts.mimeType.startsWith('video/')) ||
    options.videoNote
  ) {
    attributes.set('documentAttributeVideo', {
      _: 'documentAttributeVideo',
      duration: 0,
      w: 1,
      h: 1,
      ...(options.videoNote ? { round_message: true } : {}),
      ...(options.supportsStreaming ? { supports_streaming: true } : {}),
    });
  }
  for (const attribute of options.attributes ?? []) {
    attributes.set(attribute._, attribute);
  }
  return {
    mime_type: options.mimeType ?? facts.mimeType,
    attributes: [...attributes.values()],
  };
}
