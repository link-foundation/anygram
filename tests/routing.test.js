import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  Anygram,
  createAdapter,
  UnsupportedError,
  TelegramError,
} from '../src/index.js';

describe('unified backend routing', () => {
  it('routes every raw style through the selected adapter', async () => {
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter('mtproto', {
          call: async (...args) => {
            calls.push(args);
            return { id: 9007199254740993n };
          },
        }),
      ],
    });
    for (const request of [
      () => client.invoke('help.getConfig', {}),
      () => client.call('help.getConfig', {}),
      () => client.mtcute.call({ _: 'help.getConfig' }),
      () => client.gramjs.invoke({ className: 'help.GetConfig' }),
      () => client.raw.help.getConfig({}),
    ]) {
      assert.equal((await request()).id, 9007199254740993n);
    }
    assert.equal(calls.length, 5);
    assert(calls.every(([method]) => method === 'help.getConfig'));
  });

  it('skips unsupported backends before executing a request', async () => {
    const client = new Anygram({
      adapters: [
        createAdapter('bot', { callApi: async () => assert.fail() }),
        createAdapter('mtproto', { call: async () => 'config' }),
      ],
    });
    assert.equal(await client.invoke('help.getConfig'), 'config');
    await assert.rejects(
      client.withBackend('bot').invoke('help.getConfig'),
      UnsupportedError
    );
  });

  it('never fails over after a side effect may have executed', async () => {
    let secondCalls = 0;
    const failure = new Error('connection lost after send');
    const client = new Anygram({
      adapters: [
        createAdapter('gramjs', {
          sendMessage: async () => {
            throw failure;
          },
        }),
        createAdapter('teleproto', {
          sendMessage: async () => {
            secondCalls++;
          },
        }),
      ],
    });
    await assert.rejects(client.sendMessage('me', 'hello'), (error) => {
      assert(error instanceof TelegramError);
      assert.equal(error.cause, failure);
      return true;
    });
    assert.equal(secondCalls, 0);
  });

  it('preserves backend-specific extended methods and this binding', async () => {
    const backend = {
      value: 12,
      custom() {
        return this.value;
      },
    };
    const client = new Anygram({
      adapters: [createAdapter('gramjs', backend)],
    });
    assert.equal(client.backend('gramjs').custom(), 12);
  });

  it('rejects duplicate adapter names and unknown selections', () => {
    const adapter = createAdapter('mtproto', { call: async () => true });
    assert.throws(() => new Anygram({ adapters: [adapter, adapter] }));
    assert.throws(
      () => new Anygram({ adapters: [adapter], backend: 'missing' })
    );
  });
});
