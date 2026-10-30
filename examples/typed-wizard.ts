import { Scenes, Telegraf, telegrafSession } from '../src/index.js';

type BotContext = Scenes.WizardContext & {
  session: Scenes.WizardSession & { completed: number };
};
const wizard = new Scenes.WizardScene<BotContext>(
  'name',
  async (ctx) => {
    await ctx.reply('What is your name?');
    ctx.wizard.next();
  },
  async (ctx) => {
    ctx.session.completed++;
    await ctx.reply(`Hello, ${ctx.message?.text ?? 'friend'}`);
    await ctx.scene.leave();
  }
);
const stage = new Scenes.Stage<BotContext>([wizard]);
const bot = new Telegraf<BotContext>('123:type-example');
bot.use(telegrafSession({ defaultSession: () => ({ completed: 0 }) }));
bot.use(stage.middleware());
bot.start((ctx) => ctx.scene.enter('name'));
