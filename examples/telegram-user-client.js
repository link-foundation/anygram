import { createClient, Session, Api } from '../src/index.js';
import { FileSessionStore } from '../src/storage.js';
import { FollowClient } from './follow-client.js';
import { createFollowAccount } from './follow-account.js';
import { FollowEnvironmentSessionStore } from './follow-environment.js';
import { terminalPrompt } from './follow-prompt.js';

function environment(options) {
  const values = { ...(options.env ?? process.env) };
  for (const [option, key] of [
    ['apiId', 'TELEGRAM_USER_BOT_API_ID'],
    ['apiHash', 'TELEGRAM_USER_BOT_API_HASH'],
    ['phone', 'TELEGRAM_USER_BOT_PHONE'],
    ['session', 'TELEGRAM_USER_SESSION'],
  ]) {
    if (options[option] !== undefined) {
      values[key] = String(options[option]);
    }
  }
  return values;
}

function sessionStore(options, owner) {
  const store =
    options.sessionStore ??
    (options.sessionPath
      ? new FileSessionStore(options.sessionPath, { maxBytes: 8192 })
      : options.envFile === false
        ? { load: () => '', save: () => {} }
        : new FollowEnvironmentSessionStore(options.envFile));
  return {
    async load() {
      owner.session ||= await store.load();
      return owner.session;
    },
    async save(value) {
      const session = new Session(value).save('gramjs');
      await store.save(session);
      owner.session = session;
    },
  };
}

/** Follow's original constructor/helper names over the shared account pipeline. */
export class TelegramUserClient extends FollowClient {
  constructor(options = {}) {
    const env = environment(options);
    const scope = {
      ...options.scope,
      signal:
        options.signal && options.scope?.signal
          ? globalThis.AbortSignal.any([options.scope.signal, options.signal])
          : (options.signal ?? options.scope?.signal),
    };
    super(
      {
        async withConnection(task, connection) {
          const configured = await createFollowAccount({
            ...options,
            env: environment({
              env,
              apiId: owner.apiId === '' ? undefined : owner.apiId,
              apiHash: owner.apiHash || undefined,
              phone: owner.phone || undefined,
              session: owner.session || undefined,
            }),
            signal: connection.signal,
            prompt: options.prompt ?? terminalPrompt,
            sessionStore: owner.persistence,
            factory: async (input) => {
              owner.apiId = input.apiId;
              owner.apiHash = input.apiHash;
              return await (options.factory ?? createClient)(input);
            },
          });
          owner.configured = configured;
          const phoneNumber = configured.scope.start.phoneNumber;
          configured.scope.start.phoneNumber = async () => {
            owner.phone = await phoneNumber();
            return owner.phone;
          };
          if (
            !options.Api &&
            ['gramjs', 'teleproto'].includes(options.backend)
          ) {
            owner.Api = (
              await import(
                options.backend === 'gramjs' ? 'telegram' : 'teleproto'
              )
            ).Api;
          }
          return await configured.run(task, connection);
        },
      },
      { Api: options.Api ?? Api, scope }
    );
    const owner = this;
    this.apiId = env.TELEGRAM_USER_BOT_API_ID ?? '';
    this.apiHash = env.TELEGRAM_USER_BOT_API_HASH ?? '';
    this.phone = env.TELEGRAM_USER_BOT_PHONE ?? '';
    this.session = env.TELEGRAM_USER_SESSION ?? '';
    this.persistence = sessionStore(options, this);
    this.configured = null;
  }

  async saveSession() {
    const connected = this.active();
    await this.configured.saveSession(connected);
    return this.session;
  }
}

export default TelegramUserClient;
