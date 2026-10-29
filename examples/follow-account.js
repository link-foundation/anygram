import { parseEnv } from 'node:util';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '../src/index.js';
import { FileSessionStore } from '../src/storage.js';
import { readFollowText } from './follow-input.js';

async function environment(path, overrides, signal) {
  let values = {};
  if (path !== false) {
    try {
      values = parseEnv(await readFollowText(path, signal));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
  return { ...values, ...overrides };
}

function questions(prompt, signal) {
  return async (name, secret = false) => {
    signal?.throwIfAborted();
    if (typeof prompt !== 'function') {
      throw new Error(
        `Missing ${name}; configure credentials or use an interactive terminal`
      );
    }
    const answer = await prompt(name, { secret, signal });
    signal?.throwIfAborted();
    if (typeof answer !== 'string' || !answer.trim()) {
      throw new TypeError(`Missing ${name}`);
    }
    return secret ? answer : answer.trim();
  };
}

async function credentials(env, ask) {
  const id = env.TELEGRAM_USER_BOT_API_ID || (await ask('apiId'));
  const apiId = Number(id);
  if (
    !/^\d+$/.test(id) ||
    !Number.isInteger(apiId) ||
    apiId < 1 ||
    apiId > 2147483647
  ) {
    throw new TypeError('Invalid Telegram API ID');
  }
  const apiHash =
    env.TELEGRAM_USER_BOT_API_HASH || (await ask('apiHash', true));
  if (!/^[a-fA-F0-9]{32}$/.test(apiHash)) {
    throw new TypeError('Invalid Telegram API hash');
  }
  return { apiId, apiHash };
}

function storage(store, fallback) {
  let lastSaved;
  return {
    async load() {
      return (await store.load()) || fallback || '';
    },
    async save(value) {
      if (typeof value !== 'string' || !value || value.length > 8192) {
        throw new TypeError('Invalid exported account session');
      }
      if (value !== lastSaved) {
        await store.save(value);
        lastSaved = value;
      }
    },
  };
}

async function saveAuthorized(client, store) {
  const backend = client.backend();
  const value =
    typeof backend.saveSession === 'function'
      ? await backend.saveSession()
      : await backend.session?.save();
  await store.save(value);
}

/** Existing follow environment names, portable storage and lazy login callbacks. */
export async function createFollowAccount({
  backend = 'native',
  env = process.env,
  envFile = '.env',
  sessionPath,
  sessionStore,
  prompt,
  signal,
  debug,
  factory = createClient,
} = {}) {
  signal?.throwIfAborted();
  if (!['native', 'gramjs', 'teleproto'].includes(backend)) {
    throw new TypeError('Unsupported follow CLI backend');
  }
  const values = await environment(envFile, env, signal);
  const ask = questions(prompt, signal);
  const application = await credentials(values, ask);
  const store = storage(
    sessionStore ??
      new FileSessionStore(
        sessionPath ?? join(homedir(), '.follow', 'telegram-session')
      ),
    values.TELEGRAM_USER_SESSION
  );
  const clientOptions = {};
  if (backend !== 'native') {
    const { Logger } = await import(
      backend === 'gramjs' ? 'telegram' : 'teleproto'
    );
    clientOptions.baseLogger = new Logger('none');
  }
  signal?.throwIfAborted();
  const client = await factory({
    ...application,
    backend,
    native: backend === 'native',
    libraries: backend === 'native' ? [] : [backend],
    clientOptions,
    sessionStore: store,
    debug,
  });
  const scope = {
    signal,
    start: {
      phoneNumber: async () =>
        values.TELEGRAM_USER_BOT_PHONE || (await ask('phoneNumber')),
      phoneCode: () => ask('phoneCode', true),
      password: () => ask('password', true),
      email: () => ask('email'),
      emailCode: () => ask('emailCode', true),
    },
  };
  return {
    client,
    scope,
    run(task) {
      if (typeof task !== 'function') {
        throw new TypeError('Expected account work callback');
      }
      return client.withConnection(async (connected) => {
        await saveAuthorized(connected, store);
        return await task(connected);
      }, scope);
    },
  };
}
