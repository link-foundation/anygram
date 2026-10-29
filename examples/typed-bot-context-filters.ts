import {
  Bot,
  Telegraf,
  Context,
  matchFilter,
  ReactionList,
  MessageReactions,
  type TelegrafContext,
} from '../src/index.js';

function grammyChecks(ctx: Context) {
  ctx.has(['message:text', 'channel_post:photo']);
  ctx.hasText(['hello', /^hello (.+)/]);
  ctx.hasCommand(['start', 'help']);
  ctx.hasReaction(['👍', { type: 'paid' }]);
  ctx.hasChatType(['private', 'supergroup']);
  ctx.hasCallbackQuery(/^save:/);
  ctx.hasGameQuery('game');
  ctx.hasInlineQuery(/search/);
  ctx.hasChosenInlineResult('result');
  ctx.hasPreCheckoutQuery('order');
  ctx.hasShippingQuery('order');
  const entityText: string[] = ctx
    .entities(['bold', 'italic'])
    .map((entity) => entity.text);
  const added: string[] = ctx.reactions().emojiAdded;
  return [entityText, added];
}
function telegrafChecks(ctx: TelegrafContext) {
  ctx.has(['message', (update) => update.message !== undefined]);
  const fragments: string[] = ctx
    .entities('bold', 'italic')
    .map((entity) => entity.fragment);
  const added: ReactionList = ctx.reactions.added;
  const current: MessageReactions = MessageReactions.from(ctx);
  current.has('👍');
  const text: string | undefined = ctx.text;
  const data: unknown = ctx.webAppData?.data.json();
  ctx.webhookReply = false;
  ctx.botInfo = { username: 'replacement' };
  return [fragments, added, text, data];
}
new Bot('types:fixture').use((ctx) => {
  grammyChecks(ctx);
});
new Telegraf('types:fixture').use((ctx) => {
  telegrafChecks(ctx);
});
const predicate: (ctx: Context) => boolean =
  Context.has.filterQuery(':entities:bold');
const samePredicate: typeof predicate = matchFilter('msg:file');
void samePredicate;
