import { messagePage } from './account-message-models.js';

export function buttonPage(
  style = 'teleproto',
  kinds = ['callback', 'url', 'game', 'switchInline']
) {
  const source = messagePage();
  const types = {
    callback: { data: Buffer.from([1, 2]) },
    url: { url: 'https://example.com/button' },
    game: {},
    switchInline: { query: 'lookup', same_peer: true },
    text: {},
    phone: {},
    geo: {},
  };
  const names = {
    text: 'Default',
    phone: 'RequestPhone',
    geo: 'RequestGeoLocation',
  };
  const legacy = {
    callback: 'Callback',
    url: 'Url',
    game: 'Game',
    switchInline: 'SwitchInline',
    text: '',
    phone: 'RequestPhone',
    geo: 'RequestGeoLocation',
  };
  const buttons = kinds.map((kind) => {
    const fields = types[kind];
    if (style === 'gramjs') {
      return { _: `keyboardButton${legacy[kind]}`, text: kind, ...fields };
    }
    const keyboard = kind in names;
    return {
      _: keyboard ? 'keyboardButton' : 'keyboardInlineButton',
      text: kind,
      type: {
        _: keyboard
          ? `buttonType${names[kind]}`
          : `inlineButtonType${legacy[kind]}`,
        ...fields,
      },
    };
  });
  const keyboard = kinds.every((kind) => kind in names);
  const row =
    !keyboard && style === 'teleproto'
      ? 'keyboardInlineButtonRow'
      : 'keyboardButtonRow';
  source.messages[0].reply_markup = {
    _: keyboard ? 'replyKeyboardMarkup' : 'replyInlineMarkup',
    rows: [
      { _: row, buttons: buttons.slice(0, 2) },
      { _: row, buttons: buttons.slice(2) },
    ],
  };
  return source;
}

export function pollPage() {
  const source = messagePage();
  source.messages[0].media = {
    _: 'messageMediaPoll',
    poll: {
      _: 'poll',
      id: 19n,
      hash: 23n,
      multiple_choice: true,
      question: { _: 'textWithEntities', text: 'Which?', entities: [] },
      answers: ['Zero', 'One', 'Two'].map((text, index) => ({
        _: 'pollAnswer',
        text: { _: 'textWithEntities', text, entities: [] },
        option: Buffer.from([index + 10]),
      })),
    },
    results: { _: 'pollResults', total_voters: 0, results: [] },
  };
  return source;
}
