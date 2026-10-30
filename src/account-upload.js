/** SDK-compatible file metadata without requiring an installed vendor client. */
export class CustomFile {
  constructor(name, size, path, buffer) {
    if (
      typeof name !== 'string' ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      typeof path !== 'string'
    ) {
      throw new TypeError('CustomFile requires a name, finite size and path');
    }
    if (
      buffer !== undefined &&
      (!(buffer instanceof Uint8Array) || buffer.byteLength !== size)
    ) {
      throw new RangeError('CustomFile buffer must match its declared size');
    }
    if (!path && buffer === undefined) {
      throw new TypeError('CustomFile requires a path or byte buffer');
    }
    Object.assign(this, { name, size, path, buffer });
  }
}

/** Keep SDK fractional onProgress separate from canonical byte progress. */
export function uploadArguments(file, options = {}) {
  if (!file || typeof file !== 'object' || !Object.hasOwn(file, 'file')) {
    return { file, options };
  }
  const { file: source, onProgress, ...settings } = { ...file, ...options };
  return {
    file: source,
    options: {
      ...settings,
      progressCallback: onProgress ?? settings.progressCallback,
    },
  };
}
