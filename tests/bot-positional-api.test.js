import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Api as ReferenceApi } from 'grammy';
import { Bot, bold } from '../src/index.js';

const inventory = JSON.parse(
  readFileSync(
    new globalThis.URL(
      '../docs/case-studies/issue-1/data/grammy-bot-signatures.json',
      import.meta.url
    )
  )
);
const alias = {
  kickChatMember: 'banChatMember',
  getChatMembersCount: 'getChatMemberCount',
};
function argumentsFor(name, signal) {
  return inventory.methods[alias[name] ?? name].args.map((field) => {
    if (field === 'signal') {
      return signal;
    }
    if (field === 'other') {
      return { fixture_extra: 'preserved' };
    }
    if (field === 'options') {
      return ['yes', { text: 'no' }];
    }
    if (field === 'text_or_rich_message') {
      return 'text';
    }
    return `fixture:${field}`;
  });
}

function clients() {
  const reference = new ReferenceApi('positional:fixture');
  reference.config.use((previous, method, params, signal) =>
    Promise.resolve({ ok: true, result: { method, params, signal } })
  );
  const actual = new Bot('positional:fixture', {
    api: {
      callApi: (method, params, options) =>
        Promise.resolve({ method, params, signal: options?.signal }),
    },
  }).api;
  return { reference, actual };
}

it('inventories every public method on the actual pinned API prototype', () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(ReferenceApi.prototype)
      .filter((name) => name !== 'constructor')
      .sort(),
    Object.keys(inventory.methods).sort()
  );
});

it('preserves unambiguous raw-object calls on newly positional helpers', async () => {
  const { actual } = clients();
  const signal = new globalThis.AbortController().signal;
  for (const [method, params] of [
    ['getChat', { chat_id: 7 }],
    ['banChatMember', { chat_id: 7, user_id: 8, revoke_messages: true }],
    ['setMyProfilePhoto', { photo: { type: 'static', photo: 'file-id' } }],
  ]) {
    Object.freeze(params);
    assert.deepEqual(await actual[method](params, signal), {
      method,
      params,
      signal,
    });
  }
});

it('keeps structured profile photos positional when they contain a photo key', async () => {
  const { reference, actual } = clients();
  const photo = Object.freeze({ type: 'static', photo: 'file-id' });
  assert.deepEqual(
    await actual.setMyProfilePhoto(photo),
    await reference.setMyProfilePhoto(photo)
  );
});

for (const name of Object.keys(inventory.methods)) {
  it(`matches the pinned grammY positional method ${name}`, async () => {
    const { reference, actual } = clients();
    const signal = new globalThis.AbortController().signal;
    const args = argumentsFor(name, signal);
    const expected = await reference[name](...args);
    const received = await actual[name](...args);
    assert.deepEqual(received, expected);
    assert.equal(received.signal, signal);
  });
}

for (const name of [
  'editMessageText',
  'editMessageTextInline',
  'editEphemeralMessageText',
]) {
  it(`matches the actual rich-message branch for ${name}`, async () => {
    const { reference, actual } = clients();
    const args = argumentsFor(name, new globalThis.AbortController().signal);
    args[inventory.methods[name].args.indexOf('text_or_rich_message')] = {
      rows: [{ text: 'rich message' }],
    };
    assert.deepEqual(
      await actual[name](...args),
      await reference[name](...args)
    );
  });
}

it('preserves Telegram long-poll timeouts in positional getUpdates', async () => {
  const { reference, actual } = clients();
  const options = Object.freeze({ timeout: 30, allowed_updates: ['message'] });
  const signal = new globalThis.AbortController().signal;
  assert.deepEqual(
    await actual.getUpdates(options, signal),
    await reference.getUpdates(options, signal)
  );
});

it('retains SDK option overrides and explicit control precedence without mutation', async () => {
  const { reference, actual } = clients();
  const embedded = new globalThis.AbortController().signal;
  const signal = new globalThis.AbortController().signal;
  const fields = Object.freeze({ chat_id: 10, message_id: 11 });
  const expected = await reference.forwardMessage(7, 8, 9, fields, signal);
  assert.deepEqual(
    await actual.forwardMessage(
      7,
      8,
      9,
      Object.freeze({ ...fields, signal: embedded, timeout: 100 }),
      signal
    ),
    expected
  );
});

it('retains separate request options on formerly raw option-only helpers', async () => {
  const calls = [];
  const api = new Bot('controls:fixture', {
    api: {
      callApi: (...args) => {
        calls.push(args);
        return Promise.resolve(true);
      },
    },
  }).api;
  const signal = new globalThis.AbortController().signal;
  const controls = Object.freeze({ signal, timeout: 25 });
  await api.getUpdates({ timeout: 30, offset: 2 }, controls);
  await api.getMyName({ language_code: 'en' }, controls);
  assert.deepEqual(calls, [
    ['getUpdates', { timeout: 30, offset: 2 }, controls],
    ['getMyName', { language_code: 'en' }, controls],
  ]);
});

it('retains owned formatted text in the positional text-edit branch', async () => {
  const { actual } = clients();
  const text = bold('hello');
  assert.deepEqual(await actual.editMessageText(7, 9, text), {
    method: 'editMessageText',
    params: {
      chat_id: 7,
      message_id: 9,
      text: 'hello',
      entities: text.entities,
    },
    signal: undefined,
  });
});

it('rejects non-array or excessive poll options before dispatch', () => {
  const { actual } = clients();
  for (const options of [null, 'yes', new Array(1001)]) {
    assert.throws(() => actual.sendPoll(7, 'Choose', options), /bounded array/);
  }
});
