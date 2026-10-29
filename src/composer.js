import { compose, matchesFilter, matchText } from './bot-context.js';

function matching(pattern, valueOf, middleware) {
  const run = compose(middleware);
  return (ctx, next) => {
    const match = matchText(pattern, valueOf(ctx));
    if (!match) {
      return next();
    }
    ctx.match = match;
    return run(ctx, next);
  };
}

/** Shared registration and dispatch for bots, nested composers and scenes. */
export class Composer {
  constructor(...middleware) {
    this.handlers = [];
    this.use(...middleware);
  }
  use(...middleware) {
    for (const entry of middleware) {
      this.handlers.push(
        typeof entry === 'function' ? entry : entry.middleware()
      );
    }
    return this;
  }
  on(filters, ...middleware) {
    const values = Array.isArray(filters) ? filters : [filters];
    const run = compose(middleware);
    return this.use((ctx, next) =>
      values.some((filter) => matchesFilter(ctx, filter))
        ? run(ctx, next)
        : next()
    );
  }
  command(commands, ...middleware) {
    const names = Array.isArray(commands) ? commands : [commands];
    const run = compose(middleware);
    return this.use((ctx, next) => {
      const message = ctx.message;
      const entity = message?.entities?.find(
        (entry) => entry.type === 'bot_command' && entry.offset === 0
      );
      if (!entity) {
        return next();
      }
      const [command, username] = message.text
        .slice(1, entity.length)
        .split('@');
      if (
        !names.includes(command) ||
        (username &&
          username.toLowerCase() !== ctx.botInfo?.username?.toLowerCase())
      ) {
        return next();
      }
      ctx.match = message.text.slice(entity.length).trimStart();
      return run(ctx, next);
    });
  }
  hears(pattern, ...middleware) {
    return this.use(matching(pattern, (ctx) => ctx.msg?.text, middleware));
  }
  action(pattern, ...middleware) {
    return this.use(
      matching(pattern, (ctx) => ctx.callbackQuery?.data, middleware)
    );
  }
  middleware() {
    return compose(this.handlers);
  }
}
