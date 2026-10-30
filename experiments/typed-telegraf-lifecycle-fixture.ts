// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import { Context as SDKContext } from 'telegraf';
import { Telegraf } from 'telegraf';
import type { Context } from 'telegraf';
interface AppContext extends Context {
  application: string;
}
declare const contextType: new (
  update: Context['update'],
  telegram: Context['telegram'],
  botInfo: NonNullable<Context['botInfo']>
) => AppContext;
const bot = new Telegraf<AppContext>('123:typed', {
  contextType,
  handlerTimeout: 1500,
});
bot.context.application = 'application';
bot.webhookReply = false;
bot.webhookFilter = function (request) {
  return (
    request.method === 'POST' &&
    request.url === this.path &&
    this.hookPath === this.path
  );
};
const callback = bot.webhookCallback('/updates', { secretToken: 'secret' });
declare const request: Parameters<typeof callback>[0];
declare const response: Parameters<typeof callback>[1];
void callback(request, response, () => {});
void bot.createWebhook({
  domain: 'example.org',
  path: '/updates',
  secret_token: 'secret',
  max_connections: 4,
});
void bot.launch(
  {
    dropPendingUpdates: true,
    allowedUpdates: ['message'],
    webhook: {
      domain: 'example.org',
      path: '/updates',
      host: '127.0.0.1',
      port: 8443,
      secretToken: 'secret',
      maxConnections: 4,
      ipAddress: '127.0.0.1',
      cb(_request, response) {
        response.writeHead(404).end();
      },
    },
  },
  () => {}
);
void bot.launch(() => {});
bot.stop('shutdown');
const secret: string = bot.secretPathComponent();
void secret;
// @ts-expect-error Invalid path type.
bot.webhookCallback(42);
// @ts-expect-error Invalid token type.
bot.webhookCallback('/updates', { secretToken: 42 });
// @ts-expect-error Registration requires a domain.
void bot.createWebhook({ path: '/updates' });
// @ts-expect-error Invalid port type.
void bot.launch({ webhook: { domain: 'example.org', port: '8443' } });
// @ts-expect-error Invalid custom context type.
new Telegraf('123:typed', { contextType: class {} });

// @ts-expect-error Unknown update type.
void bot.launch({ allowedUpdates: ['unknown_update'] });

class ApplicationContext extends SDKContext {
  application = 'shared';
}
const constructed = new Telegraf('123:typed', {
  contextType: ApplicationContext,
});
constructed.use((ctx) => {
  const application: string = ctx.application;
  void application;
});
