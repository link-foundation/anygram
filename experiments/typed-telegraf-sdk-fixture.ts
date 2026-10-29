// Generated from the public migration fixture; run generate-filter-type-oracle.mjs.
import { Composer, Context } from 'telegraf';
import type { Update as BotUpdate } from 'telegraf/types';
import type { NarrowedContext } from 'telegraf';

interface AppContext extends Context {
  session: { visits: number };
}
const composer = new Composer<AppContext>();
const same: typeof composer = composer
  .on('message', (ctx) => {
    const message: number = ctx.message.message_id;
    const id: number = ctx.update.message.message_id;
    const alias: number = ctx.msg.message_id;
    ctx.session.visits += 1;
    void [message, id, alias];
  })
  .on('text', (ctx) => {
    const text: string = ctx.message.text;
    const alias: string = ctx.text;
    const event: 'message' = ctx.updateType;
    const sender: string = ctx.from.first_name;
    void [text, alias, event, sender];
  })
  .hears('hello', (ctx) => {
    const text: string = ctx.message.text;
    const match: RegExpExecArray = ctx.match;
    void [text, match];
  })
  .command('start', (ctx) => {
    const text: string = ctx.message.text;
    const command: string = ctx.command;
    const payload: string = ctx.payload;
    const args: string[] = ctx.args;
    const match: RegExpExecArray = ctx.match;
    void [text, command, payload, args, match];
  })
  .action('choice', (ctx) => {
    const query: string = ctx.callbackQuery.id;
    const sender: number = ctx.from.id;
    const match: RegExpExecArray = ctx.match;
    void [query, sender, match];
  })
  .inlineQuery('find', (ctx) => {
    const text: string = ctx.inlineQuery.query;
    const match: RegExpExecArray = ctx.match;
    void [text, match];
  })
  .gameQuery((ctx) => {
    const name: string = ctx.callbackQuery.game_short_name;
    void name;
  })
  .reaction('👍', (ctx) => {
    const id: number = ctx.messageReaction.message_id;
    void id;
  })
  .email('person@example.test', (ctx) => {
    const id: number = ctx.msg.message_id;
    const match: RegExpExecArray = ctx.match;
    void [id, match];
  })
  .start((ctx) => {
    const payload: string = ctx.startPayload;
    const command: string = ctx.command;
    void [payload, command];
  })
  .help((ctx) => {
    const args: string[] = ctx.args;
    void args;
  })
  .settings((ctx) => {
    const payload: string = ctx.payload;
    void payload;
  });
void same;

type TextUpdate = {
  update_id: number;
  message: {
    message_id: number;
    date: number;
    chat: NonNullable<Context['chat']> & { type: 'private' };
    from: NonNullable<Context['from']>;
    text: string;
  };
};
function isText(update: BotUpdate): update is TextUpdate {
  const message = 'message' in update ? update.message : undefined;
  return (
    message !== undefined &&
    'text' in message &&
    typeof message.text === 'string' &&
    message.chat.type === 'private' &&
    message.from !== undefined
  );
}
composer.guard(isText, (ctx) => {
  const text: string = ctx.message.text;
  const raw: string = ctx.update.message.text;
  void [text, raw];
});
composer.on(isText, (ctx) => {
  const text: string = ctx.message.text;
  void text;
});
function isSpecificId(
  update: BotUpdate
): update is BotUpdate & { update_id: 42 } {
  return update.update_id === 42;
}
composer.guard(isSpecificId, (ctx) => {
  const id: 42 = ctx.update.update_id;
  if (ctx.message) {
    const message: number = ctx.message.message_id;
    void message;
  }
  void id;
});
composer.on(['message', 'inline_query'], (ctx) => {
  if (ctx.message) {
    const message: number = ctx.message.message_id;
    void message;
  } else {
    const query: string = ctx.inlineQuery.query;
    void query;
  }
});
export function inspect(ctx: AppContext) {
  if (ctx.has('callback_query')) {
    const id: string = ctx.callbackQuery.id;
    const from: number = ctx.from.id;
    ctx.session.visits += 1;
    void [id, from];
  }
  if (ctx.has(isText)) {
    const text: string = ctx.message.text;
    void text;
  }
}
export function inspectMessage(ctx: AppContext) {
  if (ctx.msg?.has('text')) {
    const text: string = ctx.msg.text;
    void text;
  }
  // @ts-expect-error Message checks reject unknown wire fields.
  ctx.msg?.has('unknown_field');
}
export function textHandler(ctx: NarrowedContext<AppContext, TextUpdate>) {
  const text: string = ctx.message.text;
  ctx.session.visits += 1;
  void text;
}
Composer.on('message', (ctx) => {
  const id: number = ctx.message.message_id;
  void id;
});
Composer.hears('hello', (ctx) => {
  const text: string = ctx.message.text;
  void text;
});
Composer.command('start', (ctx) => {
  const args: string[] = ctx.args;
  void args;
});
Composer.action('go', (ctx) => {
  const id: string = ctx.callbackQuery.id;
  void id;
});
Composer.guard(isText, (ctx) => {
  const text: string = ctx.message.text;
  void text;
});
Composer.on<AppContext, 'text'>('text', (ctx) => {
  const text: string = ctx.message.text;
  ctx.session.visits += 1;
  void text;
});
Composer.mount('inline_query', (ctx) => {
  const query: string = ctx.inlineQuery.query;
  void query;
});
Composer.gameQuery((ctx) => {
  const game: string = ctx.callbackQuery.game_short_name;
  void game;
});
Composer.reaction('👍', (ctx) => {
  const id: number = ctx.messageReaction.message_id;
  void id;
});
Composer.email('person@example.test', (ctx) => {
  const id: number = ctx.msg.message_id;
  const match: RegExpExecArray = ctx.match;
  void [id, match];
});
composer.on('photo', (ctx) => {
  const file: string = ctx.message.photo[0].file_id;
  const absent: undefined = ctx.inlineQuery;
  void [file, absent];
});
composer.hears(
  (text, ctx) => {
    const message: string = ctx.message.text;
    void message;
    return /hello/u.exec(text);
  },
  () => {}
);
// @ts-expect-error Unknown update names are rejected.
composer.on('unknown_update', () => {});
// @ts-expect-error Raw update checks do not accept message subtypes.
export const wrongHas = (ctx: AppContext) => ctx.has('text');
composer.on('message', (ctx) => {
  // @ts-expect-error Custom context stays concrete in narrowed callbacks.
  ctx.session.visits = 'one';
});
