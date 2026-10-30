import { accountTextParams, accountTextOptions } from './account-text.js';
import { markupEntities, markupText } from './account-markup.js';
import { mtprotoTextParams } from './formatting.js';

/** Validate every caption before an upload can consume caller-owned sources. */
async function captionText(caption, options, resolve) {
  options.signal?.throwIfAborted();
  const formatted = typeof caption?.text === 'string';
  const entities = formatted
    ? (caption.entities ?? [])
    : (options.formattingEntities ?? options.entities);
  if (
    entities !== undefined &&
    (!Array.isArray(entities) || entities.length > 1000)
  ) {
    throw new RangeError('Account parser entity limit exceeded');
  }
  const initial = mtprotoTextParams({ message: caption ?? '', entities });
  markupText(initial.message);
  if (initial.entities !== undefined) {
    initial.entities = markupEntities(initial.message, initial.entities);
  }
  const result = await accountTextParams(
    initial.message,
    {
      ...options,
      formattingEntities: undefined,
      entities: initial.entities,
    },
    resolve
  );
  return {
    ...result,
    entities: markupEntities(result.message, result.entities ?? []),
  };
}

export function fileCaption(caption, options, resolve) {
  return captionText(
    Array.isArray(caption) ? caption[0] : caption,
    options,
    resolve
  );
}

function captionSettings(entry, index, options) {
  const inherited =
    index === 0
      ? options
      : {
          ...options,
          formattingEntities: undefined,
          entities: undefined,
        };
  const settings = {
    ...inherited,
    ...entry,
    parseMode: entry.parseMode ?? inherited.parseMode,
  };
  if (entry.entities !== undefined && entry.formattingEntities === undefined) {
    settings.formattingEntities = undefined;
  }
  return settings;
}

export async function albumCaptions(files, caption, options, resolve) {
  if (Array.isArray(caption) && caption.length > 10) {
    throw new RangeError('An album accepts at most 10 captions');
  }
  const result = [];
  for (const [index, file] of files.entries()) {
    options.signal?.throwIfAborted();
    const entry = file?.file !== undefined ? file : { file };
    const settings = captionSettings(entry, index, options);
    const text =
      entry.caption ??
      (Array.isArray(caption)
        ? (caption[index] ?? '')
        : index === 0
          ? caption
          : '');
    const content = await captionText(text, settings, resolve);
    result.push({
      settings: accountTextOptions(settings),
      content,
      randomId: entry.randomId,
    });
  }
  options.signal?.throwIfAborted();
  return result;
}
