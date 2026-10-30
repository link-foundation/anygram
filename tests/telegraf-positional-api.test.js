import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Telegram as ReferenceTelegram } from 'telegraf';
import { bold as referenceBold, FmtString } from 'telegraf/format';
import { Bot, BotApi } from '../src/index.js';

const inventory = JSON.parse(
  readFileSync(
    new globalThis.URL(
      '../docs/case-studies/issue-1/data/telegraf-bot-signatures.json',
      import.meta.url
    )
  )
);
const token = 'telegraf:fixture';
const root = 'https://files.example.invalid';
const json = (value) => JSON.parse(JSON.stringify(value));

function clients(file = { file_path: 'photos/example.jpg' }) {
  const reference = new ReferenceTelegram(token, { apiRoot: root });
  const transport = new BotApi({ token, baseUrl: root });
  const call = (method, params) =>
    Promise.resolve(method === 'getFile' ? file : json({ method, params }));
  reference.callApi = call;
  transport.callApi = call;
  return { reference, actual: new Bot(token, { api: transport }).telegram };
}

function argumentValue({ name, fields }) {
  if (fields) {
    return {
      chatId: 7,
      menuButton: { type: 'commands' },
      rights: { can_manage_chat: true },
      forChannels: true,
    };
  }
  if (['extra', 'invoice', 'stickerData'].includes(name)) {
    return { fixture_extra: name };
  }
  if (name === 'message') {
    return { chat: { id: 8 }, message_id: 9 };
  }
  if (name === 'media') {
    return { type: 'photo', media: 'file-id', caption: 'caption' };
  }
  if (name === 'options') {
    return ['yes', 'no'];
  }
  return `fixture:${name}`;
}

function argsFor(name) {
  const entry = inventory.methods[name];
  const method = inventory.methods[entry.alias] ?? entry;
  return method.args.map(argumentValue);
}

it('inventories every public member on the actual Telegraf Telegram prototype', () => {
  assert.deepEqual(
    Object.getOwnPropertyNames(ReferenceTelegram.prototype)
      .filter((name) => name !== 'constructor')
      .sort(),
    Object.keys(inventory.methods).sort()
  );
});

for (const name of Object.keys(inventory.methods)) {
  it(`matches the actual pinned Telegraf positional method ${name}`, async () => {
    const { reference, actual } = clients();
    const args = argsFor(name);
    assert.deepEqual(
      await actual[name](...args),
      await reference[name](...args)
    );
  });
}

it('retains game-score defaults and explicit false overrides', async () => {
  const { reference, actual } = clients();
  for (const tail of [[], [false], [false, true], [undefined, undefined]]) {
    assert.deepEqual(
      await actual.setGameScore(7, 100, undefined, 8, 9, ...tail),
      await reference.setGameScore(7, 100, undefined, 8, 9, ...tail)
    );
  }
});

it('retains default object arguments and does not mutate positional options', async () => {
  const { reference, actual } = clients();
  for (const name of [
    'getMyCommands',
    'deleteMyCommands',
    'setChatMenuButton',
    'getChatMenuButton',
    'setMyDefaultAdministratorRights',
    'getMyDefaultAdministratorRights',
  ]) {
    assert.deepEqual(await actual[name](), await reference[name]());
  }
  const options = Object.freeze({
    chat_id: 88,
    text: 'overridden',
    caption: 'override caption',
    type: 'quiz',
  });
  for (const [name, args] of [
    ['sendMessage', [7, 'message']],
    ['sendPoll', [7, 'question', ['yes', 'no']]],
    ['editMessageCaption', [7, 9, undefined, 'caption']],
  ]) {
    assert.deepEqual(
      await actual[name](...args, options),
      await reference[name](...args, options)
    );
  }
});

it('preserves actual Telegraf formatted text and caption entities', async () => {
  const { reference, actual } = clients();
  const text = referenceBold('hello');
  const options = Object.freeze({ parse_mode: 'HTML', caption: text });
  for (const [name, args] of [
    ['sendMessage', [7, text, { parse_mode: 'HTML' }]],
    ['editMessageText', [7, 9, undefined, text, { parse_mode: 'HTML' }]],
    ['sendPhoto', [7, 'photo', options]],
    ['copyMessage', [7, 8, 9, options]],
    [
      'editMessageMedia',
      [
        7,
        9,
        undefined,
        { type: 'photo', media: 'file', caption: text, parse_mode: 'HTML' },
      ],
    ],
  ]) {
    assert.deepEqual(
      await actual[name](...args),
      await reference[name](...args)
    );
  }
});

it('preserves plain FmtString values without creating empty entity arrays', async () => {
  const { reference, actual } = clients();
  for (const text of [new FmtString('plain'), new FmtString('plain', [])]) {
    for (const [name, args] of [
      ['sendMessage', [7, text, { parse_mode: 'HTML' }]],
      ['sendPhoto', [7, 'file', { caption: text, parse_mode: 'HTML' }]],
      ['editMessageCaption', [7, 9, undefined, text, { parse_mode: 'HTML' }]],
    ]) {
      assert.deepEqual(
        await actual[name](...args),
        await reference[name](...args)
      );
    }
  }
});

it('resolves supplied file metadata and missing paths like the actual SDK', async () => {
  const { reference, actual } = clients();
  for (const file of [
    { file_id: 'lookup' },
    { file_path: 'docs/file.pdf' },
    { file_path: '/tmp/file.pdf' },
  ]) {
    assert.equal(
      String(await actual.getFileLink(file)),
      String(await reference.getFileLink(file))
    );
  }
});

it('retains embedded controls when final request fields are undefined', async () => {
  const signal = new globalThis.AbortController().signal;
  let received;
  const api = new Bot(token, {
    api: {
      callApi: (...args) => {
        received = args;
        return Promise.resolve(true);
      },
    },
  }).telegram;
  const extra = Object.freeze({
    signal,
    timeout: 80,
    disable_notification: true,
  });
  await api.forwardMessage(7, 8, 9, extra, {
    signal: undefined,
    timeout: undefined,
  });
  assert.deepEqual(received, [
    'forwardMessage',
    { chat_id: 7, from_chat_id: 8, message_id: 9, disable_notification: true },
    { signal, timeout: 80 },
  ]);
});

it('preserves separate request controls on every public positional RPC', async () => {
  const signal = new globalThis.AbortController().signal;
  const timeout = 150;
  const extraSignal = new globalThis.AbortController().signal;
  let received;
  const api = new Bot(token, {
    api: {
      callApi: (...args) => {
        received = args;
        return Promise.resolve(true);
      },
    },
  }).telegram;
  for (const [name, item] of Object.entries(inventory.methods)) {
    const entry = inventory.methods[item.alias] ?? item;
    if (entry.helper) {
      continue;
    }
    const args = argsFor(name);
    const index = entry.args.findIndex((arg) => arg.name === 'extra');
    if (index >= 0) {
      args[index] = { signal: extraSignal, timeout: 999, fixture: name };
    }
    const before = args.map((arg) =>
      Array.isArray(arg)
        ? [...arg]
        : typeof arg === 'object' && arg !== null
          ? { ...arg }
          : arg
    );
    await api[name](...args, { signal, timeout });
    assert.deepEqual(received[2], { signal, timeout }, name);
    assert.equal(Object.hasOwn(received[1], 'signal'), false, name);
    assert.deepEqual(args, before, name);
  }
});
