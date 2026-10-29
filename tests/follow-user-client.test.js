import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Anygram, createAdapter, createClient, Session } from '../src/index.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const migration = () => import('../examples/telegram-user-client.js');
const authorized = (byte) =>
  new Session({ dc: 2, authKey: Buffer.alloc(256, byte) });
async function temporary(task) {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-follow-user-'));
  try {
    await task(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
function fake(options, events, session = () => authorized(2).save()) {
  return new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          start: async (login) => {
            events.push('start');
            await login.phoneNumber();
          },
          saveSession: session,
          disconnect: async () => events.push('disconnect'),
          destroy: async () => events.push('destroy'),
          call: async () => [
            { _: 'user', id: 7n, self: true, first_name: 'Ada' },
          ],
        },
        { kind: 'mtproto' }
      ),
    ],
    backend: options.backend,
  });
}
const application = {
  apiId: 777,
  apiHash: 'a'.repeat(32),
  phone: '+15550000000',
};

it('keeps the original synchronous constructor lazy and maps explicit options over environment values', async () => {
  const { TelegramUserClient } = await migration();
  await temporary(async (directory) => {
    const envFile = join(directory, '.env');
    await writeFile(envFile, '# keep\nOTHER=yes\n');
    const events = [];
    const factories = [];
    const Api = { name: 'injected schema' };
    const bridge = new TelegramUserClient({
      ...application,
      Api,
      envFile,
      session: authorized(1).save('gramjs'),
      env: {
        TELEGRAM_USER_BOT_API_ID: '123',
        TELEGRAM_USER_BOT_API_HASH: 'b'.repeat(32),
        TELEGRAM_USER_BOT_PHONE: '+10000000000',
      },
      prompt: () => assert.fail('Explicit login prompted'),
      factory: async (options) => {
        factories.push({
          ...options,
          saved: await options.sessionStore.load(),
        });
        return fake(options, events);
      },
    });
    assert.equal(factories.length, 0);
    assert.equal(bridge.client, null);
    assert.equal(
      await bridge.withConnection(async (view, namespace) => {
        assert.equal(view, bridge.client);
        assert.equal(namespace, Api);
        assert.equal((await bridge.getMe()).firstName, 'Ada');
        assert.equal(
          parseEnv(await readFile(envFile, 'utf8')).TELEGRAM_USER_SESSION,
          authorized(2).save('gramjs')
        );
        return 42;
      }),
      42
    );
    assert.equal(factories[0].apiId, 777);
    assert.equal(factories[0].apiHash, application.apiHash);
    assert.equal(factories[0].saved, authorized(1).save('gramjs'));
    assert.equal(bridge.phone, application.phone);
    assert.equal(bridge.session, authorized(2).save('gramjs'));
    assert.equal(bridge.client, null);
    await bridge.connect();
    assert.equal(factories.length, 2);
    assert.equal(factories[1].saved, authorized(2).save('gramjs'));
    await bridge.disconnect();
    assert.deepEqual(events, [
      'start',
      'disconnect',
      'destroy',
      'start',
      'disconnect',
      'destroy',
    ]);
    assert((await readFile(envFile, 'utf8')).startsWith('# keep\nOTHER=yes\n'));
  });
});

it('loads legacy environment keys, exports explicit sessions and persists before returning connection readiness', async () => {
  const { TelegramUserClient } = await migration();
  await temporary(async (directory) => {
    const envFile = join(directory, '.env');
    await writeFile(
      envFile,
      `TELEGRAM_USER_BOT_API_ID=777\nTELEGRAM_USER_BOT_API_HASH=${application.apiHash}\nTELEGRAM_USER_BOT_PHONE=${application.phone}\nTELEGRAM_USER_SESSION=${authorized(1).save('gramjs')}\n`
    );
    const events = [];
    let version = 2;
    const bridge = new TelegramUserClient({
      envFile,
      env: {},
      factory: async (options) => {
        assert.equal(options.apiId, 777);
        assert.equal(options.apiHash, application.apiHash);
        return fake(options, events, () => authorized(version).save());
      },
      prompt: () => assert.fail('Configured phone prompted'),
    });
    await assert.rejects(bridge.saveSession(), /not connected/);
    const view = await bridge.connect();
    try {
      assert.equal(view, bridge.client);
      assert.equal(bridge.session, authorized(2).save('gramjs'));
      assert.equal(bridge.apiId, 777);
      assert.equal(bridge.apiHash, application.apiHash);
      version = 3;
      assert.equal(await bridge.saveSession(), authorized(3).save('gramjs'));
      assert.equal(
        parseEnv(await readFile(envFile, 'utf8')).TELEGRAM_USER_SESSION,
        bridge.session
      );
    } finally {
      await bridge.disconnect();
    }
  });
});

it('keeps session failures visible, withholds application work and cleans partially started legacy clients', async () => {
  const { TelegramUserClient } = await migration();
  const failure = new Error('legacy session write failed');
  const events = [];
  const bridge = new TelegramUserClient({
    ...application,
    envFile: false,
    env: {},
    sessionStore: {
      load: async () => '',
      save: async () => {
        throw failure;
      },
    },
    factory: async (options) => fake(options, events),
  });
  await assert.rejects(
    bridge.withConnection(() => assert.fail('Work without saved session')),
    (error) => error === failure
  );
  assert.deepEqual(events, ['start', 'disconnect', 'destroy']);
  assert.equal(bridge.session, '');
  assert.equal(bridge.client, null);
  await bridge.disconnect();
});

it('uses one secret-aware prompt path for initial credentials and cancels before opening any client', async () => {
  const { TelegramUserClient } = await migration();
  const questions = [];
  const events = [];
  const bridge = new TelegramUserClient({
    envFile: false,
    env: {},
    prompt: async (name, { secret }) => {
      questions.push([name, secret]);
      return {
        apiId: '777',
        apiHash: application.apiHash,
        phoneNumber: application.phone,
      }[name];
    },
    factory: async (options) => fake(options, events),
  });
  await bridge.connect();
  await bridge.disconnect();
  assert.deepEqual(questions, [
    ['apiId', false],
    ['apiHash', true],
    ['phoneNumber', false],
  ]);
  const controller = new globalThis.AbortController();
  controller.abort(new Error('legacy cancelled'));
  const stopped = new TelegramUserClient({
    ...application,
    envFile: false,
    env: {},
    signal: controller.signal,
    factory: () => assert.fail('Cancelled legacy factory ran'),
  });
  await assert.rejects(stopped.connect(), /legacy cancelled/);
  await stopped.disconnect();
});

it('supports native account login reuse and direct legacy client access over encrypted TCP', async () => {
  const { TelegramUserClient } = await migration();
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'users.getUsers');
    return [{ _: 'user', id: 7n, self: true, first_name: 'Ada' }];
  });
  try {
    await temporary(async (directory) => {
      const envFile = join(directory, '.env');
      const bridge = new TelegramUserClient({
        ...application,
        envFile,
        env: {},
        factory: async (options) => {
          peer.client.apiHash = options.apiHash;
          return new Anygram({
            adapters: [
              createAdapter('native', peer.client, { kind: 'mtproto' }),
            ],
          });
        },
        prompt: () => assert.fail('Authorized native account prompted'),
      });
      await bridge.connect();
      try {
        assert.equal((await bridge.client.getMe()).firstName, 'Ada');
        assert.deepEqual(
          new Session(
            parseEnv(await readFile(envFile, 'utf8')).TELEGRAM_USER_SESSION
          ).options().authKey,
          peer.client.cipher.authKey
        );
      } finally {
        await bridge.disconnect();
      }
      assert.equal(peer.client.transport.closed, true);
    });
  } finally {
    await peer.close();
  }
});

for (const backend of ['gramjs', 'teleproto']) {
  it(`provides the actual ${backend} schema namespace and reusable legacy session format`, async () => {
    const { TelegramUserClient } = await migration();
    const saved = [];
    const events = [];
    const bridge = new TelegramUserClient({
      ...application,
      envFile: false,
      env: {},
      backend,
      session: authorized(1).save('gramjs'),
      sessionStore: {
        load: async () => '',
        save: async (value) => saved.push(value),
      },
      factory: async (options) => {
        const client = await createClient(options);
        const real = client.backend();
        real.start = async () => events.push('start');
        real.disconnect = async () => events.push('disconnect');
        real.destroy = async () => events.push('destroy');
        real.invoke = async (request) => {
          assert(request.getBytes().length > 4);
          return [];
        };
        return client;
      },
    });
    await bridge.withConnection(async (view, Api) => {
      assert.equal(view, bridge.client);
      assert.equal(
        Api,
        (await import(backend === 'gramjs' ? 'telegram' : 'teleproto')).Api
      );
      await view.invoke(new Api.users.GetUsers({ id: [] }));
      assert.equal(await bridge.saveSession(), bridge.session);
    });
    assert.equal(saved.length, 1);
    assert(saved[0].startsWith('1'));
    assert.deepEqual(
      new Session(saved[0]).options().authKey,
      authorized(1).options().authKey
    );
    assert.deepEqual(events, ['start', 'disconnect', 'destroy']);
  });
}

it('reads explicit credential and phone property changes when opening a later connection', async () => {
  const { TelegramUserClient } = await migration();
  const seen = [];
  const bridge = new TelegramUserClient({
    ...application,
    envFile: false,
    env: {},
    factory: async (options) => {
      seen.push([options.apiId, options.apiHash]);
      return new Anygram({
        adapters: [
          createAdapter(
            'native',
            {
              start: async (login) => seen.push(await login.phoneNumber()),
              saveSession: () => authorized(1).save(),
              disconnect: async () => {},
            },
            { kind: 'mtproto' }
          ),
        ],
      });
    },
  });
  bridge.apiId = 888;
  bridge.apiHash = 'b'.repeat(32);
  bridge.phone = '+15551111111';
  await bridge.connect();
  await bridge.disconnect();
  assert.deepEqual(seen, [[888, 'b'.repeat(32)], '+15551111111']);
});

it('retains parent-scope cancellation when a separate constructor signal is supplied', async () => {
  const { TelegramUserClient } = await migration();
  const parent = new globalThis.AbortController();
  const child = new globalThis.AbortController();
  const reason = new Error('parent stopped legacy account');
  parent.abort(reason);
  const bridge = new TelegramUserClient({
    ...application,
    envFile: false,
    env: {},
    scope: { signal: parent.signal },
    signal: child.signal,
    factory: () => assert.fail('Parent cancellation bypassed'),
  });
  await assert.rejects(bridge.connect(), (error) => error === reason);
  await bridge.disconnect();
});
