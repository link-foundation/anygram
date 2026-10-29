import { EventEmitter } from 'node:events';
import { Bot as OriginalBot, webhookCallback as originalWebhook } from 'grammy';
import { Bot, webhookCallback } from '../../src/index.js';

export const frameworkNames = [
  'callback',
  'aws-lambda',
  'aws-lambda-async',
  'azure',
  'azure-v4',
  'bun',
  'cloudflare',
  'cloudflare-mod',
  'elysia',
  'express',
  'fastify',
  'hono',
  'http',
  'https',
  'koa',
  'next-js',
  'nhttp',
  'oak',
  'serveHttp',
  'std/http',
  'sveltekit',
  'worktop',
];
const secretHeader = 'x-telegram-bot-api-secret-token';

function recordedResponse(calls) {
  const response = {};
  for (const method of [
    'end',
    'send',
    'set',
    'status',
    'json',
    'sendStatus',
    'writeHead',
    'headers',
    'code',
  ]) {
    response[method] = (...args) => {
      calls.push([
        method,
        ...args.map((arg) => (typeof arg === 'function' ? '<callback>' : arg)),
      ]);
      for (const arg of args) {
        if (typeof arg === 'function') {
          arg();
        }
      }
      return response;
    };
  }
  return response;
}

function frameworkRequest(name, update, header, calls) {
  const headers = {
    [secretHeader]: header,
    'X-Telegram-Bot-Api-Secret-Token': header,
  };
  const fetchHeaders = new globalThis.Headers(
    header === undefined ? {} : { [secretHeader]: header }
  );
  const request = () =>
    new globalThis.Request('http://localhost/webhook', {
      method: 'POST',
      headers: fetchHeaders,
      body: JSON.stringify(update),
    });
  const response = recordedResponse(calls);
  const bodyRequest = { body: update, headers, header: () => header };
  const state = {};
  let external;
  let emit;
  const respondWith = (value) => {
    external = Promise.resolve(value);
  };
  const streamArgs = () => {
    const incoming = Object.assign(new EventEmitter(), { headers });
    let requested = false;
    let fired = false;
    const deliver = () =>
      Promise.resolve().then(() => {
        if (requested && !fired && incoming.listenerCount('end')) {
          fired = true;
          incoming.emit('data', Buffer.from(JSON.stringify(update)));
          incoming.emit('end');
        }
      });
    incoming.on('newListener', deliver);
    emit = () => {
      requested = true;
      deliver();
    };
    return [incoming, response];
  };
  const factories = {
    callback: () => [update, (json) => calls.push(['callback', json]), header],
    'aws-lambda': () => [
      { body: JSON.stringify(update), headers },
      {},
      (...args) => {
        calls.push(['lambda', ...args]);
      },
    ],
    'aws-lambda-async': () => [{ body: JSON.stringify(update), headers }, {}],
    azure: () => [Object.assign(state, { res: response }), bodyRequest],
    'azure-v4': () => [request()],
    bun: () => [request()],
    cloudflare: () => [{ request: request(), respondWith }],
    'cloudflare-mod': () => [request()],
    elysia: () => [
      { ...bodyRequest, set: Object.assign(state, { headers: {} }) },
    ],
    express: () => [bodyRequest, response],
    fastify: () => [bodyRequest, response],
    hono: () => [
      {
        req: { json: async () => update, header: () => header },
        body: (body, status) => new globalThis.Response(body, { status }),
        status: (status) => {
          state.status = status;
        },
        json: (body) =>
          new globalThis.Response(JSON.stringify(body), {
            headers: { 'content-type': 'application/json' },
          }),
      },
    ],
    http: streamArgs,
    https: streamArgs,
    koa: () => [
      Object.assign(state, {
        get: () => header,
        set: (key, value) => calls.push(['set', key, value]),
        request: { body: update },
        response: {},
      }),
    ],
    'next-js': () => [bodyRequest, response],
    nhttp: () => [{ body: update, headers: fetchHeaders, response }],
    oak: () => [
      {
        request: { body: { json: async () => update }, headers: fetchHeaders },
        response: state,
      },
    ],
    serveHttp: () => [{ request: request(), respondWith }],
    'std/http': () => [request()],
    sveltekit: () => [{ request: request() }],
    worktop: () => [
      { json: async () => update, headers: fetchHeaders },
      response,
    ],
  };
  const args = factories[name]();
  return {
    args,
    emit: () => emit?.(),
    external: () => external,
    snapshot: () =>
      JSON.parse(
        JSON.stringify(state, (key, value) =>
          typeof value === 'function' ? undefined : value
        )
      ),
  };
}

async function returned(value) {
  if (value instanceof globalThis.Response) {
    return {
      status: value.status,
      headers: Object.fromEntries(value.headers),
      body: await value.text(),
    };
  }
  return value;
}

/** Exercise the public callback using finite framework-shaped request/response objects. */
export async function frameworkScenario(
  name,
  reference,
  mode,
  { defaultAdapter = false, positionalOptions = false } = {}
) {
  const botInfo = { id: 123, is_bot: true, first_name: 'Bot', username: 'bot' };
  const Constructor = reference ? OriginalBot : Bot;
  const bot = new Constructor('123:webhook', {
    botInfo,
    client: { canUseWebhookReply: () => true },
  });
  bot.botInfo = botInfo;
  const updates = [];
  bot.use(async (ctx) => {
    updates.push(ctx.update.update_id);
    if (mode === 'reply') {
      await ctx.api.sendMessage(7, 'fast');
    }
  });
  const calls = [];
  const fixture = frameworkRequest(
    name,
    { update_id: 1 },
    mode === 'unauthorized' ? 'wrong' : 'secret',
    calls
  );
  const makeCallback = reference ? originalWebhook : webhookCallback;
  const adapter = defaultAdapter ? undefined : name;
  const callback = positionalOptions
    ? makeCallback(bot, adapter, 'throw', 10000, 'secret')
    : makeCallback(bot, adapter, { secretToken: 'secret' });
  const task = callback(...fixture.args);
  fixture.emit();
  let timer;
  const limit = new Promise((resolve, reject) => {
    timer = globalThis.setTimeout(
      () => reject(new Error(`Unfinished ${name} ${mode} fixture`)),
      3000
    );
  });
  const finish = async () => {
    const result = await task;
    return {
      updates,
      calls,
      returned: await returned(result),
      external: await returned(await fixture.external()),
      state: fixture.snapshot(),
    };
  };
  try {
    return await Promise.race([finish(), limit]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}
