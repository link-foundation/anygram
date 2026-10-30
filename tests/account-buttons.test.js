import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as GramUtils from 'telegram/Utils.js';
import * as TeleUtils from 'teleproto/Utils.js';
import { buttonPage, pollPage } from './fixtures/account-buttons.js';
import {
  ownedMessage,
  sdkMessage,
  canonical,
  wireValue,
} from './fixtures/account-message-models.js';

for (const [style, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`compares ${style} bound button rows, metadata and cached identity with the actual SDK`, async () => {
    const source = buttonPage(style);
    const { message } = await ownedMessage(style, source);
    const actual = sdkMessage(Vendor, source).message;
    assert.equal(message.buttonCount, actual.buttonCount);
    assert.equal(message.buttonCount, 4);
    assert.equal(await message.getButtons(), message.buttons);
    assert.equal(message.buttons[0][0], message.buttons[0][0]);
    for (const [row, entries] of message.buttons.entries()) {
      for (const [column, button] of entries.entries()) {
        const expected = actual.buttons[row][column];
        assert.equal(button.client, message.client);
        for (const key of ['text', 'inlineQuery', 'url']) {
          assert.equal(button[key], expected[key]);
        }
        assert.deepEqual(
          button.data && [...button.data],
          expected.data && [...expected.data]
        );
        assert.equal(
          button.button,
          message.replyMarkup.rows[row].buttons[column]
        );
      }
    }
  });
  for (const [kind, selector] of [
    ['callback', { i: 0 }],
    ['game', { i: 1, j: 0 }],
    ['url', { text: 'url' }],
  ]) {
    it(`compares actual ${style} ${kind} clicks and complete callback request bytes`, async () => {
      const source = buttonPage(style);
      const requests = [];
      const actual = sdkMessage(Vendor, source).message;
      actual.client.invoke = async (request) => {
        requests.push(request);
        return {
          _: 'messages.botCallbackAnswer',
          cache_time: 0,
          message: 'ok',
        };
      };
      const { message, calls } = await ownedMessage(style, source, () => ({
        _: 'messages.botCallbackAnswer',
        cache_time: 0,
        message: 'ok',
      }));
      const expected = await actual.click(selector);
      const result = await message.click(selector);
      if (kind === 'url') {
        assert.equal(result, expected);
        assert.equal(calls.length, 0);
      } else {
        assert.equal(result.message, expected.message);
        assert.equal(calls.length, 1);
        assert.deepEqual(
          Buffer.from(wireValue({ _: calls[0][0], ...calls[0][1] })),
          Buffer.from(requests[0].getBytes())
        );
      }
    });
  }
  it(`sends ${style} plain keyboard text through the bound origin without parsing`, async () => {
    const source = buttonPage(style, ['text']);
    const actual = sdkMessage(Vendor, source).message;
    const requests = [];
    actual.client.sendMessage = async (...args) => requests.push(args);
    await actual.click({});
    const { message, calls } = await ownedMessage(style, source, () => ({
      _: 'updateShortSentMessage',
      id: 42,
      date: 1,
      pts: 1,
      pts_count: 1,
      out: true,
    }));
    const result = await message.click({});
    assert.equal(result.id, 42);
    assert.equal(result.rawText, requests[0][1].message);
    assert.equal(calls[0][0], 'messages.sendMessage');
    assert.equal(calls[0][1].peer.access_hash, 17n);
    assert.equal(calls[0][1].message, 'text');
    assert.deepEqual(calls[0][1].entities, []);
  });
  it(`compares ${style} inline start-bot requests with the actual SDK`, async () => {
    const source = buttonPage(style, ['switchInline']);
    const actual = sdkMessage(Vendor, source).message;
    const requests = [];
    actual.client.invoke = async (request) => {
      await request.resolve(
        actual.client,
        style === 'gramjs' ? GramUtils : TeleUtils
      );
      requests.push(request);
      return { _: 'updatesTooLong' };
    };
    await actual.click({});
    const { message, calls } = await ownedMessage(style, source);
    await message.click({});
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'messages.startBot');
    assert.equal(calls[0][1].bot._, 'inputUser');
    assert.equal(calls[0][1].bot.user_id, 9n);
    assert.equal(calls[0][1].bot.access_hash, 17n);
    assert.equal(calls[0][1].start_param, requests[0].startParam);
    assert.equal(typeof calls[0][1].random_id, 'bigint');
    assert.equal(calls[0][1].peer.user_id, BigInt(requests[0].peer.userId));
    const expected = canonical(requests[0]);
    expected.random_id = calls[0][1].random_id;
    assert.deepEqual(
      wireValue({ _: calls[0][0], ...calls[0][1] }),
      wireValue(expected)
    );
  });
  for (const selector of [
    { i: 2 },
    { text: 'Two' },
    { text: (value) => value.text === 'Two' },
    { filter: (answer) => answer.text.text === 'Two' },
    { text: 'Missing' },
    {},
  ]) {
    it(`compares ${style} poll selector ${Object.keys(selector).join() || 'retract'} with actual SDK wire bytes`, async () => {
      const source = pollPage();
      const actual = sdkMessage(Vendor, source).message;
      const requests = [];
      actual.client.invoke = async (request) => {
        requests.push(request);
        return { _: 'updatesTooLong' };
      };
      await actual.click(selector);
      const { message, calls } = await ownedMessage(style, source);
      await message.click(selector);
      assert.equal(calls.length, 1);
      assert.deepEqual(
        Buffer.from(wireValue({ _: calls[0][0], ...calls[0][1] })),
        Buffer.from(requests[0].getBytes())
      );
    });
  }
  it(`fixes the actual ${style} poll multi-index bug using requested option bytes`, async () => {
    const source = pollPage();
    const actual = sdkMessage(Vendor, source).message;
    let vendorRequest;
    actual.client.invoke = async (request) => {
      vendorRequest = canonical(request);
      return { _: 'updatesTooLong' };
    };
    await actual.click({ i: [2, 0] });
    assert.deepEqual(
      vendorRequest.options.map((option) => [...option]),
      [[10], [11]]
    );
    const { message, calls } = await ownedMessage(style, source);
    await message.click({ i: [2, 0] });
    assert.deepEqual(
      calls[0][1].options.map((option) => [...option]),
      [[12], [10]]
    );
  });
}
