import { Composer, Scenes, Telegraf, type Context } from 'telegraf';

type TaggedContext = Context & { requestTag: string };
class TaggedComposer extends Composer<TaggedContext> {
  finish(): this {
    return this;
  }
}
const composer: TaggedComposer = new TaggedComposer()
  .on('message', (ctx) => {
    const tag: string = ctx.requestTag;
    void tag;
    // @ts-expect-error A valid chain must preserve the custom context type.
    const invalid: number = ctx.requestTag;
    void invalid;
  })
  .hears('hello', () => {})
  .command('start', () => {})
  .action('go', () => {})
  .inlineQuery('find', () => {})
  .gameQuery(() => {})
  .reaction('👍', () => {})
  .email('email', () => {})
  .url(/example/, () => {})
  .textLink('link', () => {})
  .textMention('mention', () => {})
  .mention('name', () => {})
  .phone('123', () => {})
  .hashtag('tag', () => {})
  .cashtag('USD', () => {})
  .spoiler('hidden', () => {})
  .filter((ctx) => Boolean(ctx.requestTag))
  .drop(() => false)
  .start(() => {})
  .help(() => {})
  .settings(() => {})
  .use(() => {})
  .finish();
void composer;
// @ts-expect-error Fluent registrations do not invent members.
composer.on('message', () => {}).missingMember();

class TaggedBot extends Telegraf<TaggedContext> {
  finish(): this {
    return this;
  }
}
const bot: TaggedBot = new TaggedBot('types:fixture')
  .on('message', () => {})
  .hears('hello', () => {})
  .email('person@example.test', () => {})
  .filter(() => true)
  .finish();
void bot;

const scene = new Scenes.BaseScene<Scenes.WizardContext>('fluent');
const registeredScene: typeof scene = scene
  .on('message', () => {})
  .hears('hello', () => {})
  .command('start', () => {})
  .mention('user', () => {})
  .filter(() => true)
  .enter(() => {});
const wizard = new Scenes.WizardScene<Scenes.WizardContext>('wizard', () => {});
const registeredWizard: typeof wizard = wizard
  .on('message', () => {})
  .hears('hello', () => {})
  .enter(() => {});
const stage = new Scenes.Stage<Scenes.WizardContext>([scene, wizard]);
const registeredStage: typeof stage = stage
  .on('message', () => {})
  .command('start', () => {})
  .register(scene, wizard);
void [registeredScene, registeredWizard, registeredStage];
