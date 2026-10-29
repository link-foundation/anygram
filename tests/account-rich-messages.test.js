import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as Vendor } from 'teleproto/tl/index.js';
import * as Actual from 'teleproto/richMessage.js';
import * as methods from 'teleproto/client/methods/messages.js';
import * as Package from '../src/index.js';
import {
  ownedMessage,
  sdkMessage,
  canonical,
} from './fixtures/account-message-models.js';
import { richPage, asClass, richMessage } from './fixtures/rich-messages.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const richGetters = ['richText', 'richMarkdown', 'richHtml'];

for (const style of ['gramjs', 'teleproto']) {
  for (const [index, helper] of richGetters.entries()) {
    it(`renders ${style} ${helper} bound metadata like the actual SDK`, async () => {
      const page = richPage(true, 'Partial content');
      const { message } = await ownedMessage(style, page);
      const sdk = sdkMessage(Vendor, page).message;
      assert.equal(message[helper], sdk[helper]);
      assert.equal(
        message[helper],
        ['Partial content', 'Partial content', '<p>Partial content</p>'][index]
      );
      message.richMessage.blocks[0].text.text = 'Changed';
      assert.equal(
        page.messages[0].rich_message.blocks[0].text.text,
        'Partial content'
      );
    });
  }
  it(`fetches full ${style} rich content once and retains its bound origin`, async () => {
    const response = richPage(false, 'Full content');
    response.messages[0].message = 'Unrelated refreshed text';
    response.users[0].access_hash = 999n;
    const { message, calls } = await ownedMessage(
      style,
      richPage(true, 'Partial content'),
      () => response
    );
    const previous = canonical(message);
    assert.equal(await message.fetchRichMessage(), message);
    assert.equal(message.richText, 'Full content');
    assert.equal(message.message, previous.message);
    assert.equal(message.inputChat.accessHash, 17n);
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'messages.getRichMessage');
    assert.equal(calls[0][1].id, 7);
    assert.equal(calls[0][1].peer.access_hash, 17n);
    assert.equal(await message.fetchRichMessage(), message);
    assert.equal(calls.length, 1);
    message.richMessage.blocks[0].text.text = 'Detached';
    assert.equal(
      response.messages[0].rich_message.blocks[0].text.text,
      'Full content'
    );
  });
  for (const current of [undefined, richMessage(false)]) {
    it(`keeps absent/full ${style} rich content local without a request`, async () => {
      const page = richPage();
      page.messages[0].rich_message = current;
      const { message, calls } = await ownedMessage(style, page);
      assert.equal(await message.fetchRichMessage(), message);
      assert.equal(calls.length, 0);
      for (const getter of richGetters) {
        assert.equal(typeof message[getter], current ? 'string' : 'undefined');
      }
    });
  }
  for (const mismatch of [
    'id',
    'peer family',
    'peer ID',
    'missing rich',
    'empty response',
  ]) {
    it(`keeps partial ${style} content after a ${mismatch} full-content response`, async () => {
      const response = richPage();
      if (mismatch === 'id') {
        response.messages[0].id = 8;
      } else if (mismatch === 'peer family') {
        response.messages[0].peer_id = { _: 'peerChat', chat_id: 9n };
      } else if (mismatch === 'peer ID') {
        response.messages[0].peer_id.user_id = 10n;
      } else if (mismatch === 'missing rich') {
        delete response.messages[0].rich_message;
      } else {
        response.messages = [];
      }
      const { message, calls } = await ownedMessage(
        style,
        richPage(true, 'Partial'),
        () => response
      );
      assert.equal(await message.fetchRichMessage(), message);
      assert.equal(message.richText, 'Partial');
      assert.equal(message.richMessage.part, true);
      assert.equal(calls.length, 1);
    });
  }
  for (const stage of ['before', 'after']) {
    it(`honors ${stage}-request ${style} rich fetch cancellation without mutating content`, async () => {
      const controller = new globalThis.AbortController();
      const reason = new Error(`${stage} cancellation`);
      const { message, calls } = await ownedMessage(
        style,
        richPage(true, 'Partial'),
        () => {
          controller.abort(reason);
          return richPage();
        }
      );
      if (stage === 'before') {
        controller.abort(reason);
      }
      await assert.rejects(
        message.fetchRichMessage({ signal: controller.signal }),
        (error) => error === reason
      );
      assert.equal(message.richText, 'Partial');
      assert.equal(calls.length, stage === 'before' ? 0 : 1);
    });
  }
  it(`retains selected ${style} rich fetch failures without replay`, async () => {
    const { message, calls } = await ownedMessage(style, richPage(true), () => {
      throw Object.assign(new Error('MESSAGE_ID_INVALID'), {
        code: 400,
        type: 'MESSAGE_ID_INVALID',
      });
    });
    await assert.rejects(message.fetchRichMessage(), {
      code: 400,
      type: 'MESSAGE_ID_INVALID',
    });
    assert.equal(calls.length, 1);
    assert.equal(message.richMessage.part, true);
  });
}

for (const facade of ['canonical', 'gramjs', 'teleproto']) {
  for (const id of [7, { id: 7 }, new Vendor.Message({ id: 7 })]) {
    it(`fetches ${facade} rich messages with a numeric or message ID`, async () => {
      const calls = [];
      const client = new Package.Anygram({
        adapters: [
          Package.createAdapter(
            'native',
            {
              async call(method, params) {
                calls.push({ method, params });
                return richPage();
              },
            },
            { kind: 'mtproto' }
          ),
        ],
      });
      const view = facade === 'canonical' ? client : client[facade];
      const message = await view.getRichMessage(peer, id);
      assert.equal(message.id, 7);
      assert.equal(calls.length, 1);
      assert.equal(calls[0].method, 'messages.getRichMessage');
      assert.deepEqual(calls[0].params, { peer, id: 7 });
      if (facade !== 'canonical') {
        assert.equal(message.client, view);
        assert.equal(message.richHtml, '<p>Full content</p>');
      } else {
        assert.equal(message.rich_message.blocks[0].text.text, 'Full content');
      }
    });
  }
}

for (const id of [undefined, null, 0, -1, 1.5, '7', 2147483648, { id: 0 }]) {
  it(`rejects invalid rich fetch ID ${String(id)} before peer resolution`, async () => {
    const { client, calls } = await ownedMessage('teleproto');
    await assert.rejects(
      client.getRichMessage('unresolved', id),
      (error) => error.cause instanceof RangeError
    );
    assert.equal(calls.length, 0);
  });
}

it('compares actual SDK full-content fetching and documents unrelated-message fallback', async () => {
  const sdk = sdkMessage(Vendor, richPage(true, 'Partial')).message;
  let count = 0;
  sdk.client.getRichMessage = async (input, id) => {
    count++;
    assert.equal(input.accessHash, 17n);
    assert.equal(id, 7);
    return asClass(Vendor, richPage().messages[0]);
  };
  assert.equal(await sdk.fetchRichMessage(), sdk);
  assert.equal(sdk.richHtml, Actual.toHtml(sdk.richMessage));
  await sdk.fetchRichMessage();
  assert.equal(count, 1);
  const unrelated = richPage();
  unrelated.messages[0].id = 8;
  sdk.client.api = {
    messages: { getRichMessage: async () => asClass(Vendor, unrelated) },
  };
  assert.equal(
    (await methods.getRichMessage(sdk.client, await sdk.getInputChat(), 7)).id,
    8
  );
  const { client } = await ownedMessage(
    'teleproto',
    richPage(true),
    () => unrelated
  );
  assert.equal(await client.teleproto.getRichMessage(peer, 7), undefined);
});

for (const style of ['gramjs', 'teleproto']) {
  it(`validates ${style} rich message IDs before resolving a username`, async () => {
    const { client, calls } = await ownedMessage(style);
    await assert.rejects(
      client[style].getRichMessage('unresolved', 0),
      RangeError
    );
    assert.equal(calls.length, 0);
  });
}
for (const returnedId of [9, '9', 9007199254740992]) {
  it(`correlates only exact rich peer IDs from backend representation ${typeof returnedId}`, async () => {
    const page = richPage();
    page.messages[0].peer_id.user_id = returnedId;
    const { client } = await ownedMessage(
      'teleproto',
      richPage(true),
      () => page
    );
    const value = await client.getRichMessage(peer, 7);
    assert.equal(value?.id, returnedId === 9007199254740992 ? undefined : 7);
  });
}
