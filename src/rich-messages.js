import { Api } from './api.js';
import { gramRequest, requestOf, schemaDefinition } from './requests.js';
import { prepareRich, checkedRichOutput } from './rich-tree.js';
import { richText } from './rich-text.js';
import { richBlock } from './rich-blocks.js';

function constructor(value) {
  return gramRequest(Api, requestOf(value));
}

function richFiles(files) {
  if (files === undefined) {
    return undefined;
  }
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    throw new TypeError('Rich files require a map of input photos/documents');
  }
  const result = Object.entries(files).map(([id, value]) => {
    const type = schemaDefinition(value?._ ?? value?.className)?.type;
    if (!['InputPhoto', 'InputDocument'].includes(type)) {
      throw new TypeError('Rich files require input photos/documents');
    }
    const field = type === 'InputPhoto' ? 'photo' : 'document';
    return {
      _: `inputRichFile${field === 'photo' ? 'Photo' : 'Document'}`,
      id,
      [field]: value,
    };
  });
  return result.length ? result : undefined;
}

function markupInput(kind, content, options) {
  if (typeof content !== 'string') {
    throw new TypeError('Rich message content must be text');
  }
  const input = prepareRich({
    _: `inputRichMessage${kind === 'html' ? 'HTML' : 'Markdown'}`,
    [kind]: content,
    rtl: options.rtl,
    noautolink: options.noAutolink,
    files: richFiles(options.files),
  });
  return constructor(input);
}

export const html = (content, options = {}) =>
  markupInput('html', content, options);
export const markdown = (content, options = {}) =>
  markupInput('markdown', content, options);

export function blocks(pageBlocks, options = {}) {
  if (!Array.isArray(pageBlocks)) {
    throw new TypeError('Rich message blocks must be an array');
  }
  return constructor(
    prepareRich({
      _: 'inputRichMessage',
      blocks: pageBlocks,
      rtl: options.rtl,
      noautolink: options.noAutolink,
      photos: options.photos,
      documents: options.documents,
      users: options.users,
    })
  );
}

function renderer(mode) {
  if (!['text', 'md', 'html'].includes(mode)) {
    throw new RangeError('Rich rendering mode must be text, md or html');
  }
  const context = { mode };
  context.text = (node) => checkedRichOutput(richText(node, context));
  context.block = (node) => checkedRichOutput(richBlock(node, context));
  context.blocks = (nodes) => {
    if (!Array.isArray(nodes)) {
      throw new TypeError('Rich message blocks must be an array');
    }
    return checkedRichOutput(
      nodes
        .map(context.block)
        .filter(Boolean)
        .join(mode === 'html' ? '' : '\n\n')
    );
  };
  context.plain = mode === 'text' ? context.text : renderer('text').text;
  return context;
}

export const renderRichText = (text, mode = 'text') =>
  renderer(mode).text(prepareRich(text));
export const renderBlocks = (pageBlocks, mode = 'text') =>
  renderer(mode).blocks(prepareRich(pageBlocks));
const renderSource = (source, mode) => {
  const value = prepareRich(source);
  return renderer(mode).blocks(Array.isArray(value) ? value : value?.blocks);
};
export const toPlainText = (source) => renderSource(source, 'text');
export const toMarkdown = (source) => renderSource(source, 'md');
export const toHtml = (source) => renderSource(source, 'html');
