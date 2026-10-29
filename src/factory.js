import { Anygram } from './client.js';
import { createAdapter } from './adapters.js';
import { BotApi } from './bot-api.js';
import { UnsupportedError } from './errors.js';
import { Session } from './session.js';

function botFileOptions(name, token, options, override) {
  const config =
    name === 'telegraf'
      ? (options.telegram ?? {})
      : name === 'grammy'
        ? (options.client ?? {})
        : options;
  if (config.buildUrl && !override) {
    return undefined;
  }
  const apiRoot = config.apiRoot ?? 'https://api.telegram.org';
  return {
    token,
    apiRoot:
      name === 'telegraf' ? new globalThis.URL('.', apiRoot).href : apiRoot,
    apiMode: config.apiMode,
    testEnv: config.testEnv ?? config.environment === 'test',
    ...override,
  };
}

async function optionalLibrary(name, options) {
  const { apiId, apiHash, token, session, clientOptions = {} } = options;
  if (name === 'gramjs' || name === 'teleproto') {
    const module = await import(name === 'gramjs' ? 'telegram' : 'teleproto');
    const backendSession =
      session instanceof module.sessions.Session
        ? session
        : new module.sessions.StringSession(
            new Session(session ?? {}).save('gramjs')
          );
    await backendSession.load();
    return createAdapter(
      name,
      new module.TelegramClient(backendSession, apiId, apiHash, {
        deviceModel: 'Anygram',
        systemVersion: 'JavaScript',
        ...clientOptions,
      }),
      { Api: module.Api, onSession: options.onSession }
    );
  }
  if (name === 'mtcute') {
    const { TelegramClient } = await import('@mtcute/node');
    return createAdapter(
      name,
      new TelegramClient({ apiId, apiHash, ...clientOptions })
    );
  }
  if (name === 'mtproto') {
    const { default: MTProto } = await import('@mtproto/core');
    return createAdapter(
      name,
      new MTProto({ api_id: apiId, api_hash: apiHash, ...clientOptions })
    );
  }
  if (['grammy', 'telegraf', 'node-telegram-bot-api'].includes(name)) {
    const module = await import(name);
    const Constructor = module.Bot ?? module.Telegraf;
    return createAdapter(name, new Constructor(token, clientOptions), {
      maxUploadBytes: options.maxUploadBytes,
      timeout: options.timeout,
      fetch: options.fetch,
      fileOptions: botFileOptions(
        name,
        token,
        clientOptions,
        options.fileOptions
      ),
    });
  }
  throw new UnsupportedError(
    `Automatic construction for ${name}; pass an initialized adapter`
  );
}

/** Creates no network connections until the caller invokes an operation. */
export async function createClient(options = {}) {
  const {
    adapters = [],
    libraries = [],
    native = true,
    backend,
    debug,
    token,
  } = options;
  const savedSession = options.session ?? (await options.sessionStore?.load());
  const nativeOptions = {
    ...options,
    onSession: async (session) => {
      await options.sessionStore?.save(session);
      await options.onSession?.(session);
    },
  };
  const available = [...adapters];
  for (const library of libraries) {
    try {
      available.push(
        await optionalLibrary(library, {
          ...nativeOptions,
          session: savedSession,
        })
      );
    } catch (error) {
      const missing = ['ERR_MODULE_NOT_FOUND', 'MODULE_NOT_FOUND'].includes(
        error.code
      );
      if (!missing || backend === library) {
        throw error;
      }
    }
  }
  if (native) {
    if (token) {
      available.push(
        createAdapter('native', new BotApi(options), { kind: 'bot' })
      );
    } else {
      const { Mtproto } = await import('./mtproto.js');
      available.push(
        createAdapter(
          'native',
          new Mtproto({
            ...nativeOptions,
            ...(savedSession ? new Session(savedSession).options() : {}),
          }),
          { kind: 'mtproto' }
        )
      );
    }
  }
  if (!available.length) {
    throw new UnsupportedError('No enabled Telegram backends');
  }
  return new Anygram({ adapters: available, backend, debug });
}
