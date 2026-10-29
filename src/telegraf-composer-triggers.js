import { commandArgs } from './telegraf-command-args.js';

export const list = (value) => (Array.isArray(value) ? value : [value]);

export function triggers(value) {
  const values = list(value);
  if (values.length > 1000) {
    throw new RangeError('Telegraf trigger limit exceeded');
  }
  return values.map((trigger) => {
    if (!trigger) {
      throw new Error('Invalid trigger');
    }
    if (typeof trigger === 'function') {
      return trigger;
    }
    if (trigger instanceof RegExp) {
      return (text = '') => {
        trigger.lastIndex = 0;
        return trigger.exec(text);
      };
    }
    const pattern = new RegExp(
      `^${trigger.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&')}$`
    );
    return (text) => pattern.exec(text);
  });
}

export function textOf(value) {
  if (value === undefined || value === null) {
    return undefined;
  }
  for (const key of ['caption', 'text', 'data', 'game_short_name']) {
    if (key in value) {
      return value[key];
    }
  }
}

export function entitiesOf(message) {
  if (message === undefined || message === null) {
    return [];
  }
  for (const key of ['caption_entities', 'entities']) {
    if (key in message) {
      return message[key] ?? [];
    }
  }
  return [];
}

export function textArguments(value, prefix = '') {
  return list(value)
    .filter(Boolean)
    .map((entry) =>
      prefix && typeof entry === 'string' && !entry.startsWith(prefix)
        ? prefix + entry
        : entry
    );
}

export function commandMiddleware(patterns, handler) {
  return (ctx, next) => {
    const entities = ctx.message.entities;
    const entity = entities?.[0];
    if (entity?.type !== 'bot_command' || entity.offset > 0) {
      return next();
    }
    const text = ctx.message.text;
    const [first, username] = text.slice(0, entity.length).split('@');
    if (
      !first ||
      (username && username.toLowerCase() !== ctx.me.toLowerCase())
    ) {
      return next();
    }
    const command = first.slice(1);
    for (const trigger of patterns) {
      const match = trigger(command, ctx);
      if (match) {
        const offset = entity.length + 1;
        const payload = text.slice(offset);
        Object.assign(ctx, { match, command, payload, args: [] });
        let args;
        Object.defineProperty(ctx, 'args', {
          enumerable: true,
          configurable: true,
          get: () => (args ??= commandArgs(payload, entities, offset)),
          set: (value) => {
            args = value;
          },
        });
        return handler(ctx, next);
      }
    }
    return next();
  };
}
