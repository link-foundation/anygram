import { Telegraf as OriginalTelegraf } from 'telegraf';
import { Telegraf } from '../../src/index.js';
import { uploadServer } from './bot-upload-server.js';
import { webhookInfo } from './telegraf-webhook.js';

export function telegramMetadata(api) {
  return {
    token: api.token,
    apiRoot: api.options.apiRoot,
    apiMode: api.options.apiMode,
    testEnv: api.options.testEnv,
    webhookReply: api.webhookReply,
  };
}

export function configuredTelegraf(reference, telegram, options = {}) {
  const Constructor = reference ? OriginalTelegraf : Telegraf;
  const bot = new Constructor('123:options', {
    ...options,
    telegram,
    fetch: (url, init) => {
      if (!String(url).startsWith('http://127.0.0.1:')) {
        throw new Error('Fixture refused a nonlocal Bot API request');
      }
      return globalThis.fetch(url, init);
    },
  });
  bot.botInfo = webhookInfo;
  return bot;
}

export async function telegrafOptionsScenario(reference, options = {}) {
  const server = await uploadServer({ maxRequests: 4 });
  const telegram = Object.freeze({
    apiRoot: `${server.root}/prefix/end${options.trailing ? '/' : ''}`,
    apiMode: options.apiMode ?? 'bot',
    testEnv: options.testEnv ?? false,
    webhookReply: false,
  });
  const contexts = [];
  try {
    const bot = configuredTelegraf(reference, telegram);
    bot.use(async (ctx) => {
      contexts.push(ctx.telegram);
      if (options.mutate && contexts.length === 1) {
        ctx.telegram.options.apiRoot = `${server.root}/context/`;
        ctx.telegram.options.apiMode = 'user';
        ctx.telegram.options.testEnv = true;
        ctx.telegram.webhookReply = true;
      }
      await ctx.telegram.sendMessage(7, 'context');
    });
    await bot.handleUpdate({ update_id: 1 });
    await bot.handleUpdate({ update_id: 2 });
    await bot.telegram.sendMessage(7, 'global');
    const file = { file_path: 'photos/example.jpg' };
    return {
      paths: server.requests.map((request) => request.url),
      metadata: [bot.telegram, ...contexts].map((api) => ({
        ...telegramMetadata(api),
        apiRoot: api.options.apiRoot.replace(server.root, 'ROOT'),
      })),
      independent: contexts.every(
        (api, index) =>
          api !== bot.telegram &&
          api.options !== bot.telegram.options &&
          (index === 0 || api !== contexts[index - 1])
      ),
      fileLink: String(await bot.telegram.getFileLink(file)).replace(
        server.root,
        'ROOT'
      ),
      contextLink: String(await contexts[0].getFileLink(file)).replace(
        server.root,
        'ROOT'
      ),
    };
  } finally {
    await server.close();
  }
}
