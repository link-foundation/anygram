import { canonicalValue, schemaDefinition } from './requests.js';

const maxText = 4 * 1024 * 1024;

export function accountParseMode(mode) {
  if (mode === undefined || mode === null || mode === false) {
    return undefined;
  }
  if (
    typeof mode?.parse !== 'function' ||
    typeof mode?.unparse !== 'function'
  ) {
    throw new TypeError(
      'Account parse modes require parse and unparse methods'
    );
  }
  return mode;
}

function textSize(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Account parser text must be a string');
  }
  if (text.length > maxText) {
    throw new RangeError('Account parser text limit exceeded');
  }
  return text;
}

function checkedEntities(text, entities) {
  if (!Array.isArray(entities)) {
    throw new TypeError('Account parser entities must be an array');
  }
  if (entities.length > 1000) {
    throw new RangeError('Account parser entity limit exceeded');
  }
  const result = canonicalValue(entities);
  for (const entity of result) {
    if (
      schemaDefinition(entity?._)?.type !== 'MessageEntity' ||
      !Number.isSafeInteger(entity.offset) ||
      !Number.isSafeInteger(entity.length) ||
      entity.offset < 0 ||
      entity.length < 0 ||
      entity.offset + entity.length > text.length
    ) {
      throw new RangeError('Account parser entity exceeds text bounds');
    }
  }
  return result;
}

/** Custom parsers run before TL normalization can discard their methods. */
export function readAccountText(text, mode) {
  textSize(text);
  const parser = accountParseMode(mode);
  if (!parser) {
    return { message: text, entities: [] };
  }
  const result = parser.parse(text);
  if (!Array.isArray(result) || result.length !== 2) {
    throw new TypeError('Account parsers must return a text/entity pair');
  }
  const message = textSize(result[0]);
  return { message, entities: checkedEntities(message, result[1]) };
}

export function writeAccountText(text, entities, mode) {
  const parser = accountParseMode(mode);
  return parser ? textSize(parser.unparse(textSize(text), entities)) : text;
}

/** Parser callbacks and SDK-only aliases never become TL request fields. */
export function accountTextOptions(options) {
  return Object.fromEntries(
    Object.entries(options).filter(
      ([key]) => !['parseMode', 'formattingEntities'].includes(key)
    )
  );
}

const mentionUsers = {
  inputPeerUser: 'inputUser',
  inputPeerSelf: 'inputUserSelf',
  inputPeerUserFromMessage: 'inputUserFromMessage',
};

function mentionTarget(entity) {
  if (entity._ === 'messageEntityMentionName') {
    return entity.user_id;
  }
  if (entity._ !== 'messageEntityTextUrl') {
    return undefined;
  }
  const id = /^tg:\/\/user\?id=(\d+)$/.exec(entity.url);
  return id ? BigInt(id[1]) : /^[@+]/.test(entity.url) ? entity.url : undefined;
}

export async function accountTextParams(text, options, resolve) {
  options.signal?.throwIfAborted();
  const explicit = options.formattingEntities ?? options.entities;
  let result = { message: text, entities: explicit };
  if (
    explicit === undefined &&
    options.parseMode !== undefined &&
    typeof text?.text !== 'string'
  ) {
    result = readAccountText(text ?? '', options.parseMode);
  }
  if (result.entities) {
    result.entities = canonicalValue(result.entities);
    for (let index = 0; index < result.entities.length; index++) {
      const entity = result.entities[index];
      const target = mentionTarget(entity);
      if (target !== undefined) {
        const user = await resolve(target);
        if (!Object.hasOwn(mentionUsers, user._)) {
          throw new TypeError('Mention formatting requires a user');
        }
        result.entities[index] = {
          _: 'inputMessageEntityMentionName',
          offset: entity.offset,
          length: entity.length,
          user_id: { ...user, _: mentionUsers[user._] },
        };
      }
    }
  }
  options.signal?.throwIfAborted();
  return result;
}
