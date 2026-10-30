import {
  webhookHandler,
  webhookHeader,
  webhookResult,
  wrongWebhookToken,
  jsonWebhookHeaders,
} from './bot-webhook-common.js';

function lambda(event, send) {
  return webhookHandler(
    () => JSON.parse(event.body ?? '{}'),
    event.headers['X-Telegram-Bot-Api-Secret-Token'] ??
      event.headers[webhookHeader],
    {
      end: () => send({ statusCode: 200 }),
      respond: (body) =>
        send({ statusCode: 200, headers: jsonWebhookHeaders, body }),
      unauthorized: () => send({ statusCode: 401 }),
    }
  );
}

export const serverlessWebhookAdapters = {
  'aws-lambda': ([event, , callback]) =>
    lambda(event, (value) => callback(null, value)),
  'aws-lambda-async': ([event]) => {
    const result = webhookResult();
    const handler = lambda(event, result.finish);
    handler.handlerReturn = result.handlerReturn;
    return handler;
  },
  azure: ([context, request]) =>
    webhookHandler(() => request.body, request.headers?.[webhookHeader], {
      end: () => {
        context.res = { status: 200, body: '' };
      },
      respond: (body) => {
        context.res?.set?.('Content-Type', 'application/json');
        context.res?.send?.(body);
      },
      unauthorized: () => context.res?.send?.(401, wrongWebhookToken),
    }),
  'azure-v4': ([request]) => {
    const result = webhookResult();
    return webhookHandler(
      () => request.json(),
      request.headers.get(webhookHeader) ?? undefined,
      {
        end: () => result.finish({ status: 204 }),
        respond: (body) => result.finish({ jsonBody: body }),
        unauthorized: () =>
          result.finish({ status: 401, body: wrongWebhookToken }),
        handlerReturn: result.handlerReturn,
      }
    );
  },
  elysia: ([context]) => {
    const result = webhookResult();
    return webhookHandler(() => context.body, context.headers[webhookHeader], {
      end: () => result.finish(''),
      respond: (body) => {
        context.set.headers['content-type'] = 'application/json';
        result.finish(body);
      },
      unauthorized: () => {
        context.set.status = 401;
        result.finish('');
      },
      handlerReturn: result.handlerReturn,
    });
  },
};
