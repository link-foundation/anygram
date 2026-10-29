import {
  webhookHandler,
  webhookHeader,
  wrongWebhookToken,
  jsonWebhookHeaders,
  nodeWebhookInput,
} from './bot-webhook-common.js';

function nodeAdapter([request, response], limits) {
  const input = nodeWebhookInput(request, limits.maxBytes);
  const header = request.headers[webhookHeader];
  return webhookHandler(
    input.read,
    Array.isArray(header) ? header[0] : header,
    {
      end: () => response.end(),
      respond: (body) => response.writeHead(200, jsonWebhookHeaders).end(body),
      unauthorized: () => response.writeHead(401).end(wrongWebhookToken),
      close: input.close,
    }
  );
}

export const frameworkWebhookAdapters = {
  callback: ([update, callback, header, unauthorized]) =>
    webhookHandler(() => update, header, {
      respond: callback,
      unauthorized: unauthorized ?? (() => callback('"unauthorized"')),
    }),
  express: ([request, response]) =>
    webhookHandler(() => request.body, request.header(webhookHeader), {
      end: () => response.end(),
      respond: (body) =>
        response.set('Content-Type', 'application/json').send(body),
      unauthorized: () => response.status(401).send(wrongWebhookToken),
    }),
  fastify: ([request, reply]) =>
    webhookHandler(() => request.body, request.headers[webhookHeader], {
      end: () => reply.send(''),
      respond: (body) => reply.headers(jsonWebhookHeaders).send(body),
      unauthorized: () => reply.code(401).send(wrongWebhookToken),
    }),
  http: nodeAdapter,
  https: nodeAdapter,
  koa: ([context]) =>
    webhookHandler(
      () => context.request.body,
      context.get(webhookHeader) || undefined,
      {
        end: () => {
          context.body = '';
        },
        respond: (body) => {
          context.set('Content-Type', 'application/json');
          context.response.body = body;
        },
        unauthorized: () => {
          context.status = 401;
        },
      }
    ),
  'next-js': ([request, response]) =>
    webhookHandler(() => request.body, request.headers[webhookHeader], {
      end: () => response.end(),
      respond: (body) => response.status(200).json(body),
      unauthorized: () => response.status(401).send(wrongWebhookToken),
    }),
  nhttp: ([request]) =>
    webhookHandler(
      () => request.body,
      request.headers.get(webhookHeader) ?? undefined,
      {
        end: () => request.response.sendStatus(200),
        respond: (body) => request.response.status(200).send(body),
        unauthorized: () =>
          request.response.status(401).send(wrongWebhookToken),
      }
    ),
  oak: ([context]) =>
    webhookHandler(
      () => context.request.body.json(),
      context.request.headers.get(webhookHeader) ?? undefined,
      {
        end: () => {
          context.response.status = 200;
        },
        respond: (body) => {
          context.response.type = 'json';
          context.response.body = body;
        },
        unauthorized: () => {
          context.response.status = 401;
        },
      }
    ),
  worktop: ([request, response]) =>
    webhookHandler(
      () => request.json(),
      request.headers.get(webhookHeader) ?? undefined,
      {
        end: () => response.end(null),
        respond: (body) => response.send(200, body),
        unauthorized: () => response.send(401, wrongWebhookToken),
      }
    ),
};
