import { botTextParams } from './formatting.js';

// grammY's raw zero-payload methods bind {} and accept only a signal.
export const botNoPayloadMethods = new Set([
  'getMe',
  'getWebhookInfo',
  'getForumTopicIconStickers',
  'getAvailableGifts',
  'logOut',
  'close',
  'getMyStarBalance',
  'removeMyProfilePhoto',
]);

export function isBotSignal(value) {
  return (
    typeof value?.aborted === 'boolean' &&
    typeof value.addEventListener === 'function'
  );
}

export const botRequestOptions = (options) =>
  isBotSignal(options) ? { signal: options } : options;

export function callBotOperation(api, method, params, options, signal) {
  const {
    signal: embedded,
    timeout,
    ...fields
  } = botRequestOptions(options) ?? {};
  const request = {
    ...((signal ?? embedded) !== undefined && { signal: signal ?? embedded }),
    ...(timeout !== undefined && { timeout }),
  };
  return api.callApi(
    method,
    botTextParams({ ...fields, ...params }),
    Object.keys(request).length ? request : undefined
  );
}

/** Canonical operations share one translation across every Bot API transport. */
export class BotOperations {
  constructor(callApi) {
    if (callApi) {
      this.callApi = callApi;
    }
  }

  getMe(options) {
    return callBotOperation(this, 'getMe', {}, options);
  }

  sendMessage(chat, text, options) {
    return callBotOperation(
      this,
      'sendMessage',
      { chat_id: chat, text },
      options
    );
  }

  editMessage(chat, { id, text, ...options }) {
    return callBotOperation(
      this,
      'editMessageText',
      { chat_id: chat, message_id: id, text },
      options
    );
  }

  deleteMessages(chat, ids, options) {
    return callBotOperation(
      this,
      'deleteMessages',
      { chat_id: chat, message_ids: ids },
      options
    );
  }

  forwardMessages(chat, { fromPeer, messages, ...options }) {
    return callBotOperation(
      this,
      'forwardMessages',
      { chat_id: chat, from_chat_id: fromPeer, message_ids: messages },
      options
    );
  }

  sendFile(chat, { file, caption, ...options }) {
    return callBotOperation(
      this,
      'sendDocument',
      { chat_id: chat, document: file, caption },
      options
    );
  }
}
