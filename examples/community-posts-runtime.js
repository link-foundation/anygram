import { createClient, TelegramBot } from '../src/index.js';
import { readTextFile } from '../src/storage.js';
import { abortable } from '../src/cancellation.js';
import { createRequestScope } from '../src/http.js';
import { createFollowAccount } from './follow-account.js';
import { createCommunityPosts } from './community-posts.js';

async function tokenValue(path, io) {
  const raw = await (io.readToken ?? readTextFile)(path, {
    maxBytes: 1024,
    signal: io.signal,
  });
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 1024) {
    throw new TypeError('Invalid community token file');
  }
  const token = raw.trim();
  if (!/^[0-9]{1,20}:[a-zA-Z0-9_-]{20,128}$/.test(token)) {
    throw new TypeError('Invalid community bot token');
  }
  return token;
}

/** Keep initialization and polling inside the application's cancellation scope. */
export async function createCommunityBot({
  token,
  backend,
  signal,
  ...options
}) {
  const client = await createClient({
    ...options,
    token,
    backend,
    libraries: backend === 'native' ? [] : [backend],
    native: backend === 'native',
  });
  return new TelegramBot(token, {
    api: {
      async callApi(method, params, request = {}) {
        const scope = createRequestScope({
          ...request,
          timeout: request.timeout ?? 30000,
          signal:
            signal && request.signal
              ? globalThis.AbortSignal.any([signal, request.signal])
              : (signal ?? request.signal),
        });
        try {
          scope.signal.throwIfAborted();
          return await abortable(
            client.callBotApi(method, params, {
              ...request,
              signal: scope.signal,
            }),
            scope.signal
          );
        } finally {
          scope.dispose();
        }
      },
    },
  });
}

function updateError(error, io) {
  io.signal?.throwIfAborted();
  const code = Number.isInteger(error.error_code)
    ? ` (${error.error_code})`
    : '';
  (io.writeError ?? ((value) => process.stderr.write(value)))(
    `Community update failed${code}; use /status or retry the input.\n`
  );
}

/** Own both transports until polling, callbacks and durable writes are drained. */
export async function runCommunityPosts(options, io = {}) {
  io.signal?.throwIfAborted();
  const token = await tokenValue(options.tokenFile, io);
  io.signal?.throwIfAborted();
  const bot = await (io.createBot ?? createCommunityBot)({
    ...io.botOptions,
    token,
    backend: options.botBackend,
    signal: io.signal,
  });
  const account = await (io.createAccount ?? createFollowAccount)({
    backend: options.accountBackend,
    env: io.env,
    envFile: options.envFile,
    sessionPath: options.sessionFile,
    prompt: io.prompt,
    signal: io.signal,
  });
  await account.run(async (client) => {
    const stop = () => bot.stop();
    let app;
    io.signal?.addEventListener('abort', stop, { once: true });
    try {
      io.signal?.throwIfAborted();
      app = await createCommunityPosts({
        bot,
        account: client,
        channelUsername: options.channel,
        store: io.store,
        signal: io.signal,
        onError: (error) => updateError(error, io),
      });
      await bot.startPolling(io.polling);
    } finally {
      bot.stop();
      await app?.close();
      await bot.stopPolling().catch(() => {});
      io.signal?.removeEventListener('abort', stop);
    }
  });
  return { exitCode: 0 };
}
