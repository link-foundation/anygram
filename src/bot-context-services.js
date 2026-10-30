import {
  contextMethod,
  contextRequired as required,
  contextApiCall,
} from './bot-context-scope.js';

const grammyScopes = {
  from: [
    'getUserProfilePhotos',
    'getUserProfileAudios',
    'setUserEmojiStatus',
    'getUserGifts',
    'getUserPersonalChatMessages',
    'giftPremiumSubscription',
    'savePreparedInlineMessage',
    'savePreparedKeyboardButton',
    'editUserStarSubscription',
    'verifyUser',
    'removeUserVerification',
    'setPassportDataErrors',
  ],
  business: [
    'getBusinessConnection',
    'setBusinessAccountName',
    'setBusinessAccountUsername',
    'setBusinessAccountBio',
    'setBusinessAccountProfilePhoto',
    'removeBusinessAccountProfilePhoto',
    'setBusinessAccountGiftSettings',
    'getBusinessAccountStarBalance',
    'transferBusinessAccountStars',
    'getBusinessAccountGifts',
    'convertGiftToStars',
    'upgradeGift',
    'transferGift',
    'postStory',
    'editStory',
    'deleteStory',
  ],
  managed: [
    'getManagedBotToken',
    'replaceManagedBotToken',
    'getManagedBotAccessSettings',
    'setManagedBotAccessSettings',
  ],
  inlineQuery: ['answerInlineQuery'],
  shippingQuery: ['answerShippingQuery'],
  none: [
    'setChatMenuButton',
    'getChatMenuButton',
    'setMyDefaultAdministratorRights',
    'getMyDefaultAdministratorRights',
  ],
};
const telegrafScopes = {
  from: [
    'setPassportDataErrors',
    'uploadStickerFile',
    'createNewStickerSet',
    'addStickerToSet',
  ],
  inlineQuery: ['answerInlineQuery'],
  callbackQuery: ['answerCbQuery', 'answerGameQuery'],
  shippingQuery: ['answerShippingQuery'],
  preCheckoutQuery: ['answerPreCheckoutQuery'],
  none: [
    'getStickerSet',
    'setStickerPositionInSet',
    'setStickerSetThumbnail',
    'setStickerMaskPosition',
    'setStickerKeywords',
    'setStickerEmojiList',
    'deleteStickerSet',
    'setStickerSetTitle',
    'setCustomEmojiStickerSetThumbnail',
    'deleteStickerFromSet',
    'getMyCommands',
    'setMyCommands',
    'setMyDefaultAdministratorRights',
    'getMyDefaultAdministratorRights',
  ],
};

function grammyPrefix(ctx, scope, name) {
  if (scope === 'none') {
    return [];
  }
  if (scope === 'business') {
    return [required(ctx.businessConnectionId, name)];
  }
  if (scope === 'managed') {
    const label =
      name === 'replaceManagedBotToken' ? 'getManagedBotToken' : name;
    return [required(ctx.managedBot, label).bot.id];
  }
  return [required(ctx[scope], name).id];
}

function installBindings(Type, scopes, style) {
  for (const [scope, names] of Object.entries(scopes)) {
    for (const name of names) {
      contextMethod(Type, name, function (...args) {
        if (style === 'grammy') {
          return contextApiCall(
            this,
            name,
            grammyPrefix(this, scope, name),
            args
          );
        }
        if (scope === 'none') {
          return this.telegram[name](...args);
        }
        this.assert(this[scope], name);
        return this.telegram[name](this[scope].id, ...args);
      });
    }
  }
}

function grammyMethod(
  Type,
  name,
  prefix,
  target = name,
  prepare = (args) => args
) {
  contextMethod(Type, name, function (...args) {
    return contextApiCall(this, target, prefix(this), prepare(args));
  });
}

function installGrammySpecial(Type) {
  grammyMethod(
    Type,
    'replyWithGift',
    (ctx) => [required(ctx.from, 'sendGift').id],
    'sendGift'
  );
  grammyMethod(
    Type,
    'replyWithGiftToChannel',
    (ctx) => [required(ctx.chat, 'sendGift').id],
    'sendGiftToChannel'
  );
  grammyMethod(
    Type,
    'answerCallbackQuery',
    (ctx) => [required(ctx.callbackQuery, 'answerCallbackQuery').id],
    'answerCallbackQuery',
    (args) => [
      typeof args[0] === 'string' ? { text: args[0] } : args[0],
      args[1],
    ]
  );
  grammyMethod(
    Type,
    'answerPreCheckoutQuery',
    (ctx) => [required(ctx.preCheckoutQuery, 'answerPreCheckoutQuery').id],
    'answerPreCheckoutQuery',
    (args) => [
      args[0],
      typeof args[1] === 'string' ? { error_message: args[1] } : args[1],
      args[2],
    ]
  );
  grammyMethod(Type, 'answerGuestQuery', (ctx) => [
    required(ctx.guestMessage?.guest_query_id, 'answerGuestQuery'),
  ]);
  for (const name of [
    'answerChatJoinRequestQuery',
    'replyWithChatJoinRequestWebApp',
  ]) {
    const target =
      name === 'replyWithChatJoinRequestWebApp'
        ? 'sendChatJoinRequestWebApp'
        : name;
    grammyMethod(
      Type,
      name,
      (ctx) => [
        required(ctx.chatJoinRequest?.query_id, 'answerChatJoinRequestQuery'),
      ],
      target
    );
  }
  grammyMethod(Type, 'refundStarPayment', (ctx) => [
    required(ctx.from, 'refundStarPayment').id,
    required(ctx.msg?.successful_payment, 'refundStarPayment')
      .telegram_payment_charge_id,
  ]);
  grammyMethod(Type, 'readBusinessMessage', (ctx) => [
    required(ctx.businessConnectionId, 'readBusinessMessage'),
    required(ctx.chatId, 'readBusinessMessage'),
    required(ctx.msgId, 'readBusinessMessage'),
  ]);
  grammyMethod(Type, 'repostStory', (ctx) => {
    const story = required(ctx.msg?.story, 'repostStory');
    return [
      required(ctx.businessConnectionId, 'repostStory'),
      story.chat.id,
      story.id,
    ];
  });
  contextMethod(Type, 'getUserChatBoosts', function (chat, signal) {
    return this.api.getUserChatBoosts(
      chat ?? required(this.chatId, 'getUserChatBoosts'),
      required(this.from, 'getUserChatBoosts').id,
      signal
    );
  });
  contextMethod(Type, 'getCustomEmojiStickers', function (signal) {
    const ids = (this.msg?.entities ?? [])
      .filter((entity) => entity.type === 'custom_emoji')
      .map((entity) => entity.custom_emoji_id);
    return this.api.getCustomEmojiStickers(ids, signal);
  });
  contextMethod(Type, 'getFile', function (signal) {
    const msg = required(this.msg, 'getFile');
    const file =
      msg.photo !== undefined
        ? msg.photo.at(-1)
        : (msg.animation ??
          msg.audio ??
          msg.document ??
          msg.video ??
          msg.video_note ??
          msg.voice ??
          msg.sticker);
    return this.api.getFile(required(file, 'getFile').file_id, signal);
  });
}

function installTelegrafSpecial(Type) {
  contextMethod(Type, 'setStickerSetThumb', function (...args) {
    return this.telegram.setStickerSetThumbnail(...args);
  });
  contextMethod(Type, 'getUserChatBoosts', function (...args) {
    this.assert(this.chat, 'getUserChatBoosts');
    this.assert(this.from, 'getUserChatBoosts');
    return this.telegram.getUserChatBoosts(this.chat.id, this.from.id, ...args);
  });
  for (const name of ['setChatMenuButton', 'getChatMenuButton']) {
    contextMethod(Type, name, function (...args) {
      this.assert(this.chat, name);
      const setting = name === 'setChatMenuButton';
      const input = {
        chatId: this.chat.id,
        ...(setting && { menuButton: args[0] }),
      };
      const request = args[setting ? 1 : 0];
      return request === undefined
        ? this.telegram[name](input)
        : this.telegram[name](input, request);
    });
  }
}

/** Bind event-scoped RPC helpers while retaining positional API ownership. */
export function installContextServices(Type, style = 'grammy') {
  installBindings(
    Type,
    style === 'grammy' ? grammyScopes : telegrafScopes,
    style
  );
  if (style === 'grammy') {
    installGrammySpecial(Type);
  } else {
    installTelegrafSpecial(Type);
  }
}
