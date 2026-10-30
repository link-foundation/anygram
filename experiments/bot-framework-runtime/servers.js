import { createServer } from 'node:http';
import express from 'express';
import Koa from 'koa';
import { bodyParser } from '@koa/bodyparser';
import Fastify from 'fastify';
import { Hono } from 'hono';
import { bodyLimit as honoBodyLimit } from 'hono/body-limit';
import { createAdaptorServer } from '@hono/node-server';

const bodyLimit = 16384;

async function listen(server) {
  server.requestTimeout = 5000;
  server.setTimeout(3000, (socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    root: `http://127.0.0.1:${server.address().port}`,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

const factories = {
  express: (handler) => {
    const app = express();
    app.use(express.json({ limit: bodyLimit }));
    app.post('/hook', handler);
    app.use((error, _request, response, next) => {
      if (response.headersSent) {
        return next(error);
      }
      response.status(error.status ?? 500).json({ error: error.message });
    });
    return listen(createServer(app));
  },
  koa: (handler) => {
    const app = new Koa();
    app.use(async (context, next) => {
      try {
        await next();
      } catch (error) {
        context.status = error.status ?? 500;
        context.body = { error: error.message };
      }
    });
    app.use(bodyParser({ jsonLimit: bodyLimit }));
    app.use(handler);
    return listen(createServer(app.callback()));
  },
  fastify: async (handler) => {
    const app = Fastify({
      logger: false,
      bodyLimit,
      requestTimeout: 5000,
      connectionTimeout: 3000,
      keepAliveTimeout: 1000,
    });
    app.post('/hook', handler);
    await app.listen({ host: '127.0.0.1', port: 0 });
    return {
      root: `http://127.0.0.1:${app.server.address().port}`,
      close: () => app.close(),
    };
  },
  hono: (handler) => {
    const app = new Hono();
    app.onError((error, context) =>
      context.json({ error: error.message }, error.status ?? 500)
    );
    app.post('/hook', honoBodyLimit({ maxSize: bodyLimit }), handler);
    return listen(createAdaptorServer({ fetch: app.fetch }));
  },
};

export const frameworks = Object.keys(factories);

/** Real framework listeners; every test owns and closes its local server. */
export function frameworkServer(name, handler) {
  let requests = 0;
  return factories[name]((...args) => {
    if (++requests > 32) {
      throw new RangeError('Framework fixture exceeds request limit');
    }
    return handler(...args);
  });
}
