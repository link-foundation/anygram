import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { HTMLParser as GramHtml } from 'telegram/extensions/html.js';
import { HTMLParser as TeleHtml } from 'teleproto/extensions/html.js';
import * as Package from '../src/index.js';
import {
  canonical,
  ownedMessage,
  messagePage,
} from './fixtures/account-message-models.js';

const present = (value) =>
  JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === 'bigint' ? `${item}n` : item
    )
  );
const parsed = (source) => {
  const [text, entities] = Package.HTMLParser.parse(source);
  return [
    text,
    canonical(entities).map((value) =>
      Object.fromEntries(
        Object.entries(value).filter(([, item]) => item !== undefined)
      )
    ),
  ];
};
const entity = (name, fields = {}) => ({
  _: `messageEntity${name}`,
  offset: 3,
  length: 3,
  ...fields,
});
const cases = [
  ['b', 'Bold'],
  ['strong', 'Bold'],
  ['i', 'Italic'],
  ['em', 'Italic'],
  ['u', 'Underline'],
  ['ins', 'Underline'],
  ['s', 'Strike'],
  ['del', 'Strike'],
  ['strike', 'Strike'],
  ['spoiler', 'Spoiler'],
  ['tg-spoiler', 'Spoiler'],
  ['span class="tg-spoiler"', 'Spoiler'],
  ['code', 'Code'],
  ['pre', 'Pre', { language: '' }],
  ['blockquote', 'Blockquote'],
  ['blockquote expandable', 'Blockquote', { collapsed: true }],
  ['a href="https://example.com"', 'TextUrl', { url: 'https://example.com' }],
  [
    'a href="tg://user?id=9007199254740993"',
    'MentionName',
    { user_id: 9007199254740993n },
  ],
  [
    'tg-emoji emoji-id="9007199254740993"',
    'CustomEmoji',
    { document_id: 9007199254740993n },
  ],
];
for (const [tag, name, fields] of cases) {
  const source = `🚀 <${tag}>Ada</${tag.split(' ')[0]}>`;
  it(`parses HTML ${tag} with exact UTF-16 fields`, () => {
    assert.deepEqual(parsed(source), ['🚀 Ada', [entity(name, fields)]]);
  });
}

for (const [tag, name, fields] of cases.filter(
  (entry) => !['MentionName', 'CustomEmoji'].includes(entry[1])
)) {
  it(`compares actual SDK HTML parsing for ${tag}`, () => {
    const source = `🚀 <${tag}>Ada</${tag.split(' ')[0]}>`;
    for (const parser of [GramHtml, TeleHtml]) {
      const [text, entities] = parser.parse(source);
      const unsupported =
        parser === GramHtml &&
        ['ins', 'strike', 'tg-spoiler', 'span class="tg-spoiler"'].includes(
          tag
        );
      assert.deepEqual(
        present([text, canonical(entities)]),
        present(['🚀 Ada', unsupported ? [] : [entity(name, fields)]])
      );
    }
    assert.equal(
      Package.HTMLParser.unparse('🚀 Ada', [entity(name, fields)]),
      TeleHtml.unparse(...TeleHtml.parse(source))
    );
  });
}

for (const facade of ['canonical', 'gramjs', 'teleproto']) {
  it(`uses builtin HTML through ${facade} sends and bound edits`, async () => {
    const { client, message, calls } = await ownedMessage(
      facade === 'canonical' ? 'teleproto' : facade
    );
    client.setParseMode('html');
    assert.equal(client.parseMode, Package.HTMLParser);
    if (facade === 'canonical') {
      await client.sendMessage({ _: 'inputPeerSelf' }, '🚀 <b>Ada</b>');
    } else {
      await client[facade].sendMessage(
        { _: 'inputPeerSelf' },
        { message: '🚀 <b>Ada</b>' }
      );
    }
    await message.edit({ text: '🚀 <b>Ada</b>' });
    assert.deepEqual(
      calls.map((call) => call[1].message),
      ['🚀 Ada', '🚀 Ada']
    );
    assert.deepEqual(
      calls.map((call) => call[1].entities),
      [[entity('Bold')], [entity('Bold')]]
    );
    assert.equal(calls[1][1].peer.access_hash, 17n);
  });
}

it('uses HTML for detached message getters and atomic setters', async () => {
  const page = messagePage();
  page.messages[0].message = '🚀 Ada';
  page.messages[0].entities = [entity('Bold')];
  const { client, message } = await ownedMessage('teleproto', page);
  client.teleproto.parseMode = 'html';
  assert.equal(message.text, '🚀 <strong>Ada</strong>');
  message.text = '🚀 <em>Ada</em>';
  assert.equal(message.rawText, '🚀 Ada');
  assert.deepEqual(canonical(message.entities), [entity('Italic')]);
  assert.equal(page.messages[0].entities[0]._, 'messageEntityBold');
});

for (const [source, text, entities] of [
  [
    '<pre><code class="language-js">x &lt; y</code></pre>',
    'x < y',
    [{ _: 'messageEntityPre', offset: 0, length: 5, language: 'js' }],
  ],
  [
    '<pre language="c++">x</pre>',
    'x',
    [{ _: 'messageEntityPre', offset: 0, length: 1, language: 'c++' }],
  ],
  [
    '<a href="mailto:a@example.com">Different</a>',
    'Different',
    [
      {
        _: 'messageEntityTextUrl',
        offset: 0,
        length: 9,
        url: 'mailto:a@example.com',
      },
    ],
  ],
  [
    '<a href="mailto:a@example.com">a@example.com</a>',
    'a@example.com',
    [{ _: 'messageEntityEmail', offset: 0, length: 13 }],
  ],
  [
    '<a href="https://example.com">https://example.com</a>',
    'https://example.com',
    [{ _: 'messageEntityUrl', offset: 0, length: 19 }],
  ],
  ['a<br>b<br/>c', 'a\nb\nc', []],
  [
    '<b>a<i>b</b>c</i>',
    'abc',
    [
      { _: 'messageEntityItalic', offset: 1, length: 1 },
      { _: 'messageEntityBold', offset: 0, length: 2 },
    ],
  ],
  [
    '<b>unclosed',
    'unclosed',
    [{ _: 'messageEntityBold', offset: 0, length: 8 }],
  ],
  [
    '  <b> a <i>b</i> </b>  ',
    'a b',
    [
      { _: 'messageEntityItalic', offset: 2, length: 1 },
      { _: 'messageEntityBold', offset: 0, length: 3 },
    ],
  ],
  ['<unknown x="a>b">a<!-- comment -->b</unknown>', 'ab', []],
  ['<b></b>', '', []],
]) {
  it(`handles HTML structure and text semantics ${source}`, () =>
    assert.deepEqual(parsed(source), [text, entities]));
}

it('preserves all formatted-date flags and exact timestamp seconds', () => {
  const source =
    '<tg-date timestamp="1700000000" relative short-time long-time short-date long-date day-of-week>Ada</tg-date>';
  const [text, entities] = parsed(source);
  assert.equal(text, 'Ada');
  assert.deepEqual(entities, [
    {
      _: 'messageEntityFormattedDate',
      offset: 0,
      length: 3,
      date: 1700000000,
      relative: true,
      short_time: true,
      long_time: true,
      short_date: true,
      long_date: true,
      day_of_week: true,
    },
  ]);
  assert.equal(Package.HTMLParser.unparse(text, entities), source);
});

it('escapes text and attribute boundaries without changing caller entities', () => {
  const entities = [
    {
      _: 'messageEntityTextUrl',
      offset: 0,
      length: 5,
      url: 'https://example.com/?x="&y=<z>',
    },
  ];
  const snapshot = globalThis.structuredClone(entities);
  const html = Package.HTMLParser.unparse('<&>"\'', entities);
  assert.equal(
    html,
    '<a href="https://example.com/?x=&quot;&amp;y=&lt;z&gt;">&lt;&amp;&gt;&quot;&#x27;</a>'
  );
  assert.deepEqual(entities, snapshot);
  assert.deepEqual(parsed(html), ['<&>"\'', snapshot]);
});

it('decodes numeric references and preserves unknown named references', () => {
  assert.deepEqual(
    parsed('&amp;&lt;&gt;&quot;&#39;&#x1F680;&notin;&NotEqualTilde;'),
    ['&<>"\'🚀∉≂̸', []]
  );
  assert.deepEqual(parsed('&#0; &#xD800; &#x110000; &#128; &missing;'), [
    '� � � € &missing;',
    [],
  ]);
});

for (const source of [
  '<tg-emoji emoji-id="90071992547409930x">x</tg-emoji>',
  '<a href="tg://user?id=9223372036854775808">x</a>',
  '<tg-date timestamp="NaN">x</tg-date>',
]) {
  it(`rejects invalid HTML identifiers before transport ${source}`, async () => {
    const { client, calls } = await ownedMessage('teleproto');
    await assert.rejects(
      client.sendMessage('me', source, { parseMode: 'html' })
    );
    assert.equal(calls.length, 0);
  });
}

it('bounds HTML nesting, entity counts, text and invalid output ranges', () => {
  assert.throws(
    () => Package.HTMLParser.parse(`${'<b>'.repeat(65)}x${'</b>'.repeat(65)}`),
    RangeError
  );
  assert.throws(
    () => Package.HTMLParser.parse('<b>x</b>'.repeat(1001)),
    RangeError
  );
  assert.throws(
    () => Package.HTMLParser.parse('x'.repeat(4 * 1024 * 1024 + 1)),
    RangeError
  );
  assert.throws(
    () =>
      Package.HTMLParser.unparse('x', [
        { _: 'messageEntityBold', offset: 0, length: 2 },
      ]),
    RangeError
  );
  assert.throws(
    () =>
      Package.HTMLParser.unparse('abc', [
        { _: 'messageEntityBold', offset: 0, length: 2 },
        { _: 'messageEntityItalic', offset: 1, length: 2 },
      ]),
    /overlap/
  );
});
