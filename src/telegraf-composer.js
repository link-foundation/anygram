import { Composer } from './composer.js';
import { Context } from './bot-context.js';
import {
  list,
  triggers,
  textOf,
  entitiesOf,
  textArguments,
  commandMiddleware,
} from './telegraf-composer-triggers.js';

const stop = () => Promise.resolve();

/** Telegraf's fluent registrations and static middleware factories. */
export class TelegrafComposer extends Composer {
  constructor(...middleware) {
    super();
    this.handler = TelegrafComposer.compose(middleware);
  }
  use(...middleware) {
    this.handler = TelegrafComposer.compose([this.handler, ...middleware]);
    return this;
  }
  start(...middleware) {
    const handler = TelegrafComposer.compose(middleware);
    return this.command('start', (ctx, next) => {
      ctx.startPayload = ctx.payload;
      return handler(ctx, next);
    });
  }
  help(...middleware) {
    return this.command('help', ...middleware);
  }
  settings(...middleware) {
    return this.command('settings', ...middleware);
  }
  static unwrap(handler) {
    if (!handler) {
      throw new Error('Handler is undefined');
    }
    return 'middleware' in handler ? handler.middleware() : handler;
  }
  static compose(middleware) {
    if (!Array.isArray(middleware)) {
      throw new Error('Middlewares must be an array');
    }
    if (!middleware.length) {
      return TelegrafComposer.passThru();
    }
    if (middleware.length === 1) {
      return TelegrafComposer.unwrap(middleware[0]);
    }
    return (ctx, next) => {
      let current = -1;
      const dispatch = async (index, context) => {
        if (!(context instanceof Context)) {
          throw new Error('next(ctx) called with invalid context');
        }
        if (index <= current) {
          throw new Error('next() called multiple times');
        }
        current = index;
        const handler = TelegrafComposer.unwrap(middleware[index] ?? next);
        await handler(context, (replacement = context) =>
          dispatch(index + 1, replacement)
        );
      };
      return dispatch(0, ctx);
    };
  }
  static passThru() {
    return (_ctx, next) => next();
  }
  static reply(...args) {
    return (ctx) => ctx.reply(...args);
  }
  static catch(onError, ...middleware) {
    const handler = TelegrafComposer.compose(middleware);
    return (ctx, next) =>
      Promise.resolve(handler(ctx, next)).catch((error) => onError(error, ctx));
  }
  static fork(middleware) {
    const handler = TelegrafComposer.unwrap(middleware);
    return async (ctx, next) => {
      await Promise.all([handler(ctx, stop), next()]);
    };
  }
  static tap(middleware) {
    const handler = TelegrafComposer.unwrap(middleware);
    return (ctx, next) =>
      Promise.resolve(handler(ctx, stop)).then(() => next());
  }
  static lazy(factory) {
    if (typeof factory !== 'function') {
      throw new Error('Argument must be a function');
    }
    return (ctx, next) =>
      Promise.resolve(factory(ctx)).then((entry) =>
        TelegrafComposer.unwrap(entry)(ctx, next)
      );
  }
  static log(logger = console.log) {
    return (ctx, next) => {
      logger(JSON.stringify(ctx.update, null, 2));
      return next();
    };
  }
  static branch(predicate, yes, no) {
    if (typeof predicate !== 'function') {
      return TelegrafComposer.unwrap(predicate ? yes : no);
    }
    return TelegrafComposer.lazy(async (ctx) =>
      (await predicate(ctx)) ? yes : no
    );
  }
  static optional(predicate, ...middleware) {
    return TelegrafComposer.branch(
      predicate,
      TelegrafComposer.compose(middleware),
      TelegrafComposer.passThru()
    );
  }
  static filter(predicate) {
    return TelegrafComposer.branch(
      predicate,
      TelegrafComposer.passThru(),
      stop
    );
  }
  static drop(predicate) {
    return TelegrafComposer.branch(
      predicate,
      stop,
      TelegrafComposer.passThru()
    );
  }
  static dispatch(route, handlers) {
    return TelegrafComposer.lazy(async (ctx) => handlers[await route(ctx)]);
  }
  static guard(predicate, ...middleware) {
    return TelegrafComposer.optional(
      (ctx) => predicate(ctx.update),
      ...middleware
    );
  }
  static on(filters, ...middleware) {
    const values = list(filters);
    return TelegrafComposer.guard(
      (update) =>
        values.some((filter) =>
          typeof filter === 'string'
            ? filter in update ||
              ('message' in update && filter in update.message)
            : filter(update)
        ),
      ...middleware
    );
  }
  static entity(predicate, ...middleware) {
    const types =
      typeof predicate === 'function' ? undefined : textArguments(predicate);
    const test =
      typeof predicate === 'function'
        ? predicate
        : (entity) => types.includes(entity.type);
    return TelegrafComposer.optional(
      (ctx) => {
        const message = ctx.message ?? ctx.channelPost;
        const text = textOf(message);
        return (
          text !== undefined &&
          entitiesOf(message).some((entity) =>
            test(
              entity,
              text.substring(entity.offset, entity.offset + entity.length),
              ctx
            )
          )
        );
      },
      ...middleware
    );
  }
  static entityText(type, predicate, ...middleware) {
    if (!middleware.length) {
      return TelegrafComposer.entity(type, ...list(predicate));
    }
    const patterns = triggers(predicate);
    return TelegrafComposer.entity(
      (entity, value, ctx) => {
        if (entity.type !== type) {
          return false;
        }
        return patterns.some((pattern) =>
          Boolean((ctx.match = pattern(value, ctx)))
        );
      },
      ...middleware
    );
  }
  static match(patterns, ...middleware) {
    const handler = TelegrafComposer.compose(middleware);
    return (ctx, next) => {
      const text =
        textOf(ctx.message) ??
        textOf(ctx.channelPost) ??
        textOf(ctx.callbackQuery) ??
        ctx.inlineQuery?.query;
      if (text !== undefined) {
        for (const pattern of patterns) {
          const match = pattern(text, ctx);
          if (match) {
            ctx.match = match;
            return handler(ctx, next);
          }
        }
      }
      return next();
    };
  }
  static command(command, ...middleware) {
    if (!middleware.length) {
      return TelegrafComposer.entity('bot_command', command);
    }
    return TelegrafComposer.on(
      (update) => 'message' in update && 'text' in update.message,
      commandMiddleware(triggers(command), TelegrafComposer.compose(middleware))
    );
  }
  static reaction(reactions, ...middleware) {
    const values = list(reactions);
    const handler = TelegrafComposer.compose(middleware);
    return TelegrafComposer.on('message_reaction', (ctx, next) => {
      const match = values.find((value) =>
        typeof value === 'string' && value.startsWith('-')
          ? ctx.reactions.removed.has(value.slice(1))
          : ctx.reactions.added.has(value)
      );
      if (!match) {
        return next();
      }
      ctx.match = match;
      return handler(ctx, next);
    });
  }
  static acl(users, ...middleware) {
    const predicate =
      typeof users === 'function'
        ? users
        : (ctx) => !ctx.from || list(users).includes(ctx.from.id);
    return TelegrafComposer.optional(predicate, ...middleware);
  }
  static memberStatus(status, ...middleware) {
    const values = list(status);
    return TelegrafComposer.optional(
      async (ctx) => {
        if (ctx.message === undefined) {
          return false;
        }
        return values.includes(
          (await ctx.getChatMember(ctx.message.from.id)).status
        );
      },
      ...middleware
    );
  }
  static chatType(types, ...middleware) {
    const values = list(types);
    return TelegrafComposer.optional(
      (ctx) => ctx.chat !== undefined && values.includes(ctx.chat.type),
      ...middleware
    );
  }
  static gameQuery(...middleware) {
    return TelegrafComposer.guard(
      (update) =>
        'callback_query' in update &&
        'game_short_name' in update.callback_query,
      ...middleware
    );
  }
}

for (const [name, event] of [
  ['hears', 'text'],
  ['action', 'callback_query'],
  ['inlineQuery', 'inline_query'],
]) {
  TelegrafComposer[name] = (trigger, ...middleware) =>
    TelegrafComposer.on(
      event,
      TelegrafComposer.match(triggers(trigger), ...middleware)
    );
}
for (const [name, type, prefix = ''] of [
  ['email', 'email'],
  ['phone', 'phone_number'],
  ['url', 'url'],
  ['textLink', 'text_link'],
  ['textMention', 'text_mention'],
  ['mention', 'mention', '@'],
  ['hashtag', 'hashtag', '#'],
  ['cashtag', 'cashtag', '$'],
  ['spoiler', 'spoiler'],
]) {
  TelegrafComposer[name] = (argument, ...middleware) =>
    TelegrafComposer.entityText(
      type,
      prefix ? textArguments(argument, prefix) : argument,
      ...middleware
    );
}
for (const [name, method, value] of [
  ['admin', 'memberStatus', ['administrator', 'creator']],
  ['creator', 'memberStatus', 'creator'],
  ['privateChat', 'chatType', 'private'],
  ['groupChat', 'chatType', ['group', 'supergroup']],
]) {
  TelegrafComposer[name] = (...middleware) =>
    TelegrafComposer[method](value, ...middleware);
}
TelegrafComposer.mount = TelegrafComposer.on;

// Keep Anygram's existing scoped query extensions on the Telegraf facade.
for (const name of [
  'callbackQuery',
  'chosenInlineResult',
  'preCheckoutQuery',
  'shippingQuery',
]) {
  TelegrafComposer.prototype[name] = function (trigger, ...middleware) {
    const parent = new Composer();
    const scope = parent[name](trigger, ...middleware);
    this.use(parent);
    return scope;
  };
}

for (const name of [
  'guard',
  'on',
  'hears',
  'command',
  'action',
  'inlineQuery',
  'gameQuery',
  'reaction',
  'drop',
  'filter',
  'entity',
  'email',
  'url',
  'textLink',
  'textMention',
  'mention',
  'phone',
  'hashtag',
  'cashtag',
  'spoiler',
]) {
  TelegrafComposer.prototype[name] = function (...args) {
    return this.use(TelegrafComposer[name](...args));
  };
}

/** Share this registration surface with Telegraf's existing bot runner. */
export function installTelegrafComposer(Type) {
  for (const [target, source, skip] of [
    [Type.prototype, TelegrafComposer.prototype, new Set(['constructor'])],
    [Type, TelegrafComposer, new Set(['length', 'name', 'prototype'])],
  ]) {
    for (const key of Object.getOwnPropertyNames(source)) {
      if (!skip.has(key)) {
        Object.defineProperty(
          target,
          key,
          Object.getOwnPropertyDescriptor(source, key)
        );
      }
    }
  }
}
