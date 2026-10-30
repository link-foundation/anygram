import {
  koaNodeWebhook,
  fastifyNodeWebhook,
} from '../../examples/webhook-frameworks.mjs';

/** Bridge frameworks with explicit Node request/response ownership. */
export function telegrafHandler(name, callback, errors) {
  const invoke = async (...args) => {
    try {
      return await callback(...args);
    } catch (error) {
      errors.push(error.message);
      const response = args[1];
      // Telegraf ends the webhook in its dispatch finally block, including on
      // failure. Report errors without writing a second response after it ends.
      if (!response.writableEnded) {
        response.writeHead(500, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ error: error.message }));
      }
    }
  };
  if (name === 'express') {
    return invoke;
  }
  if (name === 'koa') {
    return koaNodeWebhook(invoke);
  }
  if (name === 'fastify') {
    return fastifyNodeWebhook(invoke);
  }
  throw new TypeError(`No Node bridge for ${name}`);
}
