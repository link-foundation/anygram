import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api, Anygram, createAdapter } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { buttonPage, pollPage } from './fixtures/account-buttons.js';
import {
  ownedMessage,
  sdkMessage,
  wireValue,
} from './fixtures/account-message-models.js';

for (const style of ['gramjs', 'teleproto']) {
  for (const selector of [
    { i: [1] },
    { text: (text) => text === 'url' },
    { filter: (button) => button.url },
    { i: 0, j: 1 },
  ]) {
    it(`selects ${style} URL buttons by ${Object.keys(selector).join()} without network requests`, async () => {
      const { message, calls } = await ownedMessage(style, buttonPage(style));
      assert.equal(await message.click(selector), 'https://example.com/button');
      assert.equal(calls.length, 0);
    });
  }
  for (const markup of [
    undefined,
    { _: 'replyKeyboardHide' },
    { _: 'replyKeyboardForceReply' },
  ]) {
    it(`handles ${style} ${markup?._ ?? 'absent'} markup without invented buttons`, async () => {
      const source = buttonPage(style);
      source.messages[0].reply_markup = markup;
      const { message, calls } = await ownedMessage(style, source);
      assert.equal(message.buttonCount, 0);
      assert.equal(message.buttons, undefined);
      assert.equal(await message.getButtons(), undefined);
      assert.equal(await message.click({}), undefined);
      assert.equal(calls.length, 0);
    });
  }
  it(`supports ${style} direct callback bytes without markup and owns request data`, async () => {
    const source = buttonPage(style);
    delete source.messages[0].reply_markup;
    const { message, calls } = await ownedMessage(style, source);
    const data = new Uint8Array([9, 8]);
    await message.click({ data });
    assert.equal(calls[0][0], 'messages.getBotCallbackAnswer');
    assert.deepEqual([...calls[0][1].data], [9, 8]);
    assert.equal(calls[0][1].peer.access_hash, 17n);
    data[0] = 7;
    assert.equal(calls[0][1].data[0], 9);
  });
  it(`retains ${style} detached button data and private ownership`, async () => {
    const source = buttonPage(style);
    const { message } = await ownedMessage(style, source);
    const button = message.buttons[0][0];
    button.data[0] = 99;
    const original = source.messages[0].reply_markup.rows[0].buttons[0];
    assert.equal((original.type ?? original).data[0], 1);
    assert(!Object.keys(button).includes('client'));
    assert(!Object.keys(button).includes('_client'));
    assert.doesNotThrow(() => JSON.stringify(button));
  });
  for (const errorType of ['BOT_RESPONSE_TIMEOUT', 'MESSAGE_ID_INVALID']) {
    it(`handles ${style} ${errorType} exactly once and preserves other RPC errors`, async () => {
      const { message, calls } = await ownedMessage(
        style,
        buttonPage(style),
        () => {
          throw Object.assign(new Error(errorType), {
            errorMessage: errorType,
            code: 400,
          });
        }
      );
      if (errorType === 'BOT_RESPONSE_TIMEOUT') {
        assert.equal(await message.click({ i: 0 }), null);
      } else {
        await assert.rejects(
          message.click({ i: 0 }),
          (error) => error.type === errorType && error.backend === 'native'
        );
      }
      assert.equal(calls.length, 1);
    });
  }
  for (const kind of ['phone', 'geo']) {
    it(`requires explicit ${style} ${kind} consent before reading or sending personal data`, async () => {
      const { message, calls } = await ownedMessage(
        style,
        buttonPage(style, [kind])
      );
      await assert.rejects(message.click({}), /sharePhone|shareGeo/);
      assert.equal(calls.length, 0);
    });
  }
  it(`shares ${style} explicit phone contact only after consent`, async () => {
    const { message, calls } = await ownedMessage(
      style,
      buttonPage(style, ['phone']),
      (method) =>
        method === 'users.getUsers'
          ? [
              {
                _: 'user',
                self: true,
                id: 99n,
                first_name: 'Self',
                last_name: 'Name',
                phone: '12345',
              },
            ]
          : {
              _: 'updateShortSentMessage',
              id: 42,
              date: 1,
              pts: 1,
              pts_count: 1,
            }
    );
    const sent = await message.click({ sharePhone: true });
    assert.equal(sent.id, 42);
    assert.deepEqual(
      calls.map(([method]) => method),
      ['users.getUsers', 'messages.sendMedia']
    );
    assert.deepEqual(calls[1][1].media, {
      _: 'inputMediaContact',
      phone_number: '12345',
      first_name: 'Self',
      last_name: 'Name',
      vcard: '',
    });
  });
  it(`shares ${style} explicit coordinates through InputMediaGeoPoint`, async () => {
    const { message, calls } = await ownedMessage(
      style,
      buttonPage(style, ['geo'])
    );
    await message.click({ shareGeo: [30, 45] });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'messages.sendMedia');
    assert.deepEqual(calls[0][1].media, {
      _: 'inputMediaGeoPoint',
      geo_point: { _: 'inputGeoPoint', long: 30, lat: 45 },
    });
  });
  it(`starts ${style} via-bot queries using the cached via-bot hash`, async () => {
    const source = buttonPage(style, ['switchInline']);
    const raw = source.messages[0].reply_markup.rows[0].buttons[0];
    delete (raw.type ?? raw).same_peer;
    source.messages[0].via_bot_id = 21n;
    source.users.push({
      _: 'user',
      id: 21n,
      access_hash: 23n,
      bot: true,
      first_name: 'Bot',
    });
    const { message, calls } = await ownedMessage(style, source);
    await message.click({});
    assert.equal(calls[0][1].bot.user_id, 21n);
    assert.equal(calls[0][1].bot.access_hash, 23n);
  });
}

it('rejects pre-aborted button reads, URL clicks and poll votes without network requests', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('button cancelled');
  controller.abort(reason);
  for (const source of [buttonPage(), pollPage()]) {
    const { message, calls } = await ownedMessage('teleproto', source);
    const options = { signal: controller.signal };
    await assert.rejects(
      message.getButtons(options),
      (error) => error === reason
    );
    await assert.rejects(
      message.click({ ...options, i: 0 }),
      (error) => error === reason
    );
    assert.equal(calls.length, 0);
  }
});

it('rejects invalid poll indices, closed polls and impossible coordinates before mutations', async () => {
  const { message, calls } = await ownedMessage('teleproto', pollPage());
  for (const i of [-1, 3, 1.5, [0, 9], [1, 1]]) {
    await assert.rejects(message.click({ i }), RangeError);
  }
  message.poll.poll.closed = true;
  await assert.rejects(message.click({ i: 0 }), /closed/i);
  assert.equal(calls.length, 0);
  const geo = await ownedMessage('teleproto', buttonPage('teleproto', ['geo']));
  for (const shareGeo of [[181, 0], [0, 91], [NaN, 0], [0], [0, 0, 0]]) {
    await assert.rejects(geo.message.click({ shareGeo }), RangeError);
  }
  assert.equal(geo.calls.length, 0);
});

it('snapshots direct callback bytes before asynchronous peer lookup', async () => {
  const { message, calls } = await ownedMessage('teleproto', buttonPage());
  const original = message.getInputChat.bind(message);
  let release;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  message.getInputChat = async (options) => {
    await pending;
    return original(options);
  };
  const data = new Uint8Array([7, 8]);
  const result = message.click({ data });
  data[0] = 99;
  release();
  await result;
  assert.deepEqual([...calls[0][1].data], [7, 8]);
});

it('validates explicit InputGeoPoint coordinates as well as tuple coordinates', async () => {
  const { message, calls } = await ownedMessage(
    'teleproto',
    buttonPage('teleproto', ['geo'])
  );
  for (const shareGeo of [
    new Api.InputGeoPoint({ long: 181, lat: 0 }),
    new Api.InputMediaGeoPoint({
      geoPoint: new Api.InputGeoPoint({ long: 0, lat: 91 }),
    }),
  ]) {
    await assert.rejects(message.click({ shareGeo }), RangeError);
  }
  assert.equal(calls.length, 0);
});

it('rejects multiple answers for a single-choice poll without sending a vote', async () => {
  const source = pollPage();
  source.messages[0].media.poll.multiple_choice = false;
  const { message, calls } = await ownedMessage('teleproto', source);
  await assert.rejects(message.click({ i: [2, 0] }), /multiple|single/i);
  assert.equal(calls.length, 0);
});

it('resolves a missing inline bot from exactly one bounded message reload', async () => {
  const source = buttonPage('teleproto', ['switchInline']);
  source.users = [];
  const { message, calls } = await ownedMessage(
    'teleproto',
    source,
    (method) =>
      method === 'messages.getMessages'
        ? buttonPage('teleproto', ['switchInline'])
        : { _: 'updatesTooLong' }
  );
  assert.equal(message.buttons, undefined);
  assert.equal((await message.getButtons())[0][0].inlineQuery, 'lookup');
  await message.click({});
  assert.deepEqual(
    calls.map(([method]) => method),
    ['messages.getMessages', 'messages.startBot']
  );
  assert.deepEqual(calls[0][1].id, [{ _: 'inputMessageID', id: 7 }]);
});

it('keeps a missing inline bot bounded and never starts a different bot', async () => {
  const source = buttonPage('teleproto', ['switchInline']);
  source.users = [];
  const { message, calls } = await ownedMessage('teleproto', source, () => ({
    ...source,
    messages: [],
  }));
  await assert.rejects(message.getButtons(), /bot|sender/i);
  assert.equal(calls.length, 1);
});

it('compares actual teleproto contact and location preparation without adopting GramJS unsupported branches', async () => {
  for (const [kind, options] of [
    ['phone', { sharePhone: '987' }],
    ['geo', { shareGeo: [30, 45] }],
  ]) {
    const actual = sdkMessage(TeleApi, buttonPage('teleproto', [kind])).message;
    actual.client.getMe = async () => ({ firstName: 'Self', phone: '123' });
    let file;
    actual.client.sendFile = async (_peer, options) => {
      file = options.file;
    };
    await actual.click(options);
    const { message, calls } = await ownedMessage(
      'teleproto',
      buttonPage('teleproto', [kind]),
      (method) =>
        method === 'users.getUsers'
          ? [{ _: 'user', id: 99n, first_name: 'Self', phone: '123' }]
          : { _: 'updatesTooLong' }
    );
    await message.click(options);
    const media = calls.find(([method]) => method === 'messages.sendMedia')[1]
      .media;
    assert.deepEqual(wireValue(media), wireValue(file));
  }
  const gram = sdkMessage(GramApi, buttonPage('gramjs', ['phone'])).message;
  gram.client.getMe = async () => ({ firstName: 'Self', phone: '123' });
  await assert.rejects(gram.click({ sharePhone: true }), /Not supported/);
});

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`routes callback clicks through exactly the selected ${backend} adapter`, async () => {
    const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
    const calls = [];
    const execute = (value) => {
      const request = objectRequest(requestOf(value));
      calls.push(request);
      return request._ === 'messages.getHistory'
        ? buttonPage()
        : { _: 'messages.botCallbackAnswer', cache_time: 0, message: 'ok' };
    };
    const client = new Anygram({
      backend,
      adapters: [
        createAdapter(
          'unused',
          { call: () => assert.fail('wrong backend') },
          { kind: 'mtproto' }
        ),
        createAdapter(
          backend,
          {
            invoke: async (request) => {
              assert(
                request instanceof Vendor.messages.GetHistory ||
                  request instanceof Vendor.messages.GetBotCallbackAnswer
              );
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
    const [message] = await client.gramjs.getMessages(
      new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
    );
    assert.equal((await message.click({ i: 0 })).message, 'ok');
    assert.equal(calls.length, 2);
    assert.equal(calls[1].peer.access_hash, 17n);
    assert.deepEqual([...calls[1].data], [1, 2]);
  });
}

it('delivers callbacks, selected poll options and start-bot requests over independent encrypted TCP', async () => {
  const calls = [];
  const peer = await secretRpcPeer((request) => {
    calls.push(request);
    if (request._ === 'messages.getHistory') {
      return request.offset_id === 1
        ? pollPage()
        : buttonPage('teleproto', ['callback', 'switchInline']);
    }
    return request._ === 'messages.getBotCallbackAnswer'
      ? { _: 'messages.botCallbackAnswer', cache_time: 0, message: 'TCP' }
      : { _: 'updatesTooLong' };
  });
  const client = new Anygram({
    adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
  });
  try {
    const input = new Api.InputPeerUser({ userId: 9n, accessHash: 17n });
    const [message] = await client.teleproto.getMessages(input);
    assert.equal((await message.click({ i: 0 })).message, 'TCP');
    await message.click({ i: 1 });
    const [poll] = await client.teleproto.getMessages(input, { offsetId: 1 });
    await poll.click({ i: [2, 0] });
    assert.deepEqual(
      calls.map((request) => request._),
      [
        'messages.getHistory',
        'messages.getBotCallbackAnswer',
        'messages.startBot',
        'messages.getHistory',
        'messages.sendVote',
      ]
    );
    assert.deepEqual(
      calls[4].options.map((option) => [...option]),
      [[12], [10]]
    );
    assert.equal(calls[2].bot._, 'inputUser');
    assert.equal(calls[2].bot.access_hash, 17n);
  } finally {
    await client.disconnect();
    await peer.close();
  }
});
