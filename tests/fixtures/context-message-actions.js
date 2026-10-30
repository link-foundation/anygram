// Independent inputs are compared against the actual pinned SDK contexts.
const checklist = { title: 'Tasks', tasks: [{ id: 1, text: 'First' }] };
const media = { type: 'photo', media: 'photo:file', caption: 'Photo' };
export const grammyActionCases = [
  ['forwardMessage', [-1002, { disable_notification: true }]],
  ['forwardMessages', [-1002, [11, 12], { disable_notification: true }]],
  ['copyMessage', [-1002, { caption: 'Copy' }]],
  ['copyMessages', [-1002, [11, 12], { remove_caption: true }]],
  ['editMessageLiveLocation', [1.5, 2.5, { heading: 0 }]],
  ['stopMessageLiveLocation', [{ reply_markup: { inline_keyboard: [] } }]],
  ['editMessageChecklist', [checklist, {}]],
  ['react', [['12345', '😀', { type: 'paid' }], { is_big: true }]],
  ['approveSuggestedPost', [{ send_date: 0 }]],
  ['declineSuggestedPost', [{ comment: 'Declined' }]],
  ['editMessageText', ['Edited', { parse_mode: 'HTML' }]],
  ['editMessageCaption', [{ caption: 'Caption', parse_mode: 'HTML' }]],
  ['editMessageMedia', [media, {}]],
  ['editMessageReplyMarkup', [{ reply_markup: { inline_keyboard: [] } }]],
  ['stopPoll', [{ reply_markup: { inline_keyboard: [] } }]],
  ['editEphemeralMessageText', ['Ephemeral', {}]],
  ['editEphemeralMessageMedia', [media, {}]],
  ['editEphemeralMessageCaption', ['Caption', {}]],
  [
    'editEphemeralMessageReplyMarkup',
    [{ reply_markup: { inline_keyboard: [] } }],
  ],
  ['deleteMessage', []],
  ['deleteMessages', [[11, 12]]],
  ['deleteEphemeralMessage', []],
  ['deleteMessageReaction', [{}]],
  ['deleteMessageReactionUser', [8, {}]],
  ['deleteMessageReactionChat', [-1002, {}]],
  ['deleteAllMessageReactions', [{}]],
  ['deleteAllMessageReactionsUser', [8, {}]],
  ['deleteAllMessageReactionsChat', [-1002, {}]],
  ['deleteBusinessMessages', [[11, 12]]],
];
export const telegrafActionCases = [
  ['editMessageText', ['Edited', { parse_mode: 'HTML' }]],
  ['editMessageCaption', ['Caption', { parse_mode: 'HTML' }]],
  ['editMessageMedia', [media, {}]],
  ['editMessageReplyMarkup', [{ inline_keyboard: [] }]],
  ['editMessageLiveLocation', [1.5, 2.5, { heading: 0 }]],
  ['stopMessageLiveLocation', [{ inline_keyboard: [] }]],
  ['stopPoll', [99, { explanation: 'End' }]],
  [
    'react',
    [['12345', '😀', { type: 'custom_emoji', custom_emoji_id: '9' }], true],
  ],
  ['deleteMessage', []],
  ['deleteMessages', [[11, 12]]],
  ['forwardMessage', [-1002, { disable_notification: true }]],
  ['forwardMessages', [-1002, [11, 12], { disable_notification: true }]],
  ['copyMessage', [-1002, { caption: 'Copy' }]],
  ['copyMessages', [-1002, [11, 12], { remove_caption: true }]],
];
const message = {
  message_id: 11,
  date: 1,
  chat: { id: -1001 },
  from: { id: 8 },
  business_connection_id: 'business:1',
  direct_messages_topic: { topic_id: 17 },
};
const reaction = { chat: { id: -1001 }, message_id: 13 };
export const actionUpdates = {
  message: { update_id: 1, message },
  edited: { update_id: 2, edited_message: message },
  business: { update_id: 3, business_message: message },
  callback: {
    update_id: 4,
    callback_query: { id: 'callback:1', from: { id: 8 }, message },
  },
  inline: {
    update_id: 5,
    callback_query: { id: 'callback:2', inline_message_id: 'inline:1' },
  },
  chosen: {
    update_id: 6,
    chosen_inline_result: { result_id: '1', inline_message_id: 'inline:2' },
  },
  reaction: {
    update_id: 7,
    message_reaction: { ...reaction, user: { id: 8 } },
  },
  actor: {
    update_id: 8,
    message_reaction: { ...reaction, actor_chat: { id: -1002 } },
  },
  count: { update_id: 9, message_reaction_count: reaction },
  deleted: {
    update_id: 10,
    deleted_business_messages: {
      business_connection_id: 'business:2',
      chat: { id: -1001 },
    },
  },
  done: {
    update_id: 11,
    message: {
      ...message,
      checklist_tasks_done: {
        checklist_message: { message_id: 21, chat: { id: -1003 } },
      },
      checklist_tasks_added: {
        checklist_message: { message_id: 22, chat: { id: -1004 } },
      },
    },
  },
  added: {
    update_id: 12,
    message: {
      ...message,
      checklist_tasks_added: {
        checklist_message: { message_id: 22, chat: { id: -1004 } },
      },
    },
  },
  ephemeral: {
    update_id: 13,
    message: {
      ...message,
      receiver_user: { id: 9 },
      ephemeral_message_id: 'ephemeral:1',
    },
  },
  sender: {
    update_id: 14,
    message: { ...message, sender_chat: { id: -1005 } },
  },
  poll: {
    update_id: 15,
    poll_answer: { poll_id: 'poll:1', voter_chat: { id: -1006 } },
  },
  malformedReaction: { update_id: 16, message_reaction: reaction },
  empty: { update_id: 17, poll: {} },
};
export const completeActionUpdate = {
  ...actionUpdates.ephemeral,
  ...actionUpdates.reaction,
};
