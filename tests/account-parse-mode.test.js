import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { MarkdownParser as GramMarkdown } from 'telegram/extensions/markdown.js';
import { HTMLParser as TeleHtml } from 'teleproto/extensions/html.js';
import { MarkdownV2Parser as TeleV2 } from 'teleproto/extensions/markdownv2.js';
import * as Package from '../src/index.js';
import {
  ownedMessage,
  messagePage,
  canonical,
  sdkMessage,
} from './fixtures/account-message-models.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { CustomMessage as GramMessage } from 'telegram/tl/custom/message.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { accountTextParams } from '../src/account-text.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const bold = { _: 'messageEntityBold', offset: 3, length: 3 };
const parser = {
  marker: '!',
  parse(text) {
    assert.equal(this.marker, '!');
    return [text.replace(/\*/g, ''), [{ ...bold }]];
  },
  unparse(text, entities) {
    assert.equal(this.marker, '!');
    return `${this.marker}${text}:${entities.length}`;
  },
};

for (const style of ['canonical', 'gramjs', 'teleproto']) {
  for (const action of ['send', 'edit']) {
    it(`shares custom parse modes for ${style} ${action} without mutating input`, async () => {
      const { client, message, calls } = await ownedMessage('teleproto');
      client.setParseMode(parser);
      const options = { [action === 'edit' ? 'text' : 'message']: '🚀 *Ada*' };
      if (action === 'edit') {
        if (style === 'canonical') {
          await client.editMessage(peer, { ...options, id: 7 });
        } else {
          const { message: bound, calls: boundCalls } =
            await ownedMessage(style);
          bound.client.setParseMode(parser);
          await bound.edit(options);
          assert.equal(bound.rawText, 'Original');
          assert.equal(boundCalls[0][1].message, '🚀 Ada');
          assert.deepEqual(boundCalls[0][1].entities, [bold]);
          assert.deepEqual(options, { text: '🚀 *Ada*' });
          return;
        }
      } else {
        await (style === 'canonical' ? client : client[style]).sendMessage(
          peer,
          options
        );
      }
      assert.equal(calls[0][1].message, '🚀 Ada');
      assert.deepEqual(calls[0][1].entities, [bold]);
      assert.deepEqual(options, {
        [action === 'edit' ? 'text' : 'message']: '🚀 *Ada*',
      });
      assert.equal(message.rawText, 'Original');
    });
  }
}

for (const style of ['gramjs', 'teleproto']) {
  it(`shares ${style} parse-mode settings and detached message text views`, async () => {
    const page = messagePage();
    page.messages[0].message = '🚀 Ada';
    page.messages[0].entities = [bold];
    const { client, message } = await ownedMessage(style, page);
    client[style].setParseMode(parser);
    assert.equal(client.parseMode, parser);
    assert.equal(message.text, '!🚀 Ada:1');
    message.text = '🚀 *Ada*';
    assert.equal(message.rawText, '🚀 Ada');
    assert.deepEqual(canonical(message.entities), [bold]);
    assert.equal(page.messages[0].message, '🚀 Ada');
    client[style].setParseMode(undefined);
    assert.equal(message.text, '🚀 Ada');
    message.text = 'Literal *stars*';
    assert.equal(message.rawText, 'Literal *stars*');
    assert.deepEqual(message.entities, []);
  });
  it(`parses ${style} bound replies/edits with their original peer hash`, async () => {
    const { client, message, calls } = await ownedMessage(style);
    client.setParseMode(parser);
    await message.reply({ message: '🚀 *Ada*' });
    await message.edit({ text: '🚀 *Ada*' });
    assert.deepEqual(
      calls.map((call) => call[1].message),
      ['🚀 Ada', '🚀 Ada']
    );
    assert.deepEqual(
      calls.map((call) => call[1].peer.access_hash),
      [17n, 17n]
    );
    assert.deepEqual(
      calls.map((call) => call[1].entities),
      [[bold], [bold]]
    );
    assert.equal(calls[0][1].reply_to.reply_to_msg_id, 7);
    assert.equal(calls[1][1].id, 7);
  });
}

for (const [name, mode, source] of [
  ['actual GramJS Markdown', GramMarkdown, '🚀 **Ada**'],
  ['actual teleproto HTML', TeleHtml, '🚀 <b>Ada</b>'],
  ['actual teleproto MarkdownV2', TeleV2, '🚀 *Ada*'],
]) {
  it(`accepts ${name} parser objects before canonical normalization`, async () => {
    const { client, calls } = await ownedMessage('teleproto');
    await client.sendMessage(peer, source, { parseMode: mode });
    const [text, entities] = mode.parse(source);
    assert.equal(calls[0][1].message, text);
    assert.deepEqual(calls[0][1].entities, canonical(entities));
  });
}

for (const override of [false, [], [bold]]) {
  it(`preserves explicit parsing override ${JSON.stringify(override)}`, async () => {
    const { client, calls } = await ownedMessage('teleproto');
    client.setParseMode({
      parse: () => assert.fail('explicit override parsed'),
      unparse: parser.unparse,
    });
    const options =
      override === false
        ? { parseMode: false }
        : { formattingEntities: override };
    await client.sendMessage(peer, '🚀 *Ada*', options);
    assert.equal(calls[0][1].message, '🚀 *Ada*');
    assert.deepEqual(calls[0][1].entities, override === false ? [] : override);
  });
}

it('copies parse-mode settings into explicitly selected backend scopes', async () => {
  const { client } = await ownedMessage('teleproto');
  client.setParseMode(parser);
  const selected = client.withBackend('native');
  assert.equal(selected.parseMode, parser);
  assert.equal(selected.gramjs.parseMode, parser);
  assert.equal(selected.teleproto.parseMode, parser);
  selected.setParseMode(false);
  assert.equal(selected.parseMode, undefined);
  assert.equal(client.parseMode, parser);
});

for (const entity of [
  { _: 'messageEntityMentionName', user_id: 9007199254740993n },
  { _: 'messageEntityTextUrl', url: 'tg://user?id=9007199254740993' },
  { _: 'messageEntityTextUrl', url: '@ada' },
]) {
  it(`resolves exact parser mention targets ${entity._} ${entity.url ?? ''}`, async () => {
    const page = messagePage();
    page.users.push({
      _: 'user',
      id: 9007199254740993n,
      access_hash: 9007199254740995n,
      username: 'ada',
    });
    const { client, calls } = await ownedMessage('teleproto', page);
    await client.getMessages(peer);
    await client.sendMessage(peer, 'Ada', {
      parseMode: {
        parse: () => ['Ada', [{ ...entity, offset: 0, length: 3 }]],
        unparse: () => '',
      },
    });
    assert.deepEqual(calls[0][1].entities, [
      {
        _: 'inputMessageEntityMentionName',
        offset: 0,
        length: 3,
        user_id: {
          _: 'inputUser',
          user_id: 9007199254740993n,
          access_hash: 9007199254740995n,
        },
      },
    ]);
  });
}

for (const style of ['gramjs', 'teleproto']) {
  it(`resolves ${style} parser mentions from that facade's loaded peers`, async () => {
    const { client, calls } = await ownedMessage(style);
    client.setParseMode({
      parse: () => [
        'Ada',
        [{ _: 'messageEntityMentionName', offset: 0, length: 3, user_id: 9n }],
      ],
      unparse: () => '',
    });
    await client[style].sendMessage(peer, { message: 'Ada' });
    assert.deepEqual(calls[0][1].entities[0].user_id, {
      _: 'inputUser',
      user_id: 9n,
      access_hash: 17n,
    });
  });
}

it('preserves empty formatted text instead of passing it into a string parser', async () => {
  const { client, message, calls } = await ownedMessage('teleproto');
  client.setParseMode({
    parse: () => assert.fail('formatted input parsed'),
    unparse: () => '',
  });
  await client.teleproto.sendMessage(peer, { message: Package.fmt('') });
  await message.reply({ message: Package.fmt('') });
  assert.equal(calls[0][1].message, '');
  assert.deepEqual(calls[0][1].entities, []);
  assert.equal(calls[1][1].message, '');
  assert.deepEqual(calls[1][1].entities, []);
});

for (const [name, Vendor, mode, source] of [
  ['GramJS Markdown', GramApi, GramMarkdown, '🚀 **Ada**'],
  ['teleproto HTML', TeleApi, TeleHtml, '🚀 <b>Ada</b>'],
]) {
  for (const style of ['gramjs', 'teleproto']) {
    it(`compares ${style} message parse/unparse views with actual ${name}`, async () => {
      const page = messagePage();
      const [text, entities] = mode.parse(source);
      page.messages[0].message = text;
      page.messages[0].entities = canonical(entities);
      const sdk = sdkMessage(Vendor, page).message;
      sdk.client.parseMode = mode;
      const { client, message } = await ownedMessage(style, page);
      client.setParseMode(mode);
      assert.equal(message.text, sdk.text);
      message.text = source;
      if (Vendor === GramApi) {
        // The pinned class patch copies the getter and loses this setter.
        assert.throws(() => {
          sdk.text = source;
        }, TypeError);
        Object.getOwnPropertyDescriptor(GramMessage.prototype, 'text').set.call(
          sdk,
          source
        );
      } else {
        sdk.text = source;
      }
      assert.equal(message.rawText, sdk.rawText);
      assert.deepEqual(canonical(message.entities), canonical(sdk.entities));
    });
  }
}

it('passes detached entity objects into custom unparse callbacks', async () => {
  const page = messagePage();
  page.messages[0].message = '🚀 Ada';
  page.messages[0].entities = [bold];
  const { client, message } = await ownedMessage('teleproto', page);
  client.setParseMode({
    parse: () => ['', []],
    unparse: (text, entities) => {
      assert.equal(entities[0].className, 'MessageEntityBold');
      entities[0].offset = 99;
      entities.push({ ...bold });
      return text;
    },
  });
  assert.equal(message.text, '🚀 Ada');
  assert.deepEqual(canonical(message.entities), [bold]);
});

for (const input of [
  true,
  {},
  { parse: () => ['', []] },
  { unparse: () => '' },
  'unsupported',
]) {
  it(`rejects invalid parse-mode configuration ${String(input)} atomically`, () => {
    const client = new Package.Anygram({ parseMode: parser });
    assert.throws(() => client.setParseMode(input), TypeError);
    assert.equal(client.parseMode, parser);
  });
}

for (const user of [
  { _: 'inputPeerSelf' },
  {
    _: 'inputPeerUserFromMessage',
    peer,
    msg_id: 7,
    user_id: 9007199254740993n,
  },
]) {
  it(`retains ${user._} mention identity and context`, async () => {
    const entity = {
      _: 'messageEntityMentionName',
      offset: 0,
      length: 3,
      user_id: 9n,
    };
    const result = await accountTextParams(
      'Ada',
      { entities: [entity] },
      async () => user
    );
    assert.deepEqual(result.entities[0].user_id, {
      ...user,
      _: user._ === 'inputPeerSelf' ? 'inputUserSelf' : 'inputUserFromMessage',
    });
    assert.equal(entity._, 'messageEntityMentionName');
  });
}

it('rejects non-user mention targets', async () => {
  await assert.rejects(
    accountTextParams(
      'Ada',
      {
        entities: [
          { _: 'messageEntityMentionName', offset: 0, length: 3, user_id: 9n },
        ],
      },
      async () => ({ _: 'inputPeerChat', chat_id: 9n })
    ),
    /requires a user/
  );
});

for (const stage of ['input', 'parse output', 'unparse output']) {
  it(`bounds ${stage} text to four million code units`, async () => {
    const oversized = 'a'.repeat(4 * 1024 * 1024 + 1);
    const { client, message, calls } = await ownedMessage('teleproto');
    client.setParseMode({
      parse: (text) => [stage === 'parse output' ? oversized : text, []],
      unparse: () => oversized,
    });
    if (stage === 'unparse output') {
      assert.throws(() => message.text, RangeError);
    } else {
      await assert.rejects(
        client.sendMessage(peer, stage === 'input' ? oversized : 'small'),
        /text limit/
      );
    }
    assert.equal(calls.length, 0);
    assert.equal(message.rawText, 'Original');
  });
}

it('keeps callback state outside TL normalization', async () => {
  const { client, calls } = await ownedMessage('teleproto');
  const mode = { parse: () => ['Ada', []], unparse: () => '' };
  mode.state = mode;
  await client.sendMessage(peer, '*Ada*', { parseMode: mode });
  assert.equal(calls[0][1].message, 'Ada');
  assert.equal('parse_mode' in calls[0][1], false);
  assert.equal('formatting_entities' in calls[0][1], false);
});

it('retains explicit canonical entities on bound edits', async () => {
  const { client, message, calls } = await ownedMessage('teleproto');
  client.setParseMode({
    parse: () => assert.fail('explicit entities parsed'),
    unparse: () => '',
  });
  await message.edit({ text: '🚀 Ada', entities: [bold] });
  assert.deepEqual(calls[0][1].entities, [bold]);
});

for (const result of [
  null,
  ['text'],
  [1, []],
  ['a', {}],
  ['a', [{ ...bold, offset: 0, length: 2 }]],
  ['a', Array(1001).fill({ ...bold })],
]) {
  it(`rejects invalid parser results before transport: ${JSON.stringify(result)?.slice(0, 80)}`, async () => {
    const { client, calls } = await ownedMessage('teleproto');
    await assert.rejects(
      client.sendMessage(peer, 'Input', {
        parseMode: { parse: () => result, unparse: () => '' },
      })
    );
    assert.equal(calls.length, 0);
  });
}

it('does not commit partial message text after a parser failure', async () => {
  const { client, message } = await ownedMessage('teleproto');
  client.setParseMode({
    parse: () => ['bad', [{ ...bold, offset: 99 }]],
    unparse: () => '',
  });
  assert.throws(() => {
    message.text = 'New';
  });
  assert.equal(message.rawText, 'Original');
});

it('honors cancellation before and after custom parsing without sending', async () => {
  for (const stage of ['before', 'after']) {
    const controller = new globalThis.AbortController();
    const reason = new Error(stage);
    const { client, calls } = await ownedMessage('teleproto');
    if (stage === 'before') {
      controller.abort(reason);
    }
    await assert.rejects(
      client.sendMessage(peer, '🚀 *Ada*', {
        signal: controller.signal,
        parseMode: {
          parse: (text) => {
            controller.abort(reason);
            return parser.parse(text);
          },
          unparse: () => '',
        },
      }),
      (error) => error === reason || error.cause === reason
    );
    assert.equal(calls.length, 0);
  }
});

for (const kind of ['gramjs', 'teleproto']) {
  it(`retains ${kind} high-level-only sends with explicit formatting`, async () => {
    const calls = [];
    const backend = {
      async sendMessage(peer, options) {
        calls.push({ peer, options });
        return { _: 'message', id: 7, message: options.message };
      },
    };
    const client = new Package.Anygram({
      adapters: [Package.createAdapter(kind, backend)],
    });
    await client[kind].sendMessage(peer, {
      message: 'Ada',
      entities: [{ _: 'messageEntityBold', offset: 0, length: 3 }],
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].options.entities, [
      { _: 'messageEntityBold', offset: 0, length: 3 },
    ]);
    assert.equal(calls[0].options.message, 'Ada');
  });
}
