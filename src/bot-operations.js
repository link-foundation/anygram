import { botTextParams } from './formatting.js';
import { UnsupportedError } from './errors.js';

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
  #fileOptions;
  constructor(callApi, fileOptions) {
    if (callApi) {
      this.callApi = callApi;
    }
    this.#fileOptions = fileOptions;
  }

  async getFileLink(file, options) {
    options = botRequestOptions(options);
    options?.signal?.throwIfAborted();
    const config = this.#fileOptions;
    if (!config?.token || !config.apiRoot) {
      throw new UnsupportedError(
        'Bot file links require explicit server/token configuration'
      );
    }
    if (typeof file === 'string' || file.file_path === undefined) {
      file = await callBotOperation(
        this,
        'getFile',
        { file_id: typeof file === 'string' ? file : file.file_id },
        options
      );
    }
    if (
      typeof file.file_path === 'string' &&
      /^(?:\/|[A-Za-z]:[\\/])/.test(file.file_path)
    ) {
      const url = new globalThis.URL(config.apiRoot);
      url.port = '';
      url.pathname = file.file_path;
      url.protocol = 'file:';
      return url;
    }
    const mode = config.apiMode ?? 'bot';
    const test = config.testEnv ? '/test' : '';
    return new globalThis.URL(
      `./file/${mode}${config.token}${test}/${file.file_path}`,
      `${config.apiRoot.replace(/\/$/, '')}/`
    );
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
