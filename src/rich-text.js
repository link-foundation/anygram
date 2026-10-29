import { escapeRich } from './rich-tree.js';

const marks = new Map([
  ['textBold', ['b', '**']],
  ['textItalic', ['i', '_']],
  ['textUnderline', ['u', '']],
  ['textStrike', ['s', '~~']],
  ['textFixed', ['code', '`']],
  ['textMarked', ['mark', '']],
  ['textSpoiler', ['span class="spoiler"', '||', 'span']],
  ['textSubscript', ['sub', '']],
  ['textSuperscript', ['sup', '']],
]);
const urlButtons = new Set([
  'inlineButtonTypeUrl',
  'inlineButtonTypeUrlAuth',
  'inputInlineButtonTypeUrlAuth',
  'inlineButtonTypeWebView',
]);

export function renderRichButton(node, context) {
  const inner = context.text(node.text);
  const url = urlButtons.has(node.type?._) && node.type.url;
  if (context.mode === 'html') {
    return url
      ? `<a class="button" href="${escapeRich(url, 'html')}">${inner}</a>`
      : `<button>${inner}</button>`;
  }
  return context.mode === 'md' && url ? `[${inner}](${url})` : inner;
}

function link(inner, url, mode, markdown = true) {
  if (mode === 'html') {
    return `<a href="${escapeRich(url, 'html')}">${inner}</a>`;
  }
  return mode === 'md' && markdown ? `[${inner}](${url})` : inner;
}

const special = {
  textPlain: (node, context) => escapeRich(node.text, context.mode),
  textConcat: (node, context) => node.texts.map(context.text).join(''),
  textCustomEmoji: (node, context) => escapeRich(node.alt, context.mode),
  textMath: (node, context) => {
    const inner = escapeRich(node.source, context.mode);
    return context.mode === 'html'
      ? `<code>${inner}</code>`
      : context.mode === 'md'
        ? `\`${inner}\``
        : inner;
  },
  textImage: (node, context) =>
    context.mode === 'html'
      ? `<img data-document-id="${escapeRich(node.document_id, 'html')}">`
      : '',
  textUrl: (node, context) =>
    link(context.text(node.text), node.url, context.mode),
  textEmail: (node, context) =>
    link(context.text(node.text), `mailto:${node.email}`, context.mode, false),
  textMentionName: (node, context) =>
    link(
      context.text(node.text),
      `tg://user?id=${node.user_id}`,
      context.mode,
      false
    ),
  textAnchor: (node, context) => {
    const inner = context.text(node.text);
    return context.mode === 'html'
      ? `<a id="${escapeRich(node.name, 'html')}">${inner}</a>`
      : inner;
  },
  textButton: renderRichButton,
};

/** Rendering is independent of the installed SDK and accepts canonical trees. */
export function richText(node, context) {
  if (!node || node._ === 'textEmpty') {
    return '';
  }
  const mark = marks.get(node._);
  if (mark) {
    const inner = context.text(node.text);
    return context.mode === 'html'
      ? `<${mark[0]}>${inner}</${mark[2] ?? mark[0]}>`
      : context.mode === 'md'
        ? `${mark[1]}${inner}${mark[1]}`
        : inner;
  }
  if (Object.hasOwn(special, node._)) {
    return special[node._](node, context);
  }
  return node.text && typeof node.text === 'object'
    ? context.text(node.text)
    : '';
}
