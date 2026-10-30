const updateFields = [
  'message',
  'edited_message',
  'channel_post',
  'edited_channel_post',
  'business_connection',
  'business_message',
  'edited_business_message',
  'deleted_business_messages',
  'guest_message',
  'stopped_message_generation',
  'message_reaction',
  'message_reaction_count',
  'inline_query',
  'chosen_inline_result',
  'callback_query',
  'shipping_query',
  'pre_checkout_query',
  'poll',
  'poll_answer',
  'my_chat_member',
  'chat_member',
  'managed_bot',
  'chat_join_request',
  'chat_boost',
  'removed_chat_boost',
  'purchased_paid_media',
  'subscription',
];

const messages = {
  grammy: [
    'message',
    'editedMessage',
    'channelPost',
    'editedChannelPost',
    'businessMessage',
    'editedBusinessMessage',
    'guestMessage',
    'callbackQuery.message',
  ],
  telegraf: [
    'message',
    'editedMessage',
    'callbackQuery.message',
    'channelPost',
    'editedChannelPost',
  ],
};
const chats = {
  grammy: [
    'msg',
    'deletedBusinessMessages',
    'stoppedMessageGeneration',
    'messageReaction',
    'messageReactionCount',
    'myChatMember',
    'chatMember',
    'chatJoinRequest',
    'chatBoost',
    'removedChatBoost',
  ],
  telegraf: [
    'msg',
    'messageReaction',
    'messageReactionCount',
    'chatJoinRequest',
    'chatMember',
    'myChatMember',
    'removedChatBoost',
  ],
};

const present = (value) => value !== undefined && value !== null;
function select(ctx, paths) {
  for (const path of paths) {
    const value = path.split('.').reduce((source, key) => source?.[key], ctx);
    if (present(value)) {
      return value;
    }
  }
}

const messageView = {
  has(...keys) {
    return keys.some((key) => present(this[key]));
  },
  isAccessible() {
    return 'date' in this ? this.date !== 0 : false;
  },
};

function message(ctx, style) {
  const value = select(ctx, messages[style]);
  return style === 'telegraf' && value
    ? Object.assign(Object.create(messageView), value)
    : value;
}

function telegramUser(ctx) {
  if (ctx.callbackQuery) {
    return ctx.callbackQuery.from;
  }
  if (ctx.msg?.has('from')) {
    return ctx.msg.from;
  }
  return (
    select(ctx, [
      'inlineQuery',
      'shippingQuery',
      'preCheckoutQuery',
      'chosenInlineResult',
      'chatMember',
      'myChatMember',
      'chatJoinRequest',
    ])?.from ??
    select(ctx, ['messageReaction', 'pollAnswer', 'chatBoost.boost.source'])
      ?.user
  );
}

function user(ctx, style) {
  if (style === 'telegraf') {
    return telegramUser(ctx);
  }
  const source = ctx.chatBoost?.boost ?? ctx.removedChatBoost;
  const actor =
    select(ctx, ['businessConnection', 'messageReaction', 'managedBot']) ??
    source?.source ??
    ctx.subscription;
  return (
    actor?.user ??
    select(ctx, [
      'callbackQuery',
      'msg',
      'inlineQuery',
      'chosenInlineResult',
      'shippingQuery',
      'preCheckoutQuery',
      'myChatMember',
      'chatMember',
      'chatJoinRequest',
      'purchasedPaidMedia',
    ])?.from
  );
}

const aggregates = {
  msg: message,
  chat: (ctx, style) => select(ctx, chats[style])?.chat,
  from: user,
  senderChat: (ctx, style) =>
    style === 'telegraf'
      ? ctx.msg?.has('sender_chat') && ctx.msg.sender_chat
      : ctx.msg?.sender_chat,
  msgId: (ctx, style) =>
    style === 'telegraf'
      ? select(ctx, ['msg', 'messageReaction', 'messageReactionCount'])
          ?.message_id
      : select(ctx, [
          'msg.message_id',
          'messageReaction.message_id',
          'messageReactionCount.message_id',
        ]),
  chatId: (ctx) => ctx.chat?.id ?? ctx.businessConnection?.user_chat_id,
  inlineMessageId: (ctx, style) =>
    style === 'telegraf'
      ? select(ctx, ['callbackQuery', 'chosenInlineResult'])?.inline_message_id
      : select(ctx, [
          'callbackQuery.inline_message_id',
          'chosenInlineResult.inline_message_id',
        ]),
  businessConnectionId: (ctx) =>
    select(ctx, [
      'msg.business_connection_id',
      'businessConnection.id',
      'deletedBusinessMessages.business_connection_id',
    ]),
};

/** Public update facts share one resolver; source order remains SDK-specific. */
export function installContextData(Type, style = 'grammy') {
  const descriptors = updateFields.map((field) => [
    field.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    {
      configurable: true,
      get() {
        return this.update[field];
      },
    },
  ]);
  for (const [name, resolve] of Object.entries(aggregates)) {
    descriptors.push([
      name,
      {
        configurable: true,
        get() {
          return resolve(this, style);
        },
      },
    ]);
  }
  Object.defineProperties(Type.prototype, Object.fromEntries(descriptors));
}
