import { Composer, Context, matchFilter } from '../src/index.js';
import type { Filter, FilterQuery } from '../src/index.js';
import type { Telegram } from '../src/index.js';

interface AppContext extends Context {
  session: { visits: number };
}
const bot = new Composer<AppContext>();
// @ts-expect-error A callback-only Composer cannot handle arbitrary updates.
const widened: Composer<AppContext> = bot.callbackQuery('choice');
void widened;
bot
  .on('message:text', (ctx) => {
    const text: string = ctx.message.text;
    const updateText: string = ctx.update.message.text;
    const sameText: string = ctx.msg.text;
    const sender: string = ctx.from.first_name;
    const chat: number = ctx.chat.id;
    ctx.session.visits += 1;
    void [text, updateText, sameText, sender, chat];
  })
  .use((ctx) => {
    const text: string = ctx.message.text;
    void text;
  });
bot.on(':photo', (ctx) => {
  const id: string = ctx.msg.photo[0].file_id;
  if (ctx.message) {
    const id: string = ctx.message.photo[0].file_id;
    void id;
  } else {
    const id: string = ctx.channelPost.photo[0].file_id;
    void id;
  }
  void id;
});
bot.on('edit:caption_entities:bold', (ctx) => {
  const caption: string = ctx.msg.caption;
  const edited: number = ctx.msg.edit_date;
  const entities: Telegram.MessageEntity[] = ctx.msg.caption_entities;
  void [caption, edited, entities];
});
bot.on('message:animation', (ctx) => {
  const file: string = ctx.message.document.file_id;
  void file;
});
bot.on(['message:text', 'channel_post:photo'], (ctx) => {
  if (ctx.message) {
    const text: string = ctx.message.text;
    void text;
  } else {
    const photo: string = ctx.channelPost.photo[0].file_id;
    void photo;
  }
});
bot.on(['message:text', 'message:photo'], (ctx) => {
  if (ctx.message.text !== undefined) {
    const text: string = ctx.message.text;
    void text;
  } else {
    const photo: string = ctx.message.photo[0].file_id;
    void photo;
  }
});
bot.command('start', (ctx) => {
  const args: string = ctx.match;
  const text: string = ctx.msg.text;
  void [args, text];
});
bot.callbackQuery(/^choice:/, (ctx) => {
  const data: string = ctx.callbackQuery.data;
  const sender: number = ctx.from.id;
  const match: string | RegExpMatchArray = ctx.match;
  void [data, sender, match];
});
bot.hears(/hello/, (ctx) => {
  const match: string | RegExpMatchArray = ctx.match;
  const id: number = ctx.msg.message_id;
  void [match, id];
});
bot.gameQuery('play', (ctx) => {
  const name: string = ctx.callbackQuery.game_short_name;
  void name;
});
bot.inlineQuery('find', (ctx) => {
  const query: string = ctx.inlineQuery.query;
  void query;
});
bot.chosenInlineResult('result', (ctx) => {
  const result: string = ctx.chosenInlineResult.result_id;
  void result;
});
bot.preCheckoutQuery('invoice', (ctx) => {
  const amount: number = ctx.preCheckoutQuery.total_amount;
  void amount;
});
bot.shippingQuery('invoice', (ctx) => {
  const country: string = ctx.shippingQuery.shipping_address.country_code;
  void country;
});
bot.reaction('👍', (ctx) => {
  const id: number = ctx.messageReaction.message_id;
  const chat: number = ctx.chatId;
  void [id, chat];
});
bot.chatType('private', (ctx) => {
  const kind: 'private' = ctx.chat.type;
  const sender: number = ctx.from.id;
  const id: number = ctx.chatId;
  if (ctx.message) {
    const kind: 'private' = ctx.message.chat.type;
    void kind;
  }
  void [kind, sender, id];
});
bot.chatType(['channel', 'supergroup'], (ctx) => {
  const kind: 'channel' | 'supergroup' = ctx.chat.type;
  void kind;
});
bot.chatType('channel', (ctx) => {
  const absent: undefined = ctx.message;
  void absent;
});
bot.filter(matchFilter('inline_query'), (ctx) => {
  const query: string = ctx.inlineQuery.query;
  void query;
});
export function inspect(ctx: AppContext) {
  if (ctx.has('message:text')) {
    const text: string = ctx.message.text;
    const sender: string = ctx.from.first_name;
    void [text, sender];
  }
  if (ctx.hasCommand('start')) {
    const args: string = ctx.match;
    void args;
  }
  if (Context.has.callbackQuery('choice')(ctx)) {
    const data: string = ctx.callbackQuery.data;
    void data;
  }
  if (Context.has.filterQuery('chat_member')(ctx)) {
    const id: number = ctx.chatMember.from.id;
    void id;
  }
  if (ctx.hasChatType('supergroup')) {
    const kind: 'supergroup' = ctx.chat.type;
    void kind;
  }
  if (ctx.hasText('hello')) {
    const match: string | RegExpMatchArray = ctx.match;
    void match;
  }
  if (ctx.hasReaction('👍')) {
    const date: number = ctx.messageReaction.date;
    void date;
  }
  if (ctx.hasGameQuery('play')) {
    const game: string = ctx.callbackQuery.game_short_name;
    void game;
  }
  if (ctx.hasInlineQuery('find')) {
    const id: string = ctx.inlineQuery.id;
    void id;
  }
  if (ctx.hasChosenInlineResult('choice')) {
    const id: string = ctx.chosenInlineResult.result_id;
    void id;
  }
  if (ctx.hasPreCheckoutQuery('invoice')) {
    const id: string = ctx.preCheckoutQuery.id;
    void id;
  }
  if (ctx.hasShippingQuery('invoice')) {
    const id: string = ctx.shippingQuery.id;
    void id;
  }
  if (Context.has.chatType('private')(ctx)) {
    const id: number = ctx.from.id;
    void id;
  }
}
export function standalone(ctx: Filter<AppContext, 'message:photo'>) {
  const file: string = ctx.message.photo[0].file_id;
  ctx.session.visits += 1;
  void file;
}
const query: FilterQuery = '::bot_command';
void query;
// @ts-expect-error Unknown update names are not valid filter queries.
bot.on('unknown_update', () => {});
// @ts-expect-error Filtering has a maximum of three levels.
bot.on('message:photo:width:extra', () => {});
// @ts-expect-error An entity-only third-level flag is invalid for photos.
bot.on('message:photo:bold', () => {});
// @ts-expect-error Chat types are the four documented Telegram chat types.
bot.chatType('secret', () => {});
bot.on('message:text', (ctx) => {
  // @ts-expect-error Text is a string after filtering.
  const text: number = ctx.message.text;
  // @ts-expect-error Custom application context remains concrete.
  ctx.session.visits = 'one';
  void text;
});
