import { Readable } from 'node:stream';
import { Telegraf as OriginalTelegraf } from 'telegraf';
import { Telegraf } from '../../src/index.js';
import { uploadServer } from './bot-upload-server.js';
import { botRequestFields } from './bot-client.js';

export const webhookInfo = {
  id: 123,
  is_bot: true,
  first_name: 'Bot',
  username: 'bot',
};
export const webhookUpdate = {
  update_id: 1,
  message: { message_id: 9, date: 1, chat: { id: 7, type: 'private' } },
};

export function telegrafWebhookBot(reference, options = {}) {
  const calls = [];
  const invoke = async (method, params) => {
    calls.push([method, params]);
    return method === 'getMe' ? webhookInfo : true;
  };
  const bot = reference
    ? new OriginalTelegraf('123:webhook', { handlerTimeout: 1000, ...options })
    : new Telegraf('123:webhook', { api: { callApi: invoke }, ...options });
  if (reference) {
    bot.telegram.callApi = invoke;
  }
  bot.botInfo = webhookInfo;
  return { bot, calls };
}

export function telegrafWebhookRequest(form = 'object', overrides = {}) {
  const json = JSON.stringify(webhookUpdate);
  const request =
    form === 'stream'
      ? Readable.from([
          Buffer.from(json.slice(0, 13)),
          Buffer.from(json.slice(13)),
        ])
      : {
          body:
            form === 'buffer'
              ? Buffer.from(json)
              : form === 'string'
                ? json
                : webhookUpdate,
        };
  return Object.assign(
    request,
    {
      method: 'POST',
      url: '/hook',
      headers: { 'x-telegram-bot-api-secret-token': 'secret' },
    },
    overrides
  );
}

export function telegrafWebhookResponse() {
  const response = {
    statusCode: 200,
    writableEnded: false,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    writeHead(code) {
      this.statusCode = code;
      return this;
    },
    end(body) {
      this.body = body ?? '';
      this.writableEnded = true;
    },
  };
  const snapshot = () => ({
    status: response.statusCode,
    headers: response.headers,
    body:
      response.headers['content-type'] === 'application/json'
        ? JSON.parse(response.body)
        : response.body,
    ended: response.writableEnded,
  });
  return { response, snapshot };
}

export const plainWebhookCalls = (value) => JSON.parse(JSON.stringify(value));

export async function telegrafWebhookScenario(reference, options = {}) {
  const server =
    options.replyFlag === false
      ? await uploadServer({ maxRequests: 2 })
      : undefined;
  try {
    const { bot, calls } = telegrafWebhookBot(
      reference,
      server ? { telegram: { apiRoot: server.root } } : {}
    );
    const updates = [];
    if (options.replyFlag !== undefined) {
      bot.webhookReply = options.replyFlag;
    }
    bot.use(async (ctx) => {
      updates.push(ctx.update.update_id);
      if (options.reply !== false) {
        await ctx.deleteMessage();
      }
    });
    const filterCalls = [];
    if (options.customFilter) {
      bot.webhookFilter = function (request) {
        filterCalls.push([this, request.url]);
        return true;
      };
    }
    const callback = bot.webhookCallback('/hook', { secretToken: 'secret' });
    const { response, snapshot } = telegrafWebhookResponse();
    let next = 0;
    const args = [
      telegrafWebhookRequest(options.form, options.request),
      response,
    ];
    if (options.next) {
      args.push(() => {
        next++;
      });
    }
    await callback(...args);
    for (const request of server?.requests ?? []) {
      calls.push([request.url.split('/').at(-1), botRequestFields(request)]);
    }
    return plainWebhookCalls({
      calls,
      updates,
      next,
      filterCalls,
      ...snapshot(),
    });
  } finally {
    await server?.close();
  }
}
