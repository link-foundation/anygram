import { Bot as OriginalBot } from 'grammy';
import { Telegraf as OriginalTelegraf } from 'telegraf';
import { Bot, Telegraf } from '../../src/index.js';
import { uploadServer } from './bot-upload-server.js';
import { botRequestFields, selectedBotClient } from './bot-client.js';

/** Finite actual-SDK oracle with independent HTTP for operations not sent in a reply. */
export async function webhookReplyScenario(
  style,
  reference,
  run,
  options = {}
) {
  const server = await uploadServer({ maxRequests: 16 });
  const bodies = [];
  const headers = [];
  const botInfo = { id: 123, is_bot: true, first_name: 'Bot', username: 'bot' };
  const Constructor = reference
    ? style === 'grammy'
      ? OriginalBot
      : OriginalTelegraf
    : style === 'grammy'
      ? Bot
      : Telegraf;
  const bot = new Constructor('123:webhook', {
    botInfo,
    baseUrl: server.root,
    client: { apiRoot: server.root, ...options.client },
    telegram: { apiRoot: server.root },
    ...(options.backend && {
      api: await selectedBotClient(options.backend, server.root, '123:webhook'),
    }),
  });
  bot.botInfo = botInfo;
  let id = 0;
  const dispatch = async ({ failSend } = {}) => {
    const send = (payload) => {
      bodies.push(JSON.parse(payload));
      if (failSend) {
        throw failSend;
      }
    };
    const response =
      style === 'grammy'
        ? { send }
        : {
            writableEnded: false,
            headersSent: false,
            setHeader(name, value) {
              headers.push([name.toLowerCase(), value]);
            },
            end(payload) {
              this.writableEnded = this.headersSent = true;
              if (payload) {
                send(payload);
              }
            },
          };
    const update = {
      update_id: ++id,
      message: {
        message_id: id,
        date: 1,
        chat: { id: 7, type: 'private' },
        from: { id: 8, is_bot: false, first_name: 'User' },
        text: 'hello',
      },
    };
    await bot.handleUpdate(update, response);
    return response;
  };
  try {
    const values = await run(bot, dispatch);
    return {
      values,
      bodies,
      headers,
      requests: server.requests.map((request) => ({
        method: request.url.split('/').at(-1),
        params: request.headers['content-type'].includes('multipart')
          ? 'multipart'
          : botRequestFields(request),
      })),
    };
  } finally {
    await server.close();
  }
}
