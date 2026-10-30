import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { HTMLParser as GramHtml } from 'telegram/extensions/html.js';
import * as Package from '../src/index.js';
import references from '../src/schema/html-entities.json' with { type: 'json' };
import { canonical, ownedMessage } from './fixtures/account-message-models.js';

it('decodes every standard named character reference without trimming its body', () => {
  assert.equal(Object.keys(references).length, 2231);
  for (const [name, value] of Object.entries(references)) {
    assert.equal(Package.HTMLParser.parse(`x&${name}y`)[0], `x${value}y`, name);
    assert.equal(GramHtml.parse(`x&${name}y`)[0], `x${value}y`, name);
  }
});

for (const [source, expected] of [
  ['x <3> y', 'x <3> y'],
  ['x < y', 'x < y'],
  ['x <<b>y</b>', 'x <y'],
  ['x<a href="unfinished>x', 'x<a href="unfinished>x'],
  ['x &notin; &notit; &unknown; y', 'x ∉ ¬it; &unknown; y'],
]) {
  it(`preserves literal or malformed HTML ${source}`, () => {
    assert.equal(Package.HTMLParser.parse(source)[0], expected);
  });
}

for (const [href, expected] of [
  ['?a=&amp=b', '?a=&amp=b'],
  ['?a=&ampb', '?a=&ampb'],
  ['?a=&amp;b', '?a=&b'],
  ['?a=&notit;', '?a=&notit;'],
  ['?a=&#38;b', '?a=&b'],
]) {
  it(`applies attribute character-reference rules ${href}`, () => {
    const [, entities] = Package.HTMLParser.parse(`<a href="${href}">x</a>`);
    assert.equal(entities[0].url, expected);
  });
}

for (const Vendor of [Package.Api, GramApi, TeleApi]) {
  it(`unparses real ${Vendor === GramApi ? 'GramJS' : Vendor === TeleApi ? 'teleproto' : 'owned'} entity constructors`, () => {
    const values = [
      new Vendor.MessageEntityBold({ offset: 0, length: 3 }),
      new Vendor.MessageEntityItalic({ offset: 1, length: 1 }),
    ];
    assert.equal(
      Package.HTMLParser.unparse('abc', values),
      '<strong>a<em>b</em>c</strong>'
    );
    assert.equal(values[0].length, 3);
  });
}

it('renders equal, nested and adjacent spans with balanced tags', () => {
  const values = [
    { _: 'messageEntityBold', offset: 0, length: 2 },
    { _: 'messageEntityItalic', offset: 0, length: 2 },
    { _: 'messageEntityUnderline', offset: 2, length: 1 },
  ];
  const output = Package.HTMLParser.unparse('abc', values);
  assert.equal(output, '<strong><em>ab</em></strong><u>c</u>');
  assert.equal(Package.HTMLParser.parse(output)[0], 'abc');
});

for (const source of [
  '<b><code>x</code></b>',
  '<pre><i>x</i></pre>',
  '<b><tg-date timestamp="1">x</tg-date></b>',
]) {
  it(`rejects forbidden nested isolated entities ${source}`, () => {
    assert.throws(() => Package.HTMLParser.parse(source), /cannot be nested/);
  });
}

it('rejects excessive tags and escaped output with finite inputs', () => {
  assert.throws(
    () => Package.HTMLParser.parse('<br>'.repeat(100001)),
    /token limit/
  );
  assert.throws(
    () => Package.HTMLParser.unparse('&'.repeat(900000)),
    /text limit/
  );
});

it('bounds attributes with a finite duplicate-key input', () => {
  assert.throws(
    () => Package.HTMLParser.parse(`<a ${'x '.repeat(1001)}>a</a>`),
    /attribute limit/
  );
});
it('rejects inexact numeric IDs before rendering', () => {
  assert.throws(
    () =>
      Package.HTMLParser.unparse('x', [
        {
          _: 'messageEntityCustomEmoji',
          offset: 0,
          length: 1,
          document_id: 9007199254740992,
        },
      ]),
    /exact/
  );
});

it('keeps source entities detached and exact mentions on builtin account sends', async () => {
  const { client, calls } = await ownedMessage('teleproto');
  await client.teleproto.sendMessage(
    { _: 'inputPeerSelf' },
    { message: '<a href="tg://user?id=9">Ada</a>', parseMode: 'html' }
  );
  assert.deepEqual(canonical(calls[0][1].entities), [
    {
      _: 'inputMessageEntityMentionName',
      offset: 0,
      length: 3,
      user_id: { _: 'inputUser', user_id: 9n, access_hash: 17n },
    },
  ]);
});

it('rejects malformed HTML before mutation of a message text view', async () => {
  const { client, message, calls } = await ownedMessage('teleproto');
  client.setParseMode('html');
  assert.throws(() => {
    message.text = '<tg-emoji emoji-id="0">x</tg-emoji>';
  });
  assert.equal(message.rawText, 'Original');
  assert.equal(calls.length, 0);
});
