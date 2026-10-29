import { TelegramError, botApiError } from './errors.js';
import { methodProxy } from './requests.js';
import { botTextParams } from './formatting.js';
import { uploadBody } from './bot-api-upload.js';
import { BotOperations } from './bot-operations.js';
import {
  readResponseBytes,
  createRequestScope,
  validateByteLimit,
  validateTimeout,
} from './http.js';

export { stringify } from './bot-api-upload.js';

/** Dependency-free transport for every Bot API method, including local servers. */
export class BotApi extends BotOperations {
  #token;
  constructor({
    token,
    baseUrl = 'https://api.telegram.org',
    apiMode = 'bot',
    testEnv = false,
    fetch: fetcher = globalThis.fetch,
    timeout = 30000,
    maxResponseBytes = 8 * 1024 * 1024,
    maxUploadBytes = 64 * 1024 * 1024,
    fileOptions,
  } = {}) {
    super(undefined, {
      token,
      apiRoot: baseUrl,
      apiMode,
      testEnv,
      ...fileOptions,
    });
    if (typeof token !== 'string' || !token || /[\s/?#]/.test(token)) {
      throw new TypeError('A bot token without URL delimiters is required');
    }
    if (!['bot', 'user'].includes(apiMode) || typeof testEnv !== 'boolean') {
      throw new TypeError('Invalid Bot API mode or environment');
    }
    validateTimeout(timeout);
    validateByteLimit(maxResponseBytes);
    validateByteLimit(maxUploadBytes);
    this.#token = token;
    this.apiMode = apiMode;
    this.testEnv = testEnv;
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
    const scope = createRequestScope(
      { signal, timeout },
      new TelegramError('Bot API request timed out', { type: 'NETWORK_ERROR' })
    );
    const { controller, signal: combined } = scope;
    try {
      combined.throwIfAborted();
      const prepared =
        typeof options === 'function' ? await options(combined) : options;
      combined.throwIfAborted();
      try {
        const response = await this.fetch(`${this.baseUrl}/${path}`, {
          ...prepared,
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
      }
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
      `${this.apiMode}${this.#token}${this.testEnv ? '/test' : ''}/${method}`,
      async (signal) => ({
        method: 'POST',
        ...(await uploadBody(botTextParams(params), {
          maxBytes: this.maxUploadBytes,
          signal,
          fetch: this.fetch,
        })),
      }),
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
      `file/${this.apiMode}${this.#token}${this.testEnv ? '/test' : ''}/${file.file_path}`,
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
