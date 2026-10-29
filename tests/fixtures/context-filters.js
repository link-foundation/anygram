import { readFileSync } from 'node:fs';

export const filterFacts = JSON.parse(
  readFileSync(
    new globalThis.URL(
      '../../docs/case-studies/issue-1/data/grammy-filter-facts.json',
      import.meta.url
    )
  )
);
export function filterNode(index) {
  return Object.fromEntries(
    filterFacts.nodes[index]
      .split(' ')
      .filter(Boolean)
      .map((entry) => {
        const [key, child] = entry.split('@');
        return [key, Number(child)];
      })
  );
}
export const checkerNames = [
  'filterQuery',
  'text',
  'command',
  'reaction',
  'chatType',
  'callbackQuery',
  'gameQuery',
  'inlineQuery',
  'chosenInlineResult',
  'preCheckoutQuery',
  'shippingQuery',
];
export const checkerMethod = (name) =>
  name === 'filterQuery'
    ? 'has'
    : `has${name[0].toUpperCase()}${name.substring(1)}`;
export const me = { id: 9, username: 'TestBot', is_bot: true };
export const chat = { id: -7, type: 'supergroup' };
export const message = { message_id: 1, date: 1, chat };
export function outcome(fn) {
  try {
    return { value: fn() };
  } catch (error) {
    return { error: error.name, message: error.message };
  }
}
export function checkerOutcome(
  Type,
  name,
  argument,
  update,
  staticCheck = false
) {
  const ctx = new Type(update, {}, me);
  ctx.match = 'unchanged';
  return {
    ...outcome(() =>
      staticCheck
        ? Type.has[name](argument)(ctx)
        : ctx[checkerMethod(name)](argument)
    ),
    match: ctx.match,
  };
}
export const textEntity = { type: 'bold', offset: 2, length: 3 };
export const captionEntity = { type: 'italic', offset: 1, length: 4 };
export const entitySources = {
  text: { text: '😀hello', entities: [textEntity] },
  caption: { caption: 'caption', caption_entities: [captionEntity] },
  both: {
    text: '😀hello',
    entities: [textEntity],
    caption: 'caption',
    caption_entities: [captionEntity],
  },
  nullishText: {
    text: null,
    entities: undefined,
    caption: 'caption',
    caption_entities: [captionEntity],
  },
  absentTextEntities: {
    text: 'abcdef',
    caption: 'caption',
    caption_entities: [captionEntity],
  },
  emptyTextEntities: {
    text: 'abcdef',
    entities: [],
    caption: 'caption',
    caption_entities: [captionEntity],
  },
  game: { game: { text: 'game text', text_entities: [textEntity] } },
  missing: {},
  slicing: {
    text: '😀hello',
    entities: [
      textEntity,
      { type: 'code', offset: 0, length: 2 },
      { type: 'bold', offset: -2, length: 4 },
      { type: 'italic', offset: 100, length: 4 },
    ],
  },
};
