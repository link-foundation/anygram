import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { MarkdownParser as GramMarkdown } from 'telegram/extensions/markdown.js';
import { MarkdownParser as TeleMarkdown } from 'teleproto/extensions/markdown.js';
import { MarkdownV2Parser as TeleV2 } from 'teleproto/extensions/markdownv2.js';
import { MarkdownV2Parser as GramV2 } from 'telegram/extensions/markdownv2.js';
import * as Package from '../src/index.js';
import {
  canonical,
  ownedMessage,
  messagePage,
} from './fixtures/account-message-models.js';

const entity = (name, offset, length, fields = {}) => ({
  _: `messageEntity${name}`,
  offset,
  length,
  ...fields,
});
const parsed = (Parser, source) => {
  const [text, entities] = Parser.parse(source);
  return [
    text,
    canonical(entities).map((value) =>
      Object.fromEntries(
        Object.entries(value).filter(([, field]) => field !== undefined)
      )
    ),
  ];
};

for (const [parser, name, marker] of [
  ['MarkdownParser', 'Bold', '**'],
  ['MarkdownParser', 'Italic', '__'],
  ['MarkdownParser', 'Strike', '~~'],
  ['MarkdownParser', 'Code', '`'],
  ['MarkdownV2Parser', 'Bold', '*'],
  ['MarkdownV2Parser', 'Italic', '_'],
  ['MarkdownV2Parser', 'Underline', '__'],
  ['MarkdownV2Parser', 'Strike', '~'],
  ['MarkdownV2Parser', 'Spoiler', '||'],
  ['MarkdownV2Parser', 'Code', '`'],
]) {
  it(`parses ${parser} ${name} with exact UTF-16 offsets`, () => {
    const source = `🚀 ${marker}Ada${marker}`;
    const expected = ['🚀 Ada', [entity(name, 3, 3)]];
    assert.deepEqual(parsed(Package[parser], source), expected);
    for (const Vendor of parser === 'MarkdownParser'
      ? [GramMarkdown, TeleMarkdown]
      : [TeleV2]) {
      assert.deepEqual(parsed(Vendor, source), expected);
    }
    assert.equal(
      Package[parser].unparse(...Package[parser].parse(source)),
      source
    );
  });
}

for (const name of ['MarkdownParser', 'MarkdownV2Parser']) {
  for (const [source, text, entities] of [
    ['```js\nx < y\n```', 'x < y\n', [entity('Pre', 0, 5, { language: 'js' })]],
    ['```print(1)```', 'print(1)', [entity('Pre', 0, 8, { language: '' })]],
    [
      '`**literal** _literal_`',
      '**literal** _literal_',
      [entity('Code', 0, 21)],
    ],
    ['`a\\`b\\\\c`', 'a`b\\c', [entity('Code', 0, 5)]],
    [
      '[Ada](https://example.com/a\\))',
      'Ada',
      [entity('TextUrl', 0, 3, { url: 'https://example.com/a)' })],
    ],
    [
      '[Ada](tg://user?id=9007199254740993)',
      'Ada',
      [entity('MentionName', 0, 3, { user_id: 9007199254740993n })],
    ],
    [
      '![🚀](tg://emoji?id=9007199254740993)',
      '🚀',
      [entity('CustomEmoji', 0, 2, { document_id: 9007199254740993n })],
    ],
    [
      '[different](mailto:a@example.com)',
      'different',
      [entity('TextUrl', 0, 9, { url: 'mailto:a@example.com' })],
    ],
    [
      '[a@example.com](mailto:a@example.com)',
      'a@example.com',
      [entity('Email', 0, 13)],
    ],
    [
      '[https://example.com](https://example.com)',
      'https://example.com',
      [entity('Url', 0, 19)],
    ],
    [
      '[`a]b`](https://example.com)',
      'a]b',
      [
        entity('Code', 0, 3),
        entity('TextUrl', 0, 3, { url: 'https://example.com' }),
      ],
    ],
    ['[broken](unfinished', '[broken](unfinished', []],
    [
      '![tomorrow](tg://time?unix=1700000000&format=wDT)',
      'tomorrow',
      [
        entity('FormattedDate', 0, 8, {
          date: 1700000000,
          day_of_week: true,
          long_date: true,
          long_time: true,
        }),
      ],
    ],
  ]) {
    it(`handles ${name} protected constructs ${source}`, () => {
      // A link around code is forbidden by Telegram's nesting rules.
      if (source.startsWith('[`')) {
        assert.throws(() => Package[name].parse(source), /cannot be nested/);
        return;
      }
      const expected = name === 'MarkdownV2Parser' ? text.trim() : text;
      assert.deepEqual(parsed(Package[name], source), [expected, entities]);
    });
  }
}

for (const [source, text, entities] of [
  [
    '*outer _inner_ end*',
    'outer inner end',
    [entity('Italic', 6, 5), entity('Bold', 0, 15)],
  ],
  [
    '___nested_**__',
    'nested',
    [entity('Italic', 0, 6), entity('Underline', 0, 6)],
  ],
  [
    '___nested_\r__',
    'nested',
    [entity('Italic', 0, 6), entity('Underline', 0, 6)],
  ],
  ['>one\n>two\nplain', 'one\ntwo\nplain', [entity('Blockquote', 0, 7)]],
  [
    '**>one\n>two||',
    'one\ntwo',
    [entity('Blockquote', 0, 7, { collapsed: true })],
  ],
  [
    '>||secret||',
    'secret',
    [entity('Spoiler', 0, 6), entity('Blockquote', 0, 6)],
  ],
  [
    '>one\n**>two||',
    'one\ntwo',
    [
      entity('Blockquote', 0, 3),
      entity('Blockquote', 4, 3, { collapsed: true }),
    ],
  ],
  ['\\*literal\\* \\! \\.', '*literal* ! .', []],
  ['  *a*  ', 'a', [entity('Bold', 0, 1)]],
  ['*unclosed', '*unclosed', []],
  ['a-b', 'a-b', []],
]) {
  it(`parses MarkdownV2 structure ${JSON.stringify(source)}`, () => {
    assert.deepEqual(parsed(Package.MarkdownV2Parser, source), [
      text,
      entities,
    ]);
    assert.deepEqual(parsed(TeleV2, source), [text, entities]);
  });
}

for (const [source, text, entities] of [
  [
    '**outer __inner__ end**',
    'outer inner end',
    [entity('Italic', 6, 5), entity('Bold', 0, 15)],
  ],
  ['**unclosed', '**unclosed', []],
  ['\\**literal\\**', '**literal**', []],
  ['  **a**  ', '  a  ', [entity('Bold', 2, 1)]],
]) {
  it(`retains legacy Markdown semantics and explicit corrections ${source}`, () => {
    assert.deepEqual(parsed(Package.MarkdownParser, source), [text, entities]);
  });
}

for (const [alias, name, source] of [
  ['md', 'MarkdownParser', '**Ada**'],
  ['markdown', 'MarkdownParser', '**Ada**'],
  ['md2', 'MarkdownV2Parser', '*Ada*'],
  ['markdownv2', 'MarkdownV2Parser', '*Ada*'],
]) {
  for (const style of ['canonical', 'gramjs', 'teleproto']) {
    it(`uses ${alias} in ${style} sends, views and bound helpers`, async () => {
      const page = messagePage();
      page.messages[0].message = 'Ada';
      page.messages[0].entities = [entity('Bold', 0, 3)];
      const { client, message, calls } = await ownedMessage(
        style === 'canonical' ? 'teleproto' : style,
        page
      );
      client.setParseMode(alias);
      assert.equal(client.parseMode, Package[name]);
      assert.equal(message.text, source);
      message.text = source;
      assert.equal(message.rawText, 'Ada');
      if (style === 'canonical') {
        await client.sendMessage('me', source);
      } else {
        await client[style].sendMessage('me', { message: source });
      }
      await message.reply({ message: source });
      await message.edit({ text: source });
      assert.deepEqual(
        calls.map((call) => [call[1].message, call[1].entities]),
        Array.from({ length: 3 }, () => ['Ada', [entity('Bold', 0, 3)]])
      );
      assert.equal(calls[1][1].peer.access_hash, 17n);
      assert.equal(calls[2][1].peer.access_hash, 17n);
    });
  }
}

for (const path of ['markdown', 'markdownv2']) {
  for (const suffix of ['', '.js']) {
    it(`supports SDK-style ${path}${suffix} imports`, async () => {
      const module = await import(`anygram/extensions/${path}${suffix}`);
      const name = path === 'markdown' ? 'MarkdownParser' : 'MarkdownV2Parser';
      assert.equal(module[name], Package[name]);
    });
  }
}

it('retains actual SDK code-fence, code-isolation and MarkdownV2 differences', () => {
  for (const Vendor of [GramMarkdown, TeleMarkdown]) {
    assert.notDeepEqual(
      parsed(Vendor, '```js\nx\n```'),
      parsed(Package.MarkdownParser, '```js\nx\n```')
    );
    assert.notDeepEqual(
      parsed(Vendor, '`**literal**`'),
      parsed(Package.MarkdownParser, '`**literal**`')
    );
  }
  assert.notDeepEqual(
    parsed(GramV2, '_italic_'),
    parsed(Package.MarkdownV2Parser, '_italic_')
  );
  assert.deepEqual(
    parsed(TeleV2, '_italic_'),
    parsed(Package.MarkdownV2Parser, '_italic_')
  );
});

it('exports the immutable legacy SDK delimiter vocabulary with owned classes', () => {
  assert.deepEqual(Object.keys(Package.DEFAULT_DELIMITERS), [
    '**',
    '__',
    '~~',
    '`',
    '```',
  ]);
  assert(Object.isFrozen(Package.DEFAULT_DELIMITERS));
  assert.equal(Package.DEFAULT_DELIMITERS['**'], Package.Api.MessageEntityBold);
});

it('honors every escaped ASCII character without treating it as markup', () => {
  for (let code = 1; code <= 126; code++) {
    const char = String.fromCharCode(code);
    assert.equal(
      Package.MarkdownV2Parser.parse(`x\\${char}y`)[0],
      `x${char}y`,
      `${code}`
    );
    assert.equal(TeleV2.parse(`x\\${char}y`)[0], `x${char}y`, `${code}`);
  }
});
