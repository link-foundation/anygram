import schema from '../../src/schema/telegram.json' with { type: 'json' };
import { gramRequest, requestOf } from '../../src/requests.js';
import { messagePage } from './account-message-models.js';

export const plain = (text = 'A<&"_[*|~') => ({ _: 'textPlain', text });
export const paragraph = (text = plain()) => ({
  _: 'pageBlockParagraph',
  text,
});
export const caption = () => ({
  _: 'pageCaption',
  text: plain('Caption'),
  credit: plain('Credit'),
});
const defaults = {
  RichText: () => plain(),
  PageBlock: () => paragraph(),
  PageCaption: caption,
  InlineButtonType: () => ({
    _: 'inlineButtonTypeUrl',
    url: 'https://example.com/?x="&y=<',
  }),
  PageListItem: () => ({
    _: 'pageListItemText',
    text: plain(),
    checkbox: true,
    checked: true,
  }),
  PageListOrderedItem: () => ({
    _: 'pageListOrderedItemText',
    num: '7',
    text: plain(),
    checkbox: true,
  }),
  PageTableRow: () => ({
    _: 'pageTableRow',
    cells: [
      { _: 'pageTableCell', text: plain(), header: true, colspan: 2 },
      { _: 'pageTableCell', text: plain('Next'), rowspan: 2 },
    ],
  }),
  PageButton: () => ({
    _: 'pageButton',
    text: plain(),
    type: { _: 'inlineButtonTypeUrl', url: 'https://example.com/' },
  }),
  Chat: () => ({ _: 'chatEmpty', id: 9n }),
  GeoPoint: () => ({ _: 'geoPointEmpty' }),
  InputGeoPoint: () => ({ _: 'inputGeoPointEmpty' }),
  PageRelatedArticle: () => ({
    _: 'pageRelatedArticle',
    url: 'https://example.com/',
    webpage_id: 1n,
  }),
  RichButtonStyle: () => ({ _: 'richButtonStyle', bg_color: 1 }),
};

function fieldValue(type) {
  type = type.replace(/^\w+\.\d+\?/, '');
  const vector = /^Vector<(.+)>$/.exec(type);
  if (vector) {
    return [fieldValue(vector[1])];
  }
  if (defaults[type]) {
    return defaults[type]();
  }
  return { string: 'source<&"', int: 2, long: 9007199254740993n, true: true }[
    type
  ];
}

const cases = (type) =>
  schema.constructors
    .filter((definition) => definition.type === type)
    .map((definition) => ({
      _: definition.predicate,
      ...Object.fromEntries(
        definition.params
          .filter((field) => field.type !== '#')
          .map((field) => [field.name, fieldValue(field.type)])
      ),
    }));

export const richTextCases = cases('RichText');
export const pageBlockCases = cases('PageBlock');
export const inlineButtonCases = cases('InlineButtonType');
export const asClass = (Api, value) => gramRequest(Api, requestOf(value));

export function richMessage(part = false, text = 'Full content') {
  return {
    _: 'richMessage',
    part,
    blocks: [paragraph(plain(text))],
    photos: [],
    documents: [],
  };
}

export function richPage(part = false, text) {
  const page = messagePage();
  page.messages[0].rich_message = richMessage(part, text);
  return page;
}
