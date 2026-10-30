// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import { Telegraf } from 'telegraf';
type Options = NonNullable<ConstructorParameters<typeof Telegraf>[1]>;
type TelegramOptions = NonNullable<Options['telegram']>;
declare const agent: NonNullable<TelegramOptions['agent']>;
declare const plain: NonNullable<TelegramOptions['agent']>;
const bot = new Telegraf('123:example', {
  telegram: {
    agent,
    attachmentAgent: (url) => (url.protocol === 'https:' ? agent : plain),
  },
});
bot.use(async (ctx) => {
  ctx.telegram.options.agent = agent;
  ctx.telegram.options.attachmentAgent = () => agent;
  await ctx.telegram.sendDocument(7, {
    url: 'https://example.org/file',
    filename: 'file.txt',
  });
});
// @ts-expect-error API agent is an agent instance, rather than a URL selector.
new Telegraf('123:example', { telegram: { agent: () => agent } });
// @ts-expect-error Attachment selectors return agents.
new Telegraf('123:example', { telegram: { attachmentAgent: () => 'https' } });
