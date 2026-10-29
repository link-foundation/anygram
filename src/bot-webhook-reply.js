import { botApi } from './bot-context.js';
import { inheritTelegramMetadata } from './telegraf-api.js';
import { collectUploads, stringify } from './bot-api-upload.js';

const telegrafReplies = new Set([
  'answerCallbackQuery',
  'answerInlineQuery',
  'deleteMessage',
  'leaveChat',
  'sendChatAction',
]);

/** A response belongs to one update and can accept at most one JSON operation. */
export function webhookReplyScope(
  api,
  telegram,
  response,
  canUse = () => false
) {
  if (!response) {
    return { api, telegram, close() {} };
  }
  let active = true;
  let claimed = false;
  const canSend =
    typeof response.send === 'function' || typeof response.end === 'function';
  const send =
    typeof response.send === 'function'
      ? (payload) => response.send(payload)
      : (payload) => {
          response.setHeader('content-type', 'application/json');
          return response.end(payload);
        };
  const scoped = (base, style) => {
    const callApi = async (method, params, options) => {
      const available =
        canSend &&
        active &&
        !claimed &&
        !response.writableEnded &&
        !response.headersSent;
      if (available && !collectUploads(params).files.length) {
        const permitted =
          style === 'grammy'
            ? canUse(method)
            : facade.webhookReply && telegrafReplies.has(method);
        if (permitted) {
          claimed = true;
          await send(stringify({ ...params, method }));
          return true;
        }
      }
      return base.callApi(method, params, options);
    };
    let facade = botApi(
      { callApi, getFileLink: (...args) => base.getFileLink(...args) },
      style
    );
    if (style === 'telegraf') {
      facade.webhookReply = base.webhookReply;
      facade = inheritTelegramMetadata(facade, base, response);
    }
    return facade;
  };
  return {
    api: scoped(api, 'grammy'),
    telegram: scoped(telegram, 'telegraf'),
    close() {
      active = false;
      if (typeof response.end === 'function' && !response.writableEnded) {
        response.end();
      }
    },
  };
}
