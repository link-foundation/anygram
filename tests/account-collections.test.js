import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as gramMessages from 'telegram/client/messages.js';
import * as gramDialogs from 'telegram/client/dialogs.js';
import * as teleMessages from 'teleproto/client/messages.js';
import * as teleDialogs from 'teleproto/client/dialogs.js';
import { gramRequest, requestOf } from '../src/requests.js';

const peer = { _: 'inputPeerChannel', channel_id: 7n, access_hash: 71n };
function history(count = 37) {
  return {
    _: 'messages.messagesSlice',
    count,
    messages: [
      {
        _: 'message',
        id: 10,
        date: 1,
        message: 'hello',
        peer_id: { _: 'peerChannel', channel_id: 7n },
      },
    ],
    chats: [],
    topics: [],
    users: [],
  };
}
function dialogs(count = 37) {
  return {
    _: 'messages.dialogsSlice',
    count,
    dialogs: [
      {
        _: 'dialog',
        peer: { _: 'peerChannel', channel_id: 7n },
        top_message: 10,
        read_inbox_max_id: 0,
        read_outbox_max_id: 0,
        unread_count: 0,
        unread_mentions_count: 0,
        unread_reactions_count: 0,
        unread_poll_votes_count: 0,
        notify_settings: { _: 'peerNotifySettings' },
      },
    ],
    messages: history().messages,
    chats: [
      {
        _: 'channel',
        id: 7n,
        access_hash: 71n,
        title: 'channel',
        photo: { _: 'chatPhotoEmpty' },
        date: 1,
      },
    ],
    users: [],
  };
}
const routed = (handle) =>
  new Anygram({
    adapters: [createAdapter('mtproto', { call: handle })],
  });

for (const [style, Api, messages, dialogMethods] of [
  ['gramjs', GramApi, gramMessages, gramDialogs],
  ['teleproto', TeleApi, teleMessages, teleDialogs],
]) {
  for (const kind of ['history', 'dialogs', 'ids']) {
    it(`${style} ${kind} collection total matches actual SDK collection`, async () => {
      const raw = kind === 'dialogs' ? dialogs() : history();
      const input = gramRequest(Api, requestOf(peer));
      const vendor = {
        getInputEntity: async () => input,
        invoke: async () => gramRequest(Api, requestOf(raw)),
        _log: { error: assert.fail, canSend: () => false },
        _entityCache: { get: () => input },
      };
      vendor.iterMessages = (entity, options) =>
        messages.iterMessages(vendor, entity, options);
      vendor.iterDialogs = (options) =>
        dialogMethods.iterDialogs(vendor, options);
      const options = kind === 'ids' ? { ids: [10] } : { limit: 1 };
      const expected =
        kind === 'dialogs'
          ? await dialogMethods.getDialogs(vendor, options)
          : await messages.getMessages(vendor, input, options);
      const client = routed(async () => raw);
      const actual =
        kind === 'dialogs'
          ? await client[style].getDialogs(options)
          : await client[style].getMessages(peer, options);
      assert.equal(actual.total, expected.total);
      assert.equal(actual.length, expected.length);
      assert.equal(actual.total, kind === 'ids' ? 1 : 37);
      assert(Array.isArray(actual));
      assert.deepEqual(Object.getOwnPropertyDescriptor(actual, 'total'), {
        value: actual.total,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    });
  }
  for (const kind of ['history', 'dialogs']) {
    it(`${style} ${kind} zero-limit collection requests count without yielding`, async () => {
      const calls = [];
      const raw = kind === 'dialogs' ? dialogs() : history();
      const client = routed(async (method, params) => {
        calls.push([method, params]);
        return raw;
      });
      const values =
        kind === 'dialogs'
          ? await client[style].getDialogs({ limit: 0 })
          : await client[style].getMessages(peer, { limit: 0 });
      assert.equal(values.total, 37);
      assert.equal(values.length, 0);
      assert.equal(calls.length, 1);
      assert.equal(
        calls[0][0],
        kind === 'dialogs' ? 'messages.getDialogs' : 'messages.getHistory'
      );
      assert.equal(calls[0][1].limit, 1);
    });
    it(`${style} ${kind} complete response derives total from raw vector`, async () => {
      const raw = kind === 'dialogs' ? dialogs() : history();
      raw._ = kind === 'dialogs' ? 'messages.dialogs' : 'messages.messages';
      delete raw.count;
      const client = routed(async () => raw);
      const result =
        kind === 'dialogs'
          ? await client[style].getDialogs({ limit: 1 })
          : await client[style].getMessages(peer, { limit: 1 });
      assert.equal(result.total, 1);
    });
    it(`${style} ${kind} rejects malformed response counts`, async () => {
      for (const count of [
        -1,
        0.5,
        NaN,
        Infinity,
        '37',
        null,
        true,
        2147483648,
      ]) {
        const client = routed(async () =>
          kind === 'dialogs' ? dialogs(count) : history(count)
        );
        await assert.rejects(
          kind === 'dialogs'
            ? client[style].getDialogs({ limit: 1 })
            : client[style].getMessages(peer, { limit: 1 }),
          /count/i
        );
      }
    });
    it(`${style} ${kind} total and contents have independent ownership`, async () => {
      const raw = kind === 'dialogs' ? dialogs() : history();
      const client = routed(async () => raw);
      const get = () =>
        kind === 'dialogs'
          ? client[style].getDialogs({ limit: 1 })
          : client[style].getMessages(peer, { limit: 1 });
      const first = await get();
      first.total = 900;
      (kind === 'dialogs' ? first[0].message : first[0]).message = 'changed';
      const second = await get();
      assert.equal(second.total, 37);
      assert.equal(
        (kind === 'dialogs' ? second[0].message : second[0]).message,
        'hello'
      );
      assert.equal(raw.count, 37);
    });
  }
  it(`${style} counts explicit IDs including missing message placeholders`, async () => {
    const raw = history();
    raw.messages.push({ _: 'messageEmpty', id: 9 });
    const client = routed(async () => raw);
    const result = await client[style].getMessages(peer, { ids: [10, 9] });
    assert.equal(result.total, 2);
    assert.equal(result[1], undefined);
  });
}

it('canonical message arrays and raw dialogs retain their existing shapes', async () => {
  const client = routed(async (method) =>
    method === 'messages.getDialogs' ? dialogs() : history()
  );
  const messages = await client.getMessages(peer);
  assert.equal(messages.total, undefined);
  assert.deepEqual(Object.keys(messages), ['0']);
  const result = await client.getDialogs();
  assert.equal(result.count, 37);
  assert.equal(result.total, undefined);
});

for (const style of ['gramjs', 'teleproto']) {
  for (const backend of [
    'native',
    'gramjs',
    'teleproto',
    'mtcute',
    'mtproto',
  ]) {
    it(`${style} collection counts follow selected ${backend} requests`, async () => {
      const Api = backend === 'gramjs' ? GramApi : TeleApi;
      const sdk = ['gramjs', 'teleproto'].includes(backend);
      const calls = [];
      const call = async (method, params) => {
        const request =
          typeof method === 'string' ? { method, params } : requestOf(method);
        calls.push(request.method);
        const raw =
          request.method === 'messages.getDialogs' ? dialogs(45) : history(81);
        return sdk ? gramRequest(Api, requestOf(raw)) : raw;
      };
      const client = new Anygram({
        adapters: [
          createAdapter(
            backend,
            sdk ? { invoke: (request) => call(request) } : { call },
            { kind: backend === 'native' ? 'mtproto' : backend, Api }
          ),
        ],
      });
      assert.equal(
        (await client[style].getMessages(peer, { limit: 1 })).total,
        81
      );
      assert.equal((await client[style].getDialogs({ limit: 1 })).total, 45);
      assert.deepEqual(calls, ['messages.getHistory', 'messages.getDialogs']);
    });
  }
  for (const kind of ['history', 'dialogs']) {
    it(`${style} ${kind} count requests propagate cancellation and selected errors`, async () => {
      const controller = new globalThis.AbortController();
      const failure = new Error('selected failure');
      let calls = 0;
      const client = routed(async () => {
        calls++;
        throw failure;
      });
      const get = (options) =>
        kind === 'dialogs'
          ? client[style].getDialogs(options)
          : client[style].getMessages(peer, options);
      await assert.rejects(
        get({ limit: 0 }),
        (error) => error === failure || error.cause === failure
      );
      assert.equal(calls, 1);
      controller.abort(new Error('cancel count'));
      await assert.rejects(
        get({ limit: 0, signal: controller.signal }),
        /cancel count/
      );
      assert.equal(calls, 1);
      const late = routed(async () => {
        const raw = kind === 'dialogs' ? dialogs() : history();
        controllerLate.abort(new Error('cancel response'));
        return raw;
      });
      const controllerLate = new globalThis.AbortController();
      await assert.rejects(
        kind === 'dialogs'
          ? late[style].getDialogs({ limit: 0, signal: controllerLate.signal })
          : late[style].getMessages(peer, {
              limit: 0,
              signal: controllerLate.signal,
            }),
        /cancel response/
      );
    });
    it(`${style} ${kind} concurrent collections retain their own counts`, async () => {
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      let entered;
      const ready = new Promise((resolve) => {
        entered = resolve;
      });
      const client = routed(async (_method, params) => {
        const first = params.offset_id === 10;
        if (first) {
          entered();
          await gate;
        }
        return kind === 'dialogs'
          ? dialogs(first ? 81 : 45)
          : history(first ? 81 : 45);
      });
      const get = (offsetId) =>
        kind === 'dialogs'
          ? client[style].getDialogs({ limit: 1, offsetId })
          : client[style].getMessages(peer, { limit: 1, offsetId });
      const first = get(10);
      await ready;
      const second = await get(20);
      release();
      assert.equal((await first).total, 81);
      assert.equal(second.total, 45);
    });
  }
  it(`${style} dialog count follows latest page without deduplication changing total`, async () => {
    let calls = 0;
    const client = routed(async () => {
      const raw = dialogs(++calls === 1 ? 81 : 79);
      if (calls === 2) {
        raw.dialogs.push({
          ...raw.dialogs[0],
          peer: { _: 'peerChat', chat_id: 8n },
        });
        raw.chats.push({
          _: 'chat',
          id: 8n,
          title: 'second',
          participants_count: 1,
          photo: { _: 'chatPhotoEmpty' },
          date: 1,
          version: 1,
        });
      }
      return raw;
    });
    const result = await client[style].getDialogs({ limit: 2, pageSize: 1 });
    assert.equal(result.length, 2);
    assert.equal(result.total, 79);
    assert.equal(calls, 2);
  });
}

for (const style of ['gramjs', 'teleproto']) {
  it(`${style} collection counts survive independent encrypted TCP`, async () => {
    const { secretRpcPeer } =
      await import('../experiments/secret-rpc-peer.mjs');
    const remote = await secretRpcPeer((request) =>
      request._ === 'messages.getDialogs' ? dialogs(120) : history(250)
    );
    try {
      const client = new Anygram({
        adapters: [createAdapter('native', remote.client, { kind: 'mtproto' })],
      });
      const result = await client[style].getMessages(peer, { limit: 1 });
      assert.equal(result.total, 250);
      assert.equal(result[0].message, 'hello');
      assert.equal(result[0].inputChat.accessHash, 71n);
      const list = await client[style].getDialogs({ limit: 1 });
      assert.equal(list.total, 120);
      assert.equal(list[0].inputEntity.accessHash, 71n);
      const count = await client[style].getMessages(peer, { limit: 0 });
      assert.equal(count.total, 250);
      assert.equal(count.length, 0);
      const dialogCount = await client[style].getDialogs({ limit: 0 });
      assert.equal(dialogCount.total, 120);
      assert.equal(dialogCount.length, 0);
    } finally {
      await remote.close();
    }
  });
}

for (const style of ['gramjs', 'teleproto']) {
  it(`${style} explicit-ID counts retain the submitted request snapshot`, async () => {
    const ids = [10, 9];
    const options = { ids };
    const client = routed(async (_method, params) => {
      assert.equal(params.id.length, 2);
      ids.push(8);
      options.limit = 0;
      return history();
    });
    const values = await client[style].getMessages(peer, options);
    assert.equal(values.total, 2);
    assert.equal(values.length, 1);
  });
}

for (const [style, Api, messages, dialogMethods] of [
  ['gramjs', GramApi, gramMessages, gramDialogs],
  ['teleproto', TeleApi, teleMessages, teleDialogs],
]) {
  for (const kind of ['history', 'dialogs']) {
    it(`${style} ${kind} zero-limit correction is bounded against actual SDK behavior`, async () => {
      const raw = kind === 'dialogs' ? dialogs() : history();
      const input = gramRequest(Api, requestOf(peer));
      let calls = 0;
      const vendor = {
        getInputEntity: async () => input,
        invoke: async () => {
          assert(++calls <= 1, 'Finite response must end the actual SDK scan');
          return gramRequest(Api, requestOf(raw));
        },
        _log: { error: assert.fail, canSend: () => false },
      };
      vendor.iterMessages = (entity, options) =>
        messages.iterMessages(vendor, entity, options);
      vendor.iterDialogs = (options) =>
        dialogMethods.iterDialogs(vendor, options);
      const actualSdk =
        kind === 'dialogs'
          ? await dialogMethods.getDialogs(vendor, { limit: 0 })
          : await messages.getMessages(vendor, input, { limit: 0 });
      assert.equal(actualSdk.length, style === 'gramjs' ? 1 : 0);
      assert.equal(actualSdk.total, 37);
      const client = routed(async () => raw);
      const owned =
        kind === 'dialogs'
          ? await client[style].getDialogs({ limit: 0 })
          : await client[style].getMessages(peer, { limit: 0 });
      assert.equal(owned.length, 0);
      assert.equal(owned.total, actualSdk.total);
    });
  }
  it(`${style} empty explicit-ID collection does not issue a request`, async () => {
    const client = routed(async () => assert.fail('No lookup or empty-ID RPC'));
    const result = await client[style].getMessages('unused', { ids: [] });
    assert.equal(result.total, 0);
    assert.equal(result.length, 0);
    const controller = new globalThis.AbortController();
    controller.abort(new Error('cancel empty'));
    await assert.rejects(
      client[style].getMessages('unused', {
        ids: [],
        signal: controller.signal,
      }),
      /cancel empty/
    );
  });
}

for (const style of ['gramjs', 'teleproto']) {
  for (const type of [
    'messages.messagesSlice',
    'messages.channelMessages',
    'messages.messagesNotModified',
  ]) {
    it(`${style} retains ${type} count including empty and maximum integer values`, async () => {
      for (const count of [0, 2147483647]) {
        const raw = { ...history(count), _: type, messages: [], pts: 1 };
        if (type === 'messages.messagesNotModified') {
          delete raw.messages;
        }
        const client = routed(async () => raw);
        const values = await client[style].getMessages(peer, { limit: 0 });
        assert.equal(values.total, count);
        assert.equal(values.length, 0);
      }
    });
  }
  it(`${style} dialog count survives a response without available dialog entities`, async () => {
    const raw = dialogs(37);
    raw.chats = [];
    const client = routed(async () => raw);
    const values = await client[style].getDialogs({ limit: 1 });
    assert.equal(values.total, 37);
    assert.equal(values.length, 0);
  });
  it(`${style} dialog not-modified count and zero-limit iterators remain bounded`, async () => {
    let calls = 0;
    const client = routed(async () => {
      calls++;
      return { _: 'messages.dialogsNotModified', count: 37 };
    });
    const result = await client[style].getDialogs({ limit: 0 });
    assert.equal(result.total, 37);
    assert.equal(result.length, 0);
    for await (const ignored of client[style].iterDialogs({ limit: 0 })) {
      assert.fail(`Unexpected zero-limit value: ${ignored}`);
    }
    for await (const ignored of client[style].iterMessages(peer, {
      limit: 0,
    })) {
      assert.fail(`Unexpected zero-limit value: ${ignored}`);
    }
    assert.equal(calls, 1);
  });
}
