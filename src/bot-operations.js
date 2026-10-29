import { botTextParams } from './formatting.js';

function call(api, method, params, { signal, timeout, ...fields } = {}) {
  return api.callApi(method, botTextParams({ ...fields, ...params }), {
    signal,
    timeout,
  });
}

/** Canonical operations share one translation across every Bot API transport. */
export class BotOperations {
  constructor(callApi) {
    if (callApi) {
      this.callApi = callApi;
    }
  }

  getMe(options) {
    return call(this, 'getMe', {}, options);
  }

  sendMessage(chat, text, options) {
    return call(this, 'sendMessage', { chat_id: chat, text }, options);
  }

  editMessage(chat, { id, text, ...options }) {
    return call(
      this,
      'editMessageText',
      { chat_id: chat, message_id: id, text },
      options
    );
  }

  deleteMessages(chat, ids, options) {
    return call(
      this,
      'deleteMessages',
      { chat_id: chat, message_ids: ids },
      options
    );
  }

  forwardMessages(chat, { fromPeer, messages, ...options }) {
    return call(
      this,
      'forwardMessages',
      { chat_id: chat, from_chat_id: fromPeer, message_ids: messages },
      options
    );
  }

  sendFile(chat, { file, caption, ...options }) {
    return call(
      this,
      'sendDocument',
      { chat_id: chat, document: file, caption },
      options
    );
  }
}
