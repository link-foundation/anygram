import { Bot, webhookCallback } from '../src/index.js';

declare const bot: Bot;
declare const update: Parameters<Bot['handleUpdate']>[0];
const options = { secretToken: 'secret', timeoutMilliseconds: 1000 };
const fetchRequest = new Request('http://localhost/webhook');
for (const adapter of ['bun', 'cloudflare-mod', 'std/http'] as const) {
  const result: Promise<Response> = webhookCallback(
    bot,
    adapter,
    options
  )(fetchRequest);
  void result;
}
void webhookCallback(bot, 'callback')(update, (json: string) =>
  JSON.parse(json)
);
void webhookCallback(bot, 'sveltekit')({ request: fetchRequest });
void webhookCallback(
  bot,
  'cloudflare'
)({ request: fetchRequest, respondWith: (_response: Promise<Response>) => {} });
void webhookCallback(
  bot,
  'serveHttp'
)({ request: fetchRequest, respondWith: (_response: Response) => {} });

const callback = webhookCallback(
  bot,
  (value: typeof update, header?: string) => ({
    update: value,
    header,
    respond: (json: string) => JSON.parse(json),
    unauthorized() {},
    handlerReturn: Promise.resolve(42),
  }),
  'return',
  1000,
  'secret'
);
const numeric: Promise<number> = callback(update, 'secret');
void numeric;

// Each name retains its distinct public request/response parameter tuple.
const lambda = webhookCallback(bot, 'aws-lambda');
declare const lambdaArgs: Parameters<typeof lambda>;
const lambdaResult: Promise<void> = lambda(...lambdaArgs);
void lambdaResult;
const lambdaAsync = webhookCallback(bot, 'aws-lambda-async');
declare const lambdaAsyncArgs: Parameters<typeof lambdaAsync>;
void lambdaAsync(...lambdaAsyncArgs);
const azure = webhookCallback(bot, 'azure');
declare const azureArgs: Parameters<typeof azure>;
void azure(...azureArgs);
const azureV4 = webhookCallback(bot, 'azure-v4');
void azureV4(fetchRequest);
const elysia = webhookCallback(bot, 'elysia');
declare const elysiaArgs: Parameters<typeof elysia>;
const text: Promise<string> = elysia(...elysiaArgs);
void text;
const express = webhookCallback(bot, 'express');
declare const expressArgs: Parameters<typeof express>;
const empty: Promise<void> = express(...expressArgs);
void empty;
const fastify = webhookCallback(bot, 'fastify');
declare const fastifyArgs: Parameters<typeof fastify>;
void fastify(...fastifyArgs);
const hono = webhookCallback(bot, 'hono');
declare const honoArgs: Parameters<typeof hono>;
const honoResponse: Promise<Response> = hono(...honoArgs);
void honoResponse;
const http = webhookCallback(bot, 'http');
declare const httpArgs: Parameters<typeof http>;
void http(...httpArgs);
void webhookCallback(bot, 'https')(...httpArgs);
const koa = webhookCallback(bot, 'koa');
declare const koaArgs: Parameters<typeof koa>;
void koa(...koaArgs);
const next = webhookCallback(bot, 'next-js');
declare const nextArgs: Parameters<typeof next>;
void next(...nextArgs);
const nhttp = webhookCallback(bot, 'nhttp');
declare const nhttpArgs: Parameters<typeof nhttp>;
void nhttp(...nhttpArgs);
const oak = webhookCallback(bot, 'oak');
declare const oakArgs: Parameters<typeof oak>;
void oak(...oakArgs);
const worktop = webhookCallback(bot, 'worktop');
declare const worktopArgs: Parameters<typeof worktop>;
void worktop(...worktopArgs);

// @ts-expect-error Unknown framework names are rejected.
webhookCallback(bot, 'not-a-framework');
// @ts-expect-error Fetch adapters require a request with header and JSON access.
webhookCallback(bot, 'bun')({ body: update });
// @ts-expect-error Express receives separate request and response arguments.
express(expressArgs[0]);
// @ts-expect-error Custom adapter argument types are retained.
callback('wrong');
