import { Bot } from '../src/index.js';

const bot = new Bot('123:example', {
  client: { canUseWebhookReply: (method) => method === 'sendMessage' },
});
void bot.handleUpdate(
  { update_id: 1 },
  {
    send: async (payload: string) => {
      JSON.parse(payload);
    },
  }
);
// @ts-expect-error An envelope sends serialized JSON text.
void bot.handleUpdate({ update_id: 2 }, { send: (payload: number) => payload });
new Bot('123:example', {
  // @ts-expect-error Webhook policy must return a boolean synchronously.
  client: { canUseWebhookReply: async () => true },
});
