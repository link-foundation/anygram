import { TelegramError, botApiError } from './errors.js';
import { methodProxy, valueMapper } from './requests.js';
import { botTextParams } from './formatting.js';
import {
  readResponseBytes,
  createRequestScope,
  validateByteLimit,
  validateTimeout,
} from './http.js';

export const stringify = (value) =>
  JSON.stringify(value, (key, entry) =>
    typeof entry === 'bigint' ? entry.toString() : entry
  );

function uploadPart(value, data) {
  const blob =
    data instanceof globalThis.Blob
      ? data
      : new globalThis.Blob([data], {
          type: value.mimeType ?? 'application/octet-stream',
        });
  return [blob, value.filename ?? data.name ?? 'file'];
}

function uploadBody(params, maxBytes) {
  validateByteLimit(maxBytes);
  const files = [];
  let used = 0;
  const visit = valueMapper(
    (value, next) => {
      const data = value?.data ?? value?.source ?? value;
      if (data instanceof Uint8Array || data instanceof globalThis.Blob) {
        const size = data instanceof Uint8Array ? data.byteLength : data.size;
        if (size > maxBytes - used) {
          throw new RangeError('Bot API upload exceeds byte limit');
        }
        if (files.length >= 1000) {
          throw new RangeError('Bot API upload exceeds file limit');
        }
        used += size;
        const name = `file${files.length}`;
        files.push([name, ...uploadPart(value, data)]);
        return `attach://${name}`;
      }
      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value).map(([key, entry]) => [key, next(entry)])
        );
      }
      return value;
    },
    { label: 'Bot API' }
  );
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
    maxResponseBytes = 8 * 1024 * 1024,
    maxUploadBytes = 64 * 1024 * 1024,
  } = {}) {
    if (typeof token !== 'string' || !token || /[\s/?#]/.test(token)) {
      throw new TypeError('A bot token without URL delimiters is required');
    }
    validateTimeout(timeout);
    validateByteLimit(maxResponseBytes);
    validateByteLimit(maxUploadBytes);
    this.#token = token;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetch = fetcher;
    this.timeout = timeout;
    this.maxResponseBytes = maxResponseBytes;
    this.maxUploadBytes = maxUploadBytes;
    this.api = methodProxy(this.callApi.bind(this));
  }

  async request(
    path,
    options = {},
    { signal, timeout = this.timeout } = {},
    consume
  ) {
    const scope = createRequestScope({ signal, timeout });
    const { controller, signal: combined } = scope;
    try {
      combined.throwIfAborted();
      const response = await this.fetch(`${this.baseUrl}/${path}`, {
        ...options,
        signal: combined,
      });
      return await consume(response, combined);
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
      scope.dispose();
    }
  }

  async callApi(method, params = {}, options) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(method)) {
      throw new TypeError('Invalid Bot API method');
    }
    options?.signal?.throwIfAborted();
    const { response, envelope } = await this.request(
      `bot${this.#token}/${method}`,
      {
        method: 'POST',
        ...uploadBody(botTextParams(params), this.maxUploadBytes),
      },
      options,
      async (response, signal) => {
        const bytes = await readResponseBytes(response, {
          maxBytes: this.maxResponseBytes,
          signal,
        });
        let envelope;
        try {
          envelope = JSON.parse(new globalThis.TextDecoder().decode(bytes));
        } catch {
          throw new TelegramError('Bot API returned invalid JSON', {
            code: response.status,
            type: 'INVALID_RESPONSE',
          });
        }
        return { response, envelope };
      }
    );
    if (!envelope || typeof envelope.ok !== 'boolean') {
      throw new TelegramError('Bot API returned an invalid envelope', {
        code: response.status,
        type: 'INVALID_RESPONSE',
      });
    }
    if (envelope.ok !== true) {
      throw botApiError(
        {
          ...envelope,
          error_code: envelope.error_code ?? response.status,
          description: String(
            envelope.description ?? 'Bot API request failed'
          ).replaceAll(this.#token, '[redacted]'),
        },
        { method }
      );
    }
    if (!response.ok) {
      throw new TelegramError(
        'Bot API returned success with a failed HTTP status',
        {
          code: response.status,
          type: 'INVALID_RESPONSE',
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

  async downloadMedia(fileId, options = {}) {
    const maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
    validateByteLimit(maxBytes);
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
      (response, signal) => {
        if (!response.ok) {
          response.body?.cancel().catch(() => {});
          throw new TelegramError('Bot API file download failed', {
            code: response.status,
          });
        }
        return readResponseBytes(response, { maxBytes, signal });
      }
    );
  }
}
