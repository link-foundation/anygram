import { escapeRich } from './rich-tree.js';
import { renderRichButton } from './rich-text.js';

const headingLevels = new Map([
  ['pageBlockTitle', 1],
  ['pageBlockSubtitle', 2],
  ['pageBlockHeader', 3],
  ['pageBlockSubheader', 4],
  ...Array.from({ length: 6 }, (_, i) => [`pageBlockHeading${i + 1}`, i + 1]),
]);
const textTags = new Map([
  ['pageBlockParagraph', 'p'],
  ['pageBlockKicker', 'p'],
  ['pageBlockFooter', 'footer'],
]);

function captionOf(value, context) {
  return value?._ === 'pageCaption'
    ? [context.text(value.text), context.text(value.credit)]
        .filter(Boolean)
        .join(' — ')
    : '';
}

function quote(node, context) {
  const inner = node.blocks
    ? context.blocks(node.blocks)
    : context.text(node.text);
  const caption = context.text(node.caption);
  if (context.mode === 'html') {
    return `<blockquote>${inner}${caption ? `<footer>${caption}</footer>` : ''}</blockquote>`;
  }
  if (context.mode === 'md') {
    const lines = inner.split('\n').map((line) => `> ${line}`);
    if (caption) {
      lines.push(`> — ${caption}`);
    }
    return lines.join('\n');
  }
  return caption ? `${inner} — ${caption}` : inner;
}

function list(node, context) {
  const ordered = node._ === 'pageBlockOrderedList';
  const items = node.items.map((item, index) => {
    const inner = item.blocks
      ? context.blocks(item.blocks)
      : context.text(item.text);
    const check = item.checkbox ? (item.checked ? '[x] ' : '[ ] ') : '';
    if (context.mode === 'html') {
      return `<li>${check}${inner}</li>`;
    }
    const marker = ordered ? `${item.num ?? index + 1}.` : '-';
    return `${marker} ${check}${inner}`;
  });
  if (context.mode !== 'html') {
    return items.join('\n');
  }
  const tag = ordered ? 'ol' : 'ul';
  const start =
    ordered && node.start !== undefined && node.start !== null
      ? ` start="${escapeRich(node.start, 'html')}"`
      : '';
  return `<${tag}${start}>${items.join('')}</${tag}>`;
}

function table(node, context) {
  const title = context.text(node.title);
  const rows = node.rows.map((row) =>
    row.cells.map((cell) => context.text(cell.text))
  );
  if (context.mode === 'html') {
    const body = node.rows.map((row, i) => {
      const cells = row.cells.map((cell, j) => {
        const tag = cell.header ? 'th' : 'td';
        const attrs = ['colspan', 'rowspan']
          .filter((name) => cell[name])
          .map((name) => ` ${name}="${escapeRich(cell[name], 'html')}"`)
          .join('');
        return `<${tag}${attrs}>${rows[i][j]}</${tag}>`;
      });
      return `<tr>${cells.join('')}</tr>`;
    });
    return `${title ? `<p>${title}</p>` : ''}<table>${body.join('')}</table>`;
  }
  if (context.mode === 'md' && rows.length) {
    const lines = rows.map((cells) => `| ${cells.join(' | ')} |`);
    lines.splice(1, 0, `| ${rows[0].map(() => '---').join(' | ')} |`);
    return `${title ? `${title}\n` : ''}${lines.join('\n')}`;
  }
  return [title, ...rows.map((cells) => cells.join(' | '))]
    .filter(Boolean)
    .join('\n');
}

const mediaFields = new Map([
  ['pageBlockPhoto', ['photo', 'photo_id']],
  ['pageBlockVideo', ['video', 'video_id']],
  ['pageBlockAudio', ['audio', 'audio_id']],
  ['pageBlockDocument', ['document', 'document_id']],
]);
function media(node, context) {
  const [kind, field] = mediaFields.get(node._);
  const caption = captionOf(node.caption, context);
  if (context.mode !== 'html') {
    return caption ? `[${kind}: ${caption}]` : `[${kind}]`;
  }
  const id = escapeRich(node[field], 'html');
  const body =
    kind === 'photo'
      ? `<img data-photo-id="${id}">`
      : kind === 'document'
        ? `<a data-document-id="${id}"></a>`
        : `<${kind} data-document-id="${id}"></${kind}>`;
  if (kind === 'audio') {
    return body;
  }
  return `<figure>${body}${caption ? `<figcaption>${caption}</figcaption>` : ''}</figure>`;
}

function group(node, context) {
  const inner = context.blocks(node.items);
  const caption = captionOf(node.caption, context);
  return context.mode === 'html'
    ? `<div>${inner}${caption ? `<figcaption>${caption}</figcaption>` : ''}</div>`
    : [inner, caption].filter(Boolean).join('\n');
}

function preformatted(node, context) {
  if (context.mode === 'html') {
    return `<pre>${context.text(node.text)}</pre>`;
  }
  const raw = context.plain(node.text);
  return context.mode === 'md'
    ? `\`\`\`${node.language || ''}\n${raw}\n\`\`\``
    : raw;
}

const handlers = {
  pageBlockPreformatted: preformatted,
  pageBlockBlockquote: quote,
  pageBlockPullquote: quote,
  pageBlockBlockquoteBlocks: quote,
  pageBlockList: list,
  pageBlockOrderedList: list,
  pageBlockTable: table,
  pageBlockCollage: group,
  pageBlockSlideshow: group,
  pageBlockCover: (node, context) => context.block(node.cover),
  pageBlockDivider: (_, context) =>
    ({ html: '<hr>', md: '---', text: '———' })[context.mode],
  pageBlockAnchor: (node, context) =>
    context.mode === 'html'
      ? `<a id="${escapeRich(node.name, 'html')}"></a>`
      : '',
  pageBlockDetails: (node, context) => {
    const title = context.text(node.title);
    const inner = context.blocks(node.blocks);
    return context.mode === 'html'
      ? `<details${node.open ? ' open' : ''}><summary>${title}</summary>${inner}</details>`
      : [title, inner].filter(Boolean).join('\n');
  },
  pageBlockMath: (node, context) =>
    context.mode === 'html'
      ? `<code>${escapeRich(node.source, 'html')}</code>`
      : context.mode === 'md'
        ? `\`\`\`\n${node.source}\n\`\`\``
        : node.source,
  pageBlockAuthorDate: (node, context) => context.text(node.author),
  pageBlockButtonRow: (node, context) => {
    const buttons = node.buttons
      .filter((button) => button._ === 'pageButton')
      .map((button) => renderRichButton(button, context));
    return context.mode === 'html'
      ? `<div class="buttons">${buttons.join('')}</div>`
      : buttons.filter(Boolean).join(' ');
  },
};

export function richBlock(node, context) {
  if (!node || node._ === 'pageBlockUnsupported') {
    return '';
  }
  const level = headingLevels.get(node._);
  if (level) {
    const inner = context.text(node.text);
    return context.mode === 'html'
      ? `<h${level}>${inner}</h${level}>`
      : context.mode === 'md'
        ? `${'#'.repeat(level)} ${inner}`
        : inner;
  }
  const tag = textTags.get(node._);
  if (tag) {
    const inner = context.text(node.text);
    return context.mode === 'html' ? `<${tag}>${inner}</${tag}>` : inner;
  }
  if (mediaFields.has(node._)) {
    return media(node, context);
  }
  if (Object.hasOwn(handlers, node._)) {
    return handlers[node._](node, context);
  }
  if (node.text && typeof node.text === 'object') {
    return context.text(node.text);
  }
  const children = node.blocks ?? node.items;
  return Array.isArray(children) ? context.blocks(children) : '';
}
