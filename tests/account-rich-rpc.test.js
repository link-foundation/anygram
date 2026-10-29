import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as Vendor } from 'teleproto/tl/index.js';
import { Api as OlderGram } from 'telegram/tl/index.js';
import * as methods from 'teleproto/client/methods/messages.js';
import * as Actual from 'teleproto/richMessage.js';
import * as Package from '../src/index.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { ownedMessage, sdkMessage } from './fixtures/account-message-models.js';
import { richPage, richMessage, asClass } from './fixtures/rich-messages.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const codec = new TlCodec();

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`routes rich-message fetches through only the selected ${backend} adapter`, async () => {
    const calls = [];
    const execute = (request) => {
      const value = objectRequest(requestOf(request));
      calls.push(value);
      assert.equal(value._, 'messages.getRichMessage');
      assert.equal(value.peer._, peer._);
      assert.equal(BigInt(value.peer.user_id), peer.user_id);
      assert.equal(value.peer.access_hash, peer.access_hash);
      return richPage();
    };
    const client = new Package.Anygram({
      backend,
      adapters: [
        Package.createAdapter(
          'unused',
          { call: () => assert.fail('unselected route') },
          { kind: 'mtproto' }
        ),
        Package.createAdapter(
          backend,
          {
            getRichMessage: () =>
              assert.fail('vendor helper bypassed shared operation'),
            invoke: async (request) => {
              assert.equal(typeof request.getBytes, 'function');
              return execute(request);
            },
            call: async (method, params) =>
              execute(
                typeof method === 'string' ? { _: method, ...params } : method
              ),
          },
          { Api: Vendor, kind: backend === 'native' ? 'mtproto' : backend }
        ),
      ],
    });
    assert.equal(
      (await client.getRichMessage(peer, 7)).rich_message.blocks[0].text.text,
      'Full content'
    );
    assert.equal(calls.length, 1);
  });
}

it('retains the older pinned GramJS schema limitation explicitly', async () => {
  const client = new Package.Anygram({
    adapters: [
      Package.createAdapter(
        'gramjs',
        {
          invoke: async () =>
            assert.fail('unsupported request reached old schema'),
        },
        { Api: OlderGram, kind: 'gramjs' }
      ),
    ],
  });
  await assert.rejects(client.getRichMessage(peer, 7), {
    message: 'The backend schema has no constructor messages.getRichMessage',
  });
});

for (const style of ['gramjs', 'teleproto']) {
  it(`compares ${style} rich fetch bytes with the actual SDK method helper`, async () => {
    const client = sdkMessage(Vendor, richPage()).message.client;
    const requests = [];
    client.api = {
      messages: {
        getRichMessage: async (params) => {
          requests.push(new Vendor.messages.GetRichMessage(params));
          return asClass(Vendor, richPage());
        },
      },
    };
    await methods.getRichMessage(client, asClass(Vendor, peer), 7);
    const owned = await ownedMessage(style, richPage(true), () => richPage());
    await owned.message.fetchRichMessage();
    assert.deepEqual(
      codec.encode({ _: owned.calls[0][0], ...owned.calls[0][1] }),
      new Uint8Array(requests[0].getBytes())
    );
  });
  it(`keeps ${style} rich content changed by the caller while a fetch is pending`, async () => {
    let complete;
    let started;
    const pending = new Promise((resolve) => {
      complete = resolve;
    });
    const ready = new Promise((resolve) => {
      started = resolve;
    });
    const { message } = await ownedMessage(
      style,
      richPage(true, 'Partial'),
      () => {
        started();
        return pending;
      }
    );
    const fetch = message.fetchRichMessage();
    await ready;
    message.richMessage = richMessage(false, 'Caller content');
    complete(richPage());
    await fetch;
    assert.equal(message.richText, 'Caller content');
  });
}

for (const facade of ['canonical', 'gramjs', 'teleproto']) {
  for (const action of ['send', 'edit']) {
    it(`compares ${facade} ${action} rich-only content bytes with the actual SDK`, async () => {
      const sdk = sdkMessage(Vendor, richPage()).message.client;
      const requests = [];
      sdk.buildReplyMarkup = () => undefined;
      sdk._getResponseMessage = () => undefined;
      sdk.invoke = async (request) => {
        requests.push(request);
        return new Vendor.UpdatesTooLong();
      };
      const actualOptions = {
        richMessage: Actual.markdown('# Title'),
        formattingEntities: [],
      };
      if (action === 'send') {
        await methods.sendMessage(sdk, asClass(Vendor, peer), actualOptions);
      } else {
        await methods.editMessage(sdk, asClass(Vendor, peer), {
          ...actualOptions,
          message: 7,
        });
      }
      const { client, message, calls } = await ownedMessage(
        facade === 'canonical' ? 'teleproto' : facade,
        richPage(true)
      );
      const options = {
        richMessage: Package.Rich.markdown('# Title'),
        entities: [],
        linkPreview: true,
      };
      if (action === 'send') {
        if (facade === 'canonical') {
          await client.sendMessage(peer, options);
        } else {
          await client[facade].sendMessage(peer, options);
        }
        requests[0].randomId = calls[0][1].random_id;
      } else if (facade === 'canonical') {
        await client.editMessage(peer, { ...options, id: 7 });
      } else {
        await message.edit({ ...options, formattingEntities: [] });
      }
      assert.deepEqual(
        codec.encode({ _: calls[0][0], ...calls[0][1] }),
        new Uint8Array(requests[0].getBytes())
      );
    });
  }
}

it('correlates Saved Messages rich content with an identified self account', async () => {
  const calls = [];
  const response = richPage();
  const client = new Package.Anygram({
    adapters: [
      Package.createAdapter(
        'native',
        {
          async call(method, params) {
            calls.push({ method, params });
            return method === 'users.getUsers'
              ? [{ _: 'user', self: true, id: 9n, access_hash: 17n }]
              : response;
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  assert.equal((await client.getRichMessage('me', 7)).id, 7);
  response.messages[0].peer_id.user_id = 10n;
  assert.equal(await client.getRichMessage('me', 7), undefined);
  assert.equal(
    calls.filter((call) => call.method === 'messages.getRichMessage').length,
    2
  );
});

it('sends and fetches rich content over independent encrypted native TCP', async () => {
  const calls = [];
  const remote = await secretRpcPeer((request) => {
    calls.push(request);
    if (request._ === 'messages.getHistory') {
      return richPage(true, 'Partial');
    }
    if (request._ === 'messages.getRichMessage') {
      return richPage();
    }
    return { _: 'updatesTooLong' };
  });
  const client = new Package.Anygram({
    adapters: [
      Package.createAdapter('native', remote.client, { kind: 'mtproto' }),
    ],
  });
  try {
    const [message] = await client.teleproto.getMessages(peer);
    assert.equal(message.richText, 'Partial');
    await message.fetchRichMessage();
    assert.equal(message.richHtml, '<p>Full content</p>');
    await client.teleproto.sendMessage(peer, {
      richMessage: Package.Rich.html('<p>Sent</p>'),
    });
    await message.edit({ richMessage: Package.Rich.markdown('# Edited') });
    assert.equal(calls.length, 4);
    assert.deepEqual(
      calls.map((call) => call.peer.access_hash),
      [17n, 17n, 17n, 17n]
    );
    assert.equal(calls[2].message, '');
    assert.equal(calls[2].rich_message.html, '<p>Sent</p>');
    assert.equal(calls[3].rich_message.markdown, '# Edited');
  } finally {
    await client.disconnect();
    await remote.close();
  }
});
