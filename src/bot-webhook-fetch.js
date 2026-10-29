import {
  fetchWebhookInput,
  webhookHeader,
  webhookHandler,
  webhookResult,
  jsonWebhookHeaders,
} from './bot-webhook-common.js';

function fetchAdapter(request, limits, deliver) {
  const input = fetchWebhookInput(request, limits.maxBytes);
  const result = webhookResult();
  const send = deliver ?? result.finish;
  return webhookHandler(
    input.read,
    request.headers.get(webhookHeader) ?? undefined,
    {
      end: () => send(new globalThis.Response(null)),
      respond: (body) =>
        send(new globalThis.Response(body, { headers: jsonWebhookHeaders })),
      unauthorized: () =>
        send(new globalThis.Response('"unauthorized"', { status: 401 })),
      ...(!deliver && { handlerReturn: result.handlerReturn }),
      close: input.close,
    }
  );
}

export const fetchWebhookAdapters = {
  bun: ([request], limits) => fetchAdapter(request, limits),
  'cloudflare-mod': ([request], limits) => fetchAdapter(request, limits),
  'std/http': ([request], limits) => fetchAdapter(request, limits),
  sveltekit: ([{ request }], limits) => fetchAdapter(request, limits),
  cloudflare: ([event], limits) => {
    const handler = fetchAdapter(event.request, limits);
    event.respondWith(handler.handlerReturn);
    delete handler.handlerReturn;
    return handler;
  },
  serveHttp: ([event], limits) =>
    fetchAdapter(event.request, limits, (response) =>
      event.respondWith(response)
    ),
  hono: ([context]) => {
    const result = webhookResult();
    return webhookHandler(
      () => context.req.json(),
      context.req.header(webhookHeader),
      {
        end: () => result.finish(context.body('')),
        respond: (body) => result.finish(context.json(body)),
        unauthorized: () => {
          context.status(401);
          result.finish(context.body(''));
        },
        handlerReturn: result.handlerReturn,
      }
    );
  },
};
