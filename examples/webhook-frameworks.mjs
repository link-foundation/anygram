/** Hono can return a Fetch Response without re-encoding a JSON reply string. */
export function honoFetchWebhook(callback) {
  return (context) => callback(context.req.raw);
}

/** After Koa body parsing, give a Node-style webhook sole response ownership. */
export function koaNodeWebhook(callback) {
  return (context) => {
    context.status = 200;
    context.respond = false;
    context.req.body = context.request.body;
    return callback(context.req, context.res);
  };
}

/** Fastify owns parsing; the callback owns the hijacked Node response. */
export function fastifyNodeWebhook(callback) {
  return (request, reply) => {
    reply.hijack();
    request.raw.body = request.body;
    return callback(request.raw, reply.raw);
  };
}
