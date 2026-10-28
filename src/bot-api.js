import { TelegramError } from './errors.js';
import { methodProxy } from './requests.js';

export const stringify = (value) =>
  JSON.stringify(value, (key, entry) =>
    typeof entry === 'bigint' ? entry.toString() : entry
  );

function uploadBody(params) {
  const files = [];
  function visit(value) {
    if (
      value instanceof Uint8Array ||
      value instanceof globalThis.Blob ||
      value?.data instanceof Uint8Array
    ) {
      const name = `file${files.length}`;
      const data = value.data ?? value;
      const blob =
        data instanceof globalThis.Blob
          ? data
          : new globalThis.Blob([data], {
              type: value.mimeType ?? 'application/octet-stream',
            });
      files.push([name, blob, value.filename ?? 'file']);
      return `attach://${name}`;
    }
    if (Array.isArray(value)) {
      return value.map(visit);
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, entry]) => [key, visit(entry)])
      );
    }
    return value;
  }
  const fields = visit(params);
  if (!files.length) {
    return {
      body: stringify(fields),
      headers: { 'content-type': 'application/json' },
    };
  }
  const body = new globalThis.FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      body.append(
        key,
        typeof value === 'object' ? stringify(value) : String(value)
      );
    }
  }
  for (const [name, blob, filename] of files) {
    body.append(name, blob, filename);
  }
  return { body };
}

/** Dependency-free transport for every Bot API method, including local servers. */
export class BotApi {
  #token;
  constructor({
    token,
    baseUrl = 'https://api.telegram.org',
    fetch: fetcher = globalThis.fetch,
    timeout = 30000,
  } = {}) {
    if (typeof token !== 'string' || !token || /[\s/?#]/.test(token)) {
      throw new TypeError('A bot token without URL delimiters is required');
    }
    if (!Number.isFinite(timeout) || timeout <= 0) {
      throw new TypeError('timeout must be a positive finite number');
    }
    this.#token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetcher;
    this.timeout = timeout;
    this.api = methodProxy(this.callApi.bind(this));
  }

  async request(
    path,
    options = {},
    { signal, timeout = this.timeout } = {},
    consume
  ) {
    const controller = new globalThis.AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeout);
    try {
      const response = await this.fetch(`${this.baseUrl}/${path}`, {
        ...options,
        signal: signal
          ? globalThis.AbortSignal.any([signal, controller.signal])
          : controller.signal,
      });
      return await consume(response, controller.signal);
    } catch (error) {
      if (error instanceof TelegramError) {
        throw error;
      }
      // Fetch error messages often contain the entire credential-bearing URL.
      throw new TelegramError(
        signal?.aborted
          ? 'Bot API request cancelled'
          : controller.signal.aborted
            ? 'Bot API request timed out'
            : 'Bot API network request failed',
        { type: 'NETWORK_ERROR' }
      );
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async callApi(method, params = {}, options) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(method)) {
      throw new TypeError('Invalid Bot API method');
    }
    const { response, envelope } = await this.request(
      `bot${this.#token}/${method}`,
      { method: 'POST', ...uploadBody(params) },
      options,
      async (response, timeoutSignal) => {
        let envelope;
        try {
          envelope = await response.json();
        } catch (error) {
          if (timeoutSignal.aborted || options?.signal?.aborted) {
            throw error;
          }
          throw new TelegramError('Bot API returned invalid JSON', {
            code: response.status,
            type: 'INVALID_RESPONSE',
          });
        }
        return { response, envelope };
      }
    );
    if (envelope.ok !== true) {
      throw new TelegramError(
        String(envelope.description ?? 'Bot API request failed').replaceAll(
          this.#token,
          '[redacted]'
        ),
        {
          code: envelope.error_code ?? response.status,
          type: 'BOT_API_ERROR',
          retryAfter: envelope.parameters?.retry_after,
          migrateTo: envelope.parameters?.migrate_to_chat_id,
        }
      );
    }
    return envelope.result;
  }

  getMe(options) {
    return this.callApi('getMe', {}, options);
  }

  sendMessage(chat, text, options = {}) {
    return this.callApi('sendMessage', { ...options, chat_id: chat, text });
  }

  editMessage(chat, { id, text, ...options }) {
    return this.callApi('editMessageText', {
      ...options,
      chat_id: chat,
      message_id: id,
      text,
    });
  }

  deleteMessages(chat, ids) {
    return this.callApi('deleteMessages', { chat_id: chat, message_ids: ids });
  }

  forwardMessages(chat, { fromPeer, messages, ...options }) {
    return this.callApi('forwardMessages', {
      ...options,
      chat_id: chat,
      from_chat_id: fromPeer,
      message_ids: messages,
    });
  }

  sendFile(chat, { file, caption, ...options }) {
    return this.callApi('sendDocument', {
      ...options,
      chat_id: chat,
      document: file,
      caption,
    });
  }

  async downloadMedia(fileId, options) {
    const file = await this.callApi('getFile', { file_id: fileId }, options);
    if (
      !file.file_path ||
      file.file_path.split('/').includes('..') ||
      /^\w+:/.test(file.file_path)
    ) {
      throw new TelegramError('Invalid Bot API file path', {
        type: 'INVALID_RESPONSE',
      });
    }
    return this.request(
      `file/bot${this.#token}/${file.file_path}`,
      {},
      options,
      async (response) => {
        if (!response.ok) {
          throw new TelegramError('Bot API file download failed', {
            code: response.status,
          });
        }
        return new Uint8Array(await response.arrayBuffer());
      }
    );
  }
}
