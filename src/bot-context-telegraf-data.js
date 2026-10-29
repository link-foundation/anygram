import { MessageReactions } from './bot-reactions.js';

export function installTelegrafData(Type) {
  const getters = {
    tg: (ctx) => ctx.telegram,
    passportData: (ctx) => ctx.message?.passport_data,
    webAppData(ctx) {
      if (!ctx.message || !('web_app_data' in ctx.message)) {
        return undefined;
      }
      const { data, button_text } = ctx.message.web_app_data;
      return {
        data: { json: () => JSON.parse(data), text: () => data },
        button_text,
      };
    },
    reactions: (ctx) => MessageReactions.from(ctx),
  };
  const descriptors = Object.fromEntries(
    Object.entries(getters).map(([name, resolve]) => [
      name,
      {
        configurable: true,
        get() {
          return resolve(this);
        },
      },
    ])
  );
  descriptors.webhookReply = {
    configurable: true,
    get() {
      return this.telegram.webhookReply;
    },
    set(enabled) {
      this.telegram.webhookReply = enabled;
    },
  };
  Object.defineProperties(Type.prototype, descriptors);
}
