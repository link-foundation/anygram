import { mkdir, writeFile } from 'node:fs/promises';
import { MarkdownParser as GramMarkdown } from 'telegram/extensions/markdown.js';
import { MarkdownParser as TeleMarkdown } from 'teleproto/extensions/markdown.js';
import { HTMLParser as GramHtml } from 'telegram/extensions/html.js';
import { HTMLParser as TeleHtml } from 'teleproto/extensions/html.js';
import { MarkdownV2Parser as GramV2 } from 'telegram/extensions/markdownv2.js';
import { MarkdownV2Parser as TeleV2 } from 'teleproto/extensions/markdownv2.js';
import { canonicalValue } from '../src/requests.js';

const inputs = {
  markdown: [
    '🚀 **Ada** __Lovelace__ ~~old~~ `code`',
    '**outer __inner__ end**',
    '```print(1)```',
    '```js\n**literal**\n```',
    '`**literal**`',
    '**unclosed',
    '**',
    '****',
    '**one __two** three__',
    '**a** **b**',
    '\\**escaped**',
    '[Ada](https://example.com)',
  ],
  html: [
    '🚀 <b>Ada</b>',
    '  <strong> a <em>b</em> </strong>  ',
    '<b><i>nested</i></b>',
    '<b>a</b><i>b</i>',
    '<b>unclosed',
    '<b>a<i>b</b>c</i>',
    'a<br>b<br/>c',
    '<pre><code class="language-js">**literal**</code></pre>',
    '<a href="mailto:a@example.com">Different</a>',
    '<a href="tg://user?id=9007199254740993">Ada</a>',
    '<tg-emoji emoji-id="9007199254740993">🚀</tg-emoji>',
    '<blockquote expandable>quote</blockquote>',
    '<span class="other tg-spoiler">secret</span>',
    '&amp;&lt;&gt;&quot;&#39;&#x1F680;&notin;&NotEqualTilde;',
    '&#0; &#xD800; &#x110000; &missing;',
    '<tg-date timestamp="1700000000" relative short-time>Ada</tg-date>',
    '<unknown x="a>b">body</unknown>',
    '<b></b>',
  ],
  markdownv2: [
    '🚀 *Ada* _italic_ __under__ ~old~ ||secret||',
    '*outer _inner_ end*',
    '\\*literal\\* \\! \\.',
    '```js\n**literal**\n```',
    '`a\\`b\\\\c`',
    '[*Ada*](https://example.com/a\\))',
    '![🚀](tg://emoji?id=9007199254740993)',
    '[Ada](tg://user?id=9007199254740993)',
    '>one\n>two\nplain',
    '**>one\n>two||',
    '___nested_**___',
    '*unclosed',
    '*a* *b*',
    '  *a*  ',
    'a-b',
  ],
};
const output = [];
for (const [mode, parsers] of [
  ['markdown', [GramMarkdown, TeleMarkdown]],
  ['html', [GramHtml, TeleHtml]],
  ['markdownv2', [GramV2, TeleV2]],
]) {
  for (const source of inputs[mode]) {
    const results = parsers.map((parser) => {
      try {
        const [text, entities] = parser.parse(source);
        return {
          text,
          entities: canonicalValue(entities),
          rendered: parser.unparse(text, entities),
        };
      } catch (error) {
        return { error: error.message };
      }
    });
    output.push({ mode, source, gramjs: results[0], teleproto: results[1] });
  }
}
await mkdir('ci-logs', { recursive: true });
await writeFile(
  'ci-logs/account-markup-sdk-probe.json',
  `${JSON.stringify(
    output,
    (_, value) => (typeof value === 'bigint' ? `${value}n` : value),
    2
  )}\n`
);
console.log(`Recorded ${output.length} finite parser comparisons`);
