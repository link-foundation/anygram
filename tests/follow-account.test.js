import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Anygram, createAdapter, createClient, Session } from '../src/index.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const account = () => import('../examples/follow-account.js');
const credentials = {
  TELEGRAM_USER_BOT_API_ID: '777',
  TELEGRAM_USER_BOT_API_HASH: 'a'.repeat(32),
};
async function temporary(task) {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-follow-account-'));
  try {
    await task(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

it('loads existing follow environment names without mutating process environment and prefers explicit environment', async () => {
  const { createFollowAccount } = await account();
  const previousSession = process.env.TELEGRAM_USER_SESSION;
  await temporary(async (directory) => {
    const envFile = join(directory, '.env');
    const sessionPath = join(directory, 'session');
    const original = `# unchanged configuration\nTELEGRAM_USER_BOT_API_ID=123\nTELEGRAM_USER_BOT_API_HASH="${'b'.repeat(
      32
    )}"\nTELEGRAM_USER_SESSION=legacy-session\n`;
    await writeFile(envFile, original);
    let options;
    await createFollowAccount({
      envFile,
      sessionPath,
      env: { TELEGRAM_USER_BOT_API_ID: '777' },
      factory: async (value) => {
        options = value;
        return {};
      },
      prompt: () => assert.fail('Configured credentials should not prompt'),
    });
    assert.equal(options.apiId, 777);
    assert.equal(options.apiHash, 'b'.repeat(32));
    assert.equal(await options.sessionStore.load(), 'legacy-session');
    assert.equal(await readFile(envFile, 'utf8'), original);
    assert.equal(process.env.TELEGRAM_USER_SESSION, previousSession);
    await writeFile(sessionPath, 'newer-saved-session');
    assert.equal(await options.sessionStore.load(), 'newer-saved-session');
  });
});

it('prompts for missing credentials once, keeps login prompts lazy, and hides password/hash prompts', async () => {
  const { createFollowAccount } = await account();
  await temporary(async (directory) => {
    const questions = [];
    let factoryOptions;
    const configured = await createFollowAccount({
      env: {},
      envFile: false,
      sessionPath: join(directory, 'session'),
      prompt: async (name, options) => {
        questions.push([name, options.secret]);
        return {
          apiId: '777',
          apiHash: 'a'.repeat(32),
          phoneNumber: '+123456789',
          phoneCode: '12345',
          password: 'private password',
          email: 'owner@example.com',
          emailCode: '123456',
        }[name];
      },
      factory: async (options) => {
        factoryOptions = options;
        return {};
      },
    });
    assert.equal(factoryOptions.apiId, 777);
    assert.deepEqual(questions, [
      ['apiId', false],
      ['apiHash', true],
    ]);
    for (const name of [
      'phoneNumber',
      'phoneCode',
      'password',
      'email',
      'emailCode',
    ]) {
      assert.equal(typeof (await configured.scope.start[name]()), 'string');
    }
    assert.deepEqual(questions.slice(2), [
      ['phoneNumber', false],
      ['phoneCode', true],
      ['password', true],
      ['email', false],
      ['emailCode', true],
    ]);
  });
});

it('rejects malformed credentials, unsupported CLI backends, and cancellation before constructing a client', async () => {
  const { createFollowAccount } = await account();
  const factory = () => assert.fail('Invalid input reached factory');
  for (const apiId of ['7x', '0', '-1', '2147483648']) {
    await assert.rejects(
      createFollowAccount({
        env: { ...credentials, TELEGRAM_USER_BOT_API_ID: apiId },
        envFile: false,
        factory,
      }),
      /API ID/
    );
  }
  await assert.rejects(
    createFollowAccount({
      env: { ...credentials, TELEGRAM_USER_BOT_API_HASH: 'bad' },
      envFile: false,
      factory,
    }),
    /API hash/
  );
  await assert.rejects(
    createFollowAccount({ backend: 'bot', envFile: false, factory }),
    /backend/
  );
  const controller = new globalThis.AbortController();
  controller.abort(new Error('cancel account'));
  await assert.rejects(
    createFollowAccount({
      env: credentials,
      envFile: false,
      signal: controller.signal,
      factory,
    }),
    /cancel account/
  );
});

it('saves a reused native account session before application work and awaits owned TCP cleanup', async () => {
  const { createFollowAccount } = await account();
  const calls = [];
  const peer = await secretRpcPeer((request) => {
    calls.push(request._);
    assert.equal(request._, 'users.getUsers');
    return [{ _: 'user', id: 7n, first_name: 'Owner', self: true }];
  });
  try {
    await temporary(async (directory) => {
      const sessionPath = join(directory, 'session');
      const configured = await createFollowAccount({
        env: credentials,
        envFile: false,
        sessionPath,
        prompt: () => assert.fail('Authorized account should not prompt'),
        factory: async (options) => {
          peer.client.apiHash = options.apiHash;
          return new Anygram({
            adapters: [
              createAdapter('native', peer.client, { kind: 'mtproto' }),
            ],
          });
        },
      });
      assert.equal(
        await configured.run(async () => {
          const saved = new Session(await readFile(sessionPath, 'utf8'));
          assert.deepEqual(saved.options().authKey, peer.client.cipher.authKey);
          return 'work completed';
        }),
        'work completed'
      );
      assert.deepEqual(calls, ['users.getUsers']);
      assert.equal(peer.client.transport.closed, true);
    });
  } finally {
    await peer.close();
  }
});

it('propagates session persistence failure before sending application requests and still cleans up', async () => {
  const { createFollowAccount } = await account();
  const closed = [];
  const failure = new Error('session disk full');
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          start: async () => {},
          saveSession: () => 'saved-session',
          disconnect: async () => closed.push('disconnect'),
          destroy: async () => closed.push('destroy'),
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  const configured = await createFollowAccount({
    env: credentials,
    envFile: false,
    sessionStore: {
      load: async () => '',
      save: async () => {
        throw failure;
      },
    },
    factory: async () => client,
  });
  await assert.rejects(
    configured.run(() => assert.fail('Work started without durable session')),
    (error) => error === failure
  );
  assert.deepEqual(closed, ['disconnect', 'destroy']);
});

it('retains cancelled login prompt errors and cleans up a partially started account without saving', async () => {
  const { createFollowAccount } = await account();
  const cancelled = new Error('prompt cancelled');
  const closed = [];
  const configured = await createFollowAccount({
    env: credentials,
    envFile: false,
    prompt: async () => {
      throw cancelled;
    },
    sessionStore: {
      load: async () => '',
      save: async () => assert.fail('Saved failed login'),
    },
    factory: async () =>
      new Anygram({
        adapters: [
          createAdapter(
            'native',
            {
              start: async (options) => {
                await options.phoneCode();
              },
              saveSession: () => 'unverified',
              disconnect: async () => closed.push('disconnect'),
            },
            { kind: 'mtproto' }
          ),
        ],
      }),
  });
  await assert.rejects(
    configured.run(() => assert.fail('Work after failed login')),
    /prompt cancelled/
  );
  assert.deepEqual(closed, ['disconnect']);
});

for (const backend of ['gramjs', 'teleproto']) {
  it(`constructs the actual ${backend} account and persists its portable session without prompting for an authorized login`, async () => {
    const { createFollowAccount } = await account();
    const original = new Session({ dc: 4, authKey: Buffer.alloc(256, 37) });
    const saved = [];
    const closed = [];
    const configured = await createFollowAccount({
      backend,
      env: credentials,
      envFile: false,
      prompt: () => assert.fail('Authorized account prompted'),
      sessionStore: {
        load: async () => original.save(),
        save: async (value) => saved.push(value),
      },
      factory: async (options) => {
        const client = await createClient(options);
        const vendor = client.backend();
        assert.equal(vendor.disconnected, true);
        assert.equal(vendor.session.dcId, 4);
        vendor.start = async () => ({ id: 7n });
        vendor.disconnect = async () => closed.push('disconnect');
        vendor.destroy = async () => closed.push('destroy');
        return client;
      },
    });
    await configured.run(async () => {
      assert.equal(saved.length, 1);
      assert.deepEqual(
        new Session(saved[0]).options().authKey,
        original.options().authKey
      );
    });
    assert.deepEqual(closed, ['disconnect', 'destroy']);
  });
}

it('withholds application work when cancellation arrives during authorized-session persistence', async () => {
  const { createFollowAccount } = await account();
  const parent = new globalThis.AbortController();
  const child = new globalThis.AbortController();
  const reason = new Error('cancel while saving account');
  const events = [];
  const configured = await createFollowAccount({
    env: credentials,
    envFile: false,
    signal: parent.signal,
    sessionStore: {
      load: () => '',
      save: () => {
        events.push('save');
        parent.abort(reason);
      },
    },
    factory: async () =>
      new Anygram({
        adapters: [
          createAdapter(
            'native',
            {
              start: async () => events.push('start'),
              saveSession: () => 'saved-session',
              disconnect: async () => events.push('disconnect'),
              destroy: async () => events.push('destroy'),
            },
            { kind: 'mtproto' }
          ),
        ],
      }),
  });
  await assert.rejects(
    configured.run(() => assert.fail('Cancelled account work ran'), {
      signal: child.signal,
      cleanupAttempts: 1,
    }),
    (error) => error === reason
  );
  assert.deepEqual(events, ['start', 'save', 'disconnect', 'destroy']);
});
