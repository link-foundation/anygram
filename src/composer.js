import { Context, matchText } from './bot-context.js';
import { BotError } from './bot-error.js';

const pass = (_ctx, next) => next();
const leaf = () => Promise.resolve();
const flatten = (entry) =>
  typeof entry === 'function'
    ? entry
    : (ctx, next) => entry.middleware()(ctx, next);

function append(first, second) {
  return async (ctx, next) => {
    let continued = false;
    await first(ctx, async () => {
      if (continued) {
        throw new Error('`next` already called before!');
      }
      continued = true;
      await second(ctx, next);
    });
  };
}

/** Run middleware to completion without an enclosing middleware stack. */
export async function run(middleware, ctx) {
  await middleware(ctx, leaf);
}

/** grammY-style registration, including independently extensible scopes. */
export class Composer {
  constructor(...middleware) {
    this.handler = middleware.length
      ? middleware.map(flatten).reduce(append)
      : pass;
  }
  use(...middleware) {
    const scope = new Composer(...middleware);
    this.handler = append(this.handler, flatten(scope));
    return scope;
  }
  on(query, ...middleware) {
    return this.filter(Context.has.filterQuery(query), ...middleware);
  }
  filter(predicate, ...middleware) {
    const scope = new Composer(...middleware);
    this.branch(predicate, scope, pass);
    return scope;
  }
  drop(predicate, ...middleware) {
    return this.filter(async (ctx) => !(await predicate(ctx)), ...middleware);
  }
  fork(...middleware) {
    const scope = new Composer(...middleware);
    this.use((ctx, next) =>
      Promise.all([next(), run(scope.middleware(), ctx)])
    );
    return scope;
  }
  lazy(factory) {
    return this.use(async (ctx, next) => {
      const selected = await factory(ctx);
      const entries = Array.isArray(selected) ? selected : [selected];
      await new Composer(...entries).middleware()(ctx, next);
    });
  }
  route(router, handlers, fallback = pass) {
    return this.lazy(async (ctx) => {
      const key = await router(ctx);
      return (
        (key === undefined || !handlers[key] ? fallback : handlers[key]) ?? []
      );
    });
  }
  branch(predicate, yes, no) {
    return this.lazy(async (ctx) => ((await predicate(ctx)) ? yes : no));
  }
  errorBoundary(handleError, ...middleware) {
    const scope = new Composer(...middleware);
    this.use(async (ctx, next) => {
      let continueOutside = false;
      const resume = () => {
        continueOutside = true;
        return Promise.resolve();
      };
      try {
        await scope.middleware()(ctx, resume);
      } catch (error) {
        continueOutside = false;
        await handleError(new BotError(error, ctx), resume);
      }
      if (continueOutside) {
        await next();
      }
    });
    return scope;
  }
  // Retained extension for existing applications using the action alias.
  action(pattern, ...middleware) {
    return this.filter(
      (ctx) => {
        const match = matchText(pattern, ctx.callbackQuery?.data);
        if (!match) {
          return false;
        }
        ctx.match = match;
        return true;
      },
      ...middleware
    );
  }
  middleware() {
    return this.handler;
  }
}

for (const [name, checker] of [
  ['hears', 'text'],
  ['command', 'command'],
  ['reaction', 'reaction'],
  ['chatType', 'chatType'],
  ['callbackQuery', 'callbackQuery'],
  ['gameQuery', 'gameQuery'],
  ['inlineQuery', 'inlineQuery'],
  ['chosenInlineResult', 'chosenInlineResult'],
  ['preCheckoutQuery', 'preCheckoutQuery'],
  ['shippingQuery', 'shippingQuery'],
]) {
  Composer.prototype[name] = function (trigger, ...middleware) {
    if (name.endsWith('Query') || name === 'chosenInlineResult') {
      if (Array.isArray(trigger) && trigger.length > 1000) {
        throw new RangeError('Query trigger limit exceeded');
      }
    }
    return this.filter(Context.has[checker](trigger), ...middleware);
  };
}
