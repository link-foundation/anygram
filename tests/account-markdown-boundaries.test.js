import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as Package from '../src/index.js';
import { canonical } from './fixtures/account-message-models.js';

for (const name of ['MarkdownParser', 'MarkdownV2Parser']) {
  for (const Vendor of [Package.Api, GramApi, TeleApi]) {
    it(`renders real ${name} entity constructors from ${Vendor === GramApi ? 'GramJS' : Vendor === TeleApi ? 'teleproto' : 'owned'}`, () => {
      const entities = [
        new Vendor.MessageEntityBold({ offset: 0, length: 3 }),
        new Vendor.MessageEntityItalic({ offset: 1, length: 1 }),
      ];
      const snapshot = canonical(entities);
      const Parser = Package[name];
      const [text, spans] = Parser.parse(Parser.unparse('abc', entities));
      assert.equal(text, 'abc');
      assert.deepEqual(
        canonical(spans)
          .map(({ _, offset, length }) => [_, offset, length])
          .sort(),
        snapshot.map(({ _, offset, length }) => [_, offset, length]).sort()
      );
      assert.deepEqual(canonical(entities), snapshot);
    });
  }
  it(`bounds ${name} input, nesting, tokens, output and entity counts`, () => {
    const Parser = Package[name];
    const marker = name === 'MarkdownParser' ? '**' : '*';
    assert.throws(
      () => Parser.parse('x'.repeat(4 * 1024 * 1024 + 1)),
      /text limit/
    );
    assert.throws(
      () => Parser.parse(`${marker}x${marker} `.repeat(1001)),
      /entity limit/
    );
    assert.throws(() => Parser.parse('\\a'.repeat(100001)), /token limit/);
    assert.throws(
      () => Parser.unparse('\\'.repeat(3 * 1024 * 1024)),
      /text limit/
    );
    assert.throws(
      () =>
        Parser.unparse('x', [{ _: 'messageEntityBold', offset: 0, length: 2 }]),
      /bounds/
    );
    assert.throws(
      () =>
        Parser.unparse(
          'x',
          Array.from({ length: 65 }, () => ({
            _: 'messageEntityBold',
            offset: 0,
            length: 1,
          }))
        ),
      /nesting limit/
    );
    assert.throws(() => Parser.parse('`x`'.repeat(1001)), /entity limit/);
  });
  for (const source of [
    '![x](tg://emoji?id=0)',
    '[x](tg://user?id=9223372036854775808)',
    '![x](tg://time?unix=NaN)',
    '![x](tg://time?unix=1&format=rd)',
  ]) {
    it(`rejects malformed ${name} identifiers ${source}`, () =>
      assert.throws(
        () => Package[name].parse(source),
        /identifier|date|format/
      ));
  }
  it(`keeps ${name} unmatched delimiters, malformed links and escaped label boundaries`, () => {
    const Parser = Package[name];
    for (const source of [
      '[',
      '[a](b',
      '`unfinished',
      '```unfinished',
      '![a](b',
    ]) {
      assert.equal(Parser.parse(source)[0], source);
    }
    assert.equal(Parser.parse('[a\\]b](https://example.com)')[0], 'a]b');
  });
}

it('round-trips MarkdownV2 quotes, protected code and adjacent underscore markers', () => {
  for (const source of [
    '>a\n>b\nplain',
    '**>a\n>b||',
    '___x_**__',
    '_a__b_',
    '__a____b__',
    '```js\nx\\`y\\\\z\n```',
    '[a\\]b](https://example.com/a\\))',
  ]) {
    const Parser = Package.MarkdownV2Parser;
    const [text, entities] = Parser.parse(source);
    const next = Parser.parse(Parser.unparse(text, entities));
    assert.equal(next[0], text);
    const shape = (values) =>
      canonical(values)
        .map((v) => [v._, v.offset, v.length, v.url, v.language, v.collapsed])
        .sort();
    assert.deepEqual(shape(next[1]), shape(entities));
  }
});

it('escapes every MarkdownV2 special character and code/URL contexts', () => {
  const Parser = Package.MarkdownV2Parser;
  const text = '_*[]()~`>#+-=|{}.!\\';
  assert.equal(Parser.parse(Parser.unparse(text))[0], text);
  const entities = [
    {
      _: 'messageEntityTextUrl',
      offset: 0,
      length: text.length,
      url: 'https://example.com/a)\\b',
    },
  ];
  const result = Parser.parse(Parser.unparse(text, entities));
  assert.equal(result[0], text);
  assert.deepEqual(canonical(result[1]), entities);
});

for (const source of [
  '>*x*',
  '>||secret||',
  '>_x_',
  '>*x*||',
  '>[x](https://example.com)',
]) {
  it(`keeps a full-span MarkdownV2 quote outside its formatting: ${source}`, () => {
    const Parser = Package.MarkdownV2Parser;
    const [text, entities] = Parser.parse(source);
    const shape = (values) =>
      canonical(values).sort((a, b) => a._.localeCompare(b._));
    for (const spans of [entities, [...entities].reverse()]) {
      const [next, result] = Parser.parse(Parser.unparse(text, spans));
      assert.equal(next, text);
      assert.deepEqual(shape(result), shape(entities));
    }
  });
}

for (const format of ['', 'r', 'w', 'd', 'D', 't', 'T', 'wDT', 'dt', 'wDt']) {
  it(`round-trips current formatted dates ${format || 'plain'}`, () => {
    const source = `![tomorrow](tg://time?unix=1700000000${format ? `&format=${format}` : ''})`;
    const Parser = Package.MarkdownV2Parser;
    const [text, entities] = Parser.parse(source);
    assert.equal(Parser.unparse(text, entities), source);
    const [htmlText, htmlEntities] = Package.HTMLParser.parse(
      `<tg-time unix="1700000000" format="${format}">tomorrow</tg-time>`
    );
    assert.equal(htmlText, text);
    assert.deepEqual(canonical(htmlEntities), canonical(entities));
  });
}

it('rejects crossing spans and nested isolated entities before Markdown rendering', () => {
  const Parser = Package.MarkdownV2Parser;
  assert.throws(() => Parser.parse('*a _b* c_'), /overlap/);
  assert.throws(() => Parser.parse('*`x`*'), /cannot be nested/);
  assert.throws(
    () =>
      Parser.unparse('abc', [
        { _: 'messageEntityItalic', offset: 0, length: 2 },
        { _: 'messageEntityBold', offset: 1, length: 2 },
      ]),
    /overlap/
  );
  assert.throws(
    () =>
      Parser.unparse('x', [
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
