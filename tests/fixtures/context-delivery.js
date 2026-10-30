// Independently supplied arguments exercise actual SDK context methods.
export const deliveryArguments = {
  Message: ['hello'],
  RichMessage: [{ blocks: [{ type: 'text', text: 'hello' }] }],
  Photo: ['photo:file'],
  LivePhoto: ['video:file', 'photo:file'],
  Audio: ['audio:file'],
  Document: ['document:file'],
  Video: ['video:file'],
  Animation: ['animation:file'],
  Voice: ['voice:file'],
  VideoNote: ['video-note:file'],
  PaidMedia: [1, [{ type: 'photo', media: 'photo:file' }]],
  MediaGroup: [[{ type: 'photo', media: 'photo:file' }]],
  Location: [1.5, 2.5],
  Venue: [1.5, 2.5, 'Venue', 'Address'],
  Contact: ['+10000000000', 'Sender'],
  Poll: ['Question?', ['A', 'B']],
  Quiz: ['Question?', ['A', 'B']],
  Checklist: [{ title: 'Tasks', tasks: [{ id: 1, text: 'First' }] }],
  Dice: ['🎯'],
  ChatAction: ['typing'],
  Draft: ['partial'],
  RichMessageDraft: [{ blocks: [] }],
  Sticker: ['sticker:file'],
  Invoice: [
    'Title',
    'Description',
    'order:1',
    'USD',
    [{ label: 'A', amount: 1 }],
  ],
  Game: ['game-name'],
};

const grammyKinds = Object.keys(deliveryArguments).filter(
  (kind) => kind !== 'Quiz'
);
const telegrafKinds = [
  'Message',
  'Photo',
  'MediaGroup',
  'Audio',
  'Dice',
  'Document',
  'Sticker',
  'Video',
  'Animation',
  'VideoNote',
  'Invoice',
  'Game',
  'Voice',
  'Poll',
  'Quiz',
  'ChatAction',
  'Location',
  'Venue',
  'Contact',
];

export const grammyDeliveryCases = grammyKinds.map((kind) => ({
  name: kind === 'Message' ? 'reply' : `replyWith${kind}`,
  args: deliveryArguments[kind],
}));
grammyDeliveryCases.push({
  name: 'sendPaidMedia',
  args: deliveryArguments.PaidMedia,
});

export const telegrafDeliveryCases = telegrafKinds.flatMap((kind) => {
  let args = deliveryArguments[kind];
  if (kind === 'Dice') {
    args = [];
  } else if (kind === 'Invoice') {
    args = [
      {
        title: 'Title',
        description: 'Description',
        payload: 'order:1',
        currency: 'USD',
        prices: [{ label: 'A', amount: 1 }],
      },
    ];
  }
  return [`send${kind}`, kind === 'Message' ? 'reply' : `replyWith${kind}`].map(
    (name) => ({ name, args })
  );
});
for (const mode of ['Markdown', 'MarkdownV2', 'HTML']) {
  telegrafDeliveryCases.push({ name: `replyWith${mode}`, args: ['formatted'] });
}

export const deliveryUpdates = {
  topic: {
    update_id: 17,
    message: {
      message_id: 11,
      date: 1,
      chat: { id: -1007, type: 'supergroup' },
      is_topic_message: true,
      message_thread_id: 19,
      business_connection_id: 'business:1',
      direct_messages_topic: { topic_id: 23 },
    },
  },
  ordinary: {
    update_id: 18,
    message: {
      message_id: 12,
      date: 1,
      chat: { id: -1007, type: 'supergroup' },
      is_topic_message: false,
      message_thread_id: 29,
      business_connection_id: 'business:2',
      direct_messages_topic: { topic_id: 31 },
    },
  },
  inaccessible: {
    update_id: 19,
    callback_query: {
      id: 'callback:1',
      message: {
        message_id: 13,
        date: 0,
        chat: { id: -1007, type: 'supergroup' },
        is_topic_message: true,
        message_thread_id: 37,
        business_connection_id: 'business:3',
        direct_messages_topic: { topic_id: 41 },
      },
    },
  },
  business: {
    update_id: 20,
    business_connection: {
      id: 'business:4',
      user_chat_id: 43,
      user: { id: 43 },
    },
  },
};
