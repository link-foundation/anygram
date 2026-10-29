import type { RequestOptions, TextWithEntities } from './index.js';
import type { BotApiResult, BotArgument, BotOther } from './bot-api-types.js';
interface Signatures {
  getFile: [fileId: BotArgument<'getFile', 'file_id'>];
  getUpdates: [
    timeout?: BotArgument<'getUpdates', 'timeout'>,
    limit?: BotArgument<'getUpdates', 'limit'>,
    offset?: BotArgument<'getUpdates', 'offset'>,
    allowedUpdates?: BotArgument<'getUpdates', 'allowed_updates'>,
  ];
  getWebhookInfo: [];
  getGameHighScores: [
    userId: BotArgument<'getGameHighScores', 'user_id'>,
    inlineMessageId?: BotArgument<'getGameHighScores', 'inline_message_id'>,
    chatId?: BotArgument<'getGameHighScores', 'chat_id'>,
    messageId?: BotArgument<'getGameHighScores', 'message_id'>,
  ];
  setGameScore: [
    userId: BotArgument<'setGameScore', 'user_id'>,
    score: BotArgument<'setGameScore', 'score'>,
    inlineMessageId?: BotArgument<'setGameScore', 'inline_message_id'>,
    chatId?: BotArgument<'setGameScore', 'chat_id'>,
    messageId?: BotArgument<'setGameScore', 'message_id'>,
    editMessage?: BotArgument<'setGameScore', 'disable_edit_message'>,
    force?: BotArgument<'setGameScore', 'force'>,
  ];
  setWebhook: [
    url: BotArgument<'setWebhook', 'url'>,
    extra?: Partial<BotOther<'setWebhook', 'url'>>,
  ];
  deleteWebhook: [extra?: Partial<BotOther<'deleteWebhook', never>>];
  forwardMessage: [
    chatId: BotArgument<'forwardMessage', 'chat_id'>,
    fromChatId: BotArgument<'forwardMessage', 'from_chat_id'>,
    messageId: BotArgument<'forwardMessage', 'message_id'>,
    extra?: Partial<
      BotOther<'forwardMessage', 'chat_id' | 'from_chat_id' | 'message_id'>
    >,
  ];
  forwardMessages: [
    chatId: BotArgument<'forwardMessages', 'chat_id'>,
    fromChatId: BotArgument<'forwardMessages', 'from_chat_id'>,
    messageIds: BotArgument<'forwardMessages', 'message_ids'>,
    extra?: Partial<
      BotOther<'forwardMessages', 'chat_id' | 'from_chat_id' | 'message_ids'>
    >,
  ];
  sendChatAction: [
    chat_id: BotArgument<'sendChatAction', 'chat_id'>,
    action: BotArgument<'sendChatAction', 'action'>,
    extra?: Partial<BotOther<'sendChatAction', 'chat_id' | 'action'>>,
  ];
  setMessageReaction: [
    chat_id: BotArgument<'setMessageReaction', 'chat_id'>,
    message_id: BotArgument<'setMessageReaction', 'message_id'>,
    reaction?: BotArgument<'setMessageReaction', 'reaction'>,
    is_big?: BotArgument<'setMessageReaction', 'is_big'>,
  ];
  getUserProfilePhotos: [
    userId: BotArgument<'getUserProfilePhotos', 'user_id'>,
    offset?: BotArgument<'getUserProfilePhotos', 'offset'>,
    limit?: BotArgument<'getUserProfilePhotos', 'limit'>,
  ];
  sendLocation: [
    chatId: BotArgument<'sendLocation', 'chat_id'>,
    latitude: BotArgument<'sendLocation', 'latitude'>,
    longitude: BotArgument<'sendLocation', 'longitude'>,
    extra?: Partial<
      BotOther<'sendLocation', 'chat_id' | 'latitude' | 'longitude'>
    >,
  ];
  sendVenue: [
    chatId: BotArgument<'sendVenue', 'chat_id'>,
    latitude: BotArgument<'sendVenue', 'latitude'>,
    longitude: BotArgument<'sendVenue', 'longitude'>,
    title: BotArgument<'sendVenue', 'title'>,
    address: BotArgument<'sendVenue', 'address'>,
    extra?: Partial<
      BotOther<
        'sendVenue',
        'latitude' | 'longitude' | 'title' | 'address' | 'chat_id'
      >
    >,
  ];
  sendInvoice: [
    chatId: BotArgument<'sendInvoice', 'chat_id'>,
    invoice: BotOther<'sendInvoice', 'chat_id'>,
    extra?: Partial<BotOther<'sendInvoice', 'chat_id'>>,
  ];
  sendContact: [
    chatId: BotArgument<'sendContact', 'chat_id'>,
    phoneNumber: BotArgument<'sendContact', 'phone_number'>,
    firstName: BotArgument<'sendContact', 'first_name'>,
    extra?: Partial<
      BotOther<'sendContact', 'chat_id' | 'phone_number' | 'first_name'>
    >,
  ];
  sendDice: [
    chatId: BotArgument<'sendDice', 'chat_id'>,
    extra?: Partial<BotOther<'sendDice', 'chat_id'>>,
  ];
  sendVideoNote: [
    chatId: BotArgument<'sendVideoNote', 'chat_id'>,
    videoNote: BotArgument<'sendVideoNote', 'video_note'>,
    extra?: Partial<BotOther<'sendVideoNote', 'chat_id' | 'video_note'>>,
  ];
  sendGame: [
    chatId: BotArgument<'sendGame', 'chat_id'>,
    gameName: BotArgument<'sendGame', 'game_short_name'>,
    extra?: Partial<BotOther<'sendGame', 'chat_id' | 'game_short_name'>>,
  ];
  sendMediaGroup: [
    chatId: BotArgument<'sendMediaGroup', 'chat_id'>,
    media: BotArgument<'sendMediaGroup', 'media'>,
    extra?: Partial<BotOther<'sendMediaGroup', 'chat_id' | 'media'>>,
  ];
  sendPoll: [
    chatId: BotArgument<'sendPoll', 'chat_id'>,
    question: BotArgument<'sendPoll', 'question'>,
    options: BotArgument<'sendPoll', 'options'>,
    extra?: Partial<
      BotOther<'sendPoll', 'chat_id' | 'type' | 'question' | 'options'>
    >,
  ];
  sendQuiz: Signatures['sendPoll'];
  stopPoll: [
    chatId: BotArgument<'stopPoll', 'chat_id'>,
    messageId: BotArgument<'stopPoll', 'message_id'>,
    extra?: Partial<BotOther<'stopPoll', 'chat_id' | 'message_id'>>,
  ];
  getChat: [chatId: BotArgument<'getChat', 'chat_id'>];
  getChatAdministrators: [
    chatId: BotArgument<'getChatAdministrators', 'chat_id'>,
  ];
  getChatMember: [
    chatId: BotArgument<'getChatMember', 'chat_id'>,
    userId: BotArgument<'getChatMember', 'user_id'>,
  ];
  getChatMembersCount: [chatId: BotArgument<'getChatMemberCount', 'chat_id'>];
  answerInlineQuery: [
    inlineQueryId: BotArgument<'answerInlineQuery', 'inline_query_id'>,
    results: BotArgument<'answerInlineQuery', 'results'>,
    extra?: Partial<
      BotOther<'answerInlineQuery', 'inline_query_id' | 'results'>
    >,
  ];
  setChatPermissions: [
    chatId: BotArgument<'setChatPermissions', 'chat_id'>,
    permissions: BotArgument<'setChatPermissions', 'permissions'>,
    extra?: Partial<BotOther<'setChatPermissions', 'chat_id' | 'permissions'>>,
  ];
  banChatMember: [
    chatId: BotArgument<'banChatMember', 'chat_id'>,
    userId: BotArgument<'banChatMember', 'user_id'>,
    untilDate?: BotArgument<'banChatMember', 'until_date'>,
    extra?: Partial<
      BotOther<'banChatMember', 'chat_id' | 'user_id' | 'until_date'>
    >,
  ];
  kickChatMember: Signatures['banChatMember'];
  promoteChatMember: [
    chatId: BotArgument<'promoteChatMember', 'chat_id'>,
    userId: BotArgument<'promoteChatMember', 'user_id'>,
    extra?: Partial<BotOther<'promoteChatMember', 'chat_id' | 'user_id'>>,
  ];
  restrictChatMember: [
    chatId: BotArgument<'restrictChatMember', 'chat_id'>,
    userId: BotArgument<'restrictChatMember', 'user_id'>,
    extra?: Partial<BotOther<'restrictChatMember', 'chat_id' | 'user_id'>>,
  ];
  setChatAdministratorCustomTitle: [
    chatId: BotArgument<'setChatAdministratorCustomTitle', 'chat_id'>,
    userId: BotArgument<'setChatAdministratorCustomTitle', 'user_id'>,
    title: BotArgument<'setChatAdministratorCustomTitle', 'custom_title'>,
  ];
  exportChatInviteLink: [
    chatId: BotArgument<'exportChatInviteLink', 'chat_id'>,
  ];
  createChatInviteLink: [
    chatId: BotArgument<'createChatInviteLink', 'chat_id'>,
    extra?: Partial<BotOther<'createChatInviteLink', 'chat_id'>>,
  ];
  createInvoiceLink: [invoice: BotOther<'createInvoiceLink', never>];
  editChatInviteLink: [
    chatId: BotArgument<'editChatInviteLink', 'chat_id'>,
    inviteLink: BotArgument<'editChatInviteLink', 'invite_link'>,
    extra?: Partial<BotOther<'editChatInviteLink', 'chat_id' | 'invite_link'>>,
  ];
  revokeChatInviteLink: [
    chatId: BotArgument<'revokeChatInviteLink', 'chat_id'>,
    inviteLink: BotArgument<'revokeChatInviteLink', 'invite_link'>,
  ];
  setChatPhoto: [
    chatId: BotArgument<'setChatPhoto', 'chat_id'>,
    photo: BotArgument<'setChatPhoto', 'photo'>,
  ];
  deleteChatPhoto: [chatId: BotArgument<'deleteChatPhoto', 'chat_id'>];
  setChatTitle: [
    chatId: BotArgument<'setChatTitle', 'chat_id'>,
    title: BotArgument<'setChatTitle', 'title'>,
  ];
  setChatDescription: [
    chatId: BotArgument<'setChatDescription', 'chat_id'>,
    description?: BotArgument<'setChatDescription', 'description'>,
  ];
  pinChatMessage: [
    chatId: BotArgument<'pinChatMessage', 'chat_id'>,
    messageId: BotArgument<'pinChatMessage', 'message_id'>,
    extra?: Partial<BotOther<'pinChatMessage', 'chat_id' | 'message_id'>>,
  ];
  unpinChatMessage: [
    chatId: BotArgument<'unpinChatMessage', 'chat_id'>,
    messageId?: BotArgument<'unpinChatMessage', 'message_id'>,
  ];
  unpinAllChatMessages: [
    chatId: BotArgument<'unpinAllChatMessages', 'chat_id'>,
  ];
  leaveChat: [chatId: BotArgument<'leaveChat', 'chat_id'>];
  unbanChatMember: [
    chatId: BotArgument<'unbanChatMember', 'chat_id'>,
    userId: BotArgument<'unbanChatMember', 'user_id'>,
    extra?: Partial<BotOther<'unbanChatMember', 'chat_id' | 'user_id'>>,
  ];
  answerCbQuery: [
    callbackQueryId: BotArgument<'answerCallbackQuery', 'callback_query_id'>,
    text?: BotArgument<'answerCallbackQuery', 'text'>,
    extra?: Partial<
      BotOther<'answerCallbackQuery', 'text' | 'callback_query_id'>
    >,
  ];
  answerGameQuery: [
    callbackQueryId: BotArgument<'answerCallbackQuery', 'callback_query_id'>,
    url?: BotArgument<'answerCallbackQuery', 'url'>,
  ];
  getUserChatBoosts: [
    chat_id: BotArgument<'getUserChatBoosts', 'chat_id'>,
    user_id: BotArgument<'getUserChatBoosts', 'user_id'>,
  ];
  answerShippingQuery: [
    shippingQueryId: BotArgument<'answerShippingQuery', 'shipping_query_id'>,
    ok: BotArgument<'answerShippingQuery', 'ok'>,
    shippingOptions?: BotArgument<'answerShippingQuery', 'shipping_options'>,
    errorMessage?: BotArgument<'answerShippingQuery', 'error_message'>,
  ];
  answerPreCheckoutQuery: [
    preCheckoutQueryId: BotArgument<
      'answerPreCheckoutQuery',
      'pre_checkout_query_id'
    >,
    ok: BotArgument<'answerPreCheckoutQuery', 'ok'>,
    errorMessage?: BotArgument<'answerPreCheckoutQuery', 'error_message'>,
  ];
  answerWebAppQuery: [
    webAppQueryId: BotArgument<'answerWebAppQuery', 'web_app_query_id'>,
    result: BotArgument<'answerWebAppQuery', 'result'>,
  ];
  editMessageCaption: [
    chatId?: BotArgument<'editMessageCaption', 'chat_id'>,
    messageId?: BotArgument<'editMessageCaption', 'message_id'>,
    inlineMessageId?: BotArgument<'editMessageCaption', 'inline_message_id'>,
    caption?: BotArgument<'editMessageCaption', 'caption'>,
    extra?: Partial<
      BotOther<
        'editMessageCaption',
        'chat_id' | 'message_id' | 'inline_message_id' | 'caption'
      >
    >,
  ];
  editMessageMedia: [
    chatId: BotArgument<'editMessageMedia', 'chat_id'>,
    messageId: BotArgument<'editMessageMedia', 'message_id'>,
    inlineMessageId: BotArgument<'editMessageMedia', 'inline_message_id'>,
    media: BotArgument<'editMessageMedia', 'media'>,
    extra?: Partial<
      BotOther<
        'editMessageMedia',
        'chat_id' | 'message_id' | 'inline_message_id' | 'media'
      >
    >,
  ];
  editMessageReplyMarkup: [
    chatId?: BotArgument<'editMessageReplyMarkup', 'chat_id'>,
    messageId?: BotArgument<'editMessageReplyMarkup', 'message_id'>,
    inlineMessageId?: BotArgument<
      'editMessageReplyMarkup',
      'inline_message_id'
    >,
    markup?: BotArgument<'editMessageReplyMarkup', 'reply_markup'>,
  ];
  editMessageLiveLocation: [
    chatId: BotArgument<'editMessageLiveLocation', 'chat_id'>,
    messageId: BotArgument<'editMessageLiveLocation', 'message_id'>,
    inlineMessageId: BotArgument<
      'editMessageLiveLocation',
      'inline_message_id'
    >,
    latitude: BotArgument<'editMessageLiveLocation', 'latitude'>,
    longitude: BotArgument<'editMessageLiveLocation', 'longitude'>,
    extra?: Partial<
      BotOther<
        'editMessageLiveLocation',
        | 'latitude'
        | 'longitude'
        | 'chat_id'
        | 'message_id'
        | 'inline_message_id'
      >
    >,
  ];
  stopMessageLiveLocation: [
    chatId?: BotArgument<'stopMessageLiveLocation', 'chat_id'>,
    messageId?: BotArgument<'stopMessageLiveLocation', 'message_id'>,
    inlineMessageId?: BotArgument<
      'stopMessageLiveLocation',
      'inline_message_id'
    >,
    markup?: BotArgument<'stopMessageLiveLocation', 'reply_markup'>,
  ];
  deleteMessages: [
    chatId: BotArgument<'deleteMessages', 'chat_id'>,
    messageIds: BotArgument<'deleteMessages', 'message_ids'>,
  ];
  setChatStickerSet: [
    chatId: BotArgument<'setChatStickerSet', 'chat_id'>,
    setName: BotArgument<'setChatStickerSet', 'sticker_set_name'>,
  ];
  deleteChatStickerSet: [
    chatId: BotArgument<'deleteChatStickerSet', 'chat_id'>,
  ];
  getForumTopicIconStickers: Signatures['getWebhookInfo'];
  createForumTopic: [
    chat_id: BotArgument<'createForumTopic', 'chat_id'>,
    name: BotArgument<'createForumTopic', 'name'>,
    extra?: Partial<BotOther<'createForumTopic', 'chat_id' | 'name'>>,
  ];
  editForumTopic: [
    chat_id: BotArgument<'editForumTopic', 'chat_id'>,
    message_thread_id: BotArgument<'editForumTopic', 'message_thread_id'>,
    extra?: Partial<
      BotOther<'editForumTopic', 'chat_id' | 'message_thread_id'>
    >,
  ];
  closeForumTopic: [
    chat_id: BotArgument<'closeForumTopic', 'chat_id'>,
    message_thread_id: BotArgument<'closeForumTopic', 'message_thread_id'>,
  ];
  reopenForumTopic: [
    chat_id: BotArgument<'reopenForumTopic', 'chat_id'>,
    message_thread_id: BotArgument<'reopenForumTopic', 'message_thread_id'>,
  ];
  deleteForumTopic: [
    chat_id: BotArgument<'deleteForumTopic', 'chat_id'>,
    message_thread_id: BotArgument<'deleteForumTopic', 'message_thread_id'>,
  ];
  unpinAllForumTopicMessages: [
    chat_id: BotArgument<'unpinAllForumTopicMessages', 'chat_id'>,
    message_thread_id: BotArgument<
      'unpinAllForumTopicMessages',
      'message_thread_id'
    >,
  ];
  editGeneralForumTopic: [
    chat_id: BotArgument<'editGeneralForumTopic', 'chat_id'>,
    name: BotArgument<'editGeneralForumTopic', 'name'>,
  ];
  closeGeneralForumTopic: [
    chat_id: BotArgument<'closeGeneralForumTopic', 'chat_id'>,
  ];
  reopenGeneralForumTopic: [
    chat_id: BotArgument<'reopenGeneralForumTopic', 'chat_id'>,
  ];
  hideGeneralForumTopic: [
    chat_id: BotArgument<'hideGeneralForumTopic', 'chat_id'>,
  ];
  unhideGeneralForumTopic: [
    chat_id: BotArgument<'unhideGeneralForumTopic', 'chat_id'>,
  ];
  unpinAllGeneralForumTopicMessages: [
    chat_id: BotArgument<'unpinAllGeneralForumTopicMessages', 'chat_id'>,
  ];
  getStickerSet: [name: BotArgument<'getStickerSet', 'name'>];
  uploadStickerFile: [
    ownerId: BotArgument<'uploadStickerFile', 'user_id'>,
    sticker: BotArgument<'uploadStickerFile', 'sticker'>,
    sticker_format: BotArgument<'uploadStickerFile', 'sticker_format'>,
  ];
  createNewStickerSet: [
    ownerId: BotArgument<'createNewStickerSet', 'user_id'>,
    name: BotArgument<'createNewStickerSet', 'name'>,
    title: BotArgument<'createNewStickerSet', 'title'>,
    stickerData: BotOther<'createNewStickerSet', 'name' | 'title' | 'user_id'>,
  ];
  addStickerToSet: [
    ownerId: BotArgument<'addStickerToSet', 'user_id'>,
    name: BotArgument<'addStickerToSet', 'name'>,
    stickerData: BotOther<'addStickerToSet', 'name' | 'user_id'>,
  ];
  setStickerPositionInSet: [
    sticker: BotArgument<'setStickerPositionInSet', 'sticker'>,
    position: BotArgument<'setStickerPositionInSet', 'position'>,
  ];
  setStickerSetThumb: [
    name: BotArgument<'setStickerSetThumbnail', 'name'>,
    userId: BotArgument<'setStickerSetThumbnail', 'user_id'>,
    thumbnail?: BotArgument<'setStickerSetThumbnail', 'thumbnail'>,
  ];
  setStickerSetThumbnail: Signatures['setStickerSetThumb'];
  setStickerMaskPosition: [
    sticker: BotArgument<'setStickerMaskPosition', 'sticker'>,
    mask_position?: BotArgument<'setStickerMaskPosition', 'mask_position'>,
  ];
  setStickerKeywords: [
    sticker: BotArgument<'setStickerKeywords', 'sticker'>,
    keywords?: BotArgument<'setStickerKeywords', 'keywords'>,
  ];
  setStickerEmojiList: [
    sticker: BotArgument<'setStickerEmojiList', 'sticker'>,
    emoji_list: BotArgument<'setStickerEmojiList', 'emoji_list'>,
  ];
  deleteStickerSet: [name: BotArgument<'deleteStickerSet', 'name'>];
  setStickerSetTitle: [
    name: BotArgument<'setStickerSetTitle', 'name'>,
    title: BotArgument<'setStickerSetTitle', 'title'>,
  ];
  setCustomEmojiStickerSetThumbnail: [
    name: BotArgument<'setCustomEmojiStickerSetThumbnail', 'name'>,
    custom_emoji_id?: BotArgument<
      'setCustomEmojiStickerSetThumbnail',
      'custom_emoji_id'
    >,
  ];
  deleteStickerFromSet: [
    sticker: BotArgument<'deleteStickerFromSet', 'sticker'>,
  ];
  getCustomEmojiStickers: [
    custom_emoji_ids: BotArgument<'getCustomEmojiStickers', 'custom_emoji_ids'>,
  ];
  setMyCommands: [
    commands: BotArgument<'setMyCommands', 'commands'>,
    extra?: Partial<BotOther<'setMyCommands', 'commands'>>,
  ];
  deleteMyCommands: [extra?: Partial<BotOther<'deleteMyCommands', never>>];
  getMyCommands: [extra?: Partial<BotOther<'getMyCommands', never>>];
  setMyDescription: [
    description?: BotArgument<'setMyDescription', 'description'>,
    language_code?: BotArgument<'setMyDescription', 'language_code'>,
  ];
  setMyName: [
    name?: BotArgument<'setMyName', 'name'>,
    language_code?: BotArgument<'setMyName', 'language_code'>,
  ];
  getMyName: [language_code?: BotArgument<'getMyName', 'language_code'>];
  getMyDescription: [
    language_code?: BotArgument<'getMyDescription', 'language_code'>,
  ];
  setMyShortDescription: [
    short_description?: BotArgument<
      'setMyShortDescription',
      'short_description'
    >,
    language_code?: BotArgument<'setMyShortDescription', 'language_code'>,
  ];
  getMyShortDescription: [
    language_code?: BotArgument<'getMyShortDescription', 'language_code'>,
  ];
  setPassportDataErrors: [
    userId: BotArgument<'setPassportDataErrors', 'user_id'>,
    errors: BotArgument<'setPassportDataErrors', 'errors'>,
  ];
  sendCopy: [
    chatId: BotArgument<'copyMessage', 'chat_id'>,
    message: {
      chat: { id: BotArgument<'copyMessage', 'from_chat_id'> };
      message_id: BotArgument<'copyMessage', 'message_id'>;
    },
    extra?: Partial<
      BotOther<'copyMessage', 'chat_id' | 'from_chat_id' | 'message_id'>
    >,
  ];
  copyMessage: [
    chatId: BotArgument<'copyMessage', 'chat_id'>,
    fromChatId: BotArgument<'copyMessage', 'from_chat_id'>,
    messageId: BotArgument<'copyMessage', 'message_id'>,
    extra?: Partial<
      BotOther<'copyMessage', 'chat_id' | 'from_chat_id' | 'message_id'>
    >,
  ];
  copyMessages: [
    chatId: BotArgument<'copyMessages', 'chat_id'>,
    fromChatId: BotArgument<'copyMessages', 'from_chat_id'>,
    messageIds: BotArgument<'copyMessages', 'message_ids'>,
    extra?: Partial<
      BotOther<'copyMessages', 'chat_id' | 'from_chat_id' | 'message_ids'>
    >,
  ];
  approveChatJoinRequest: [
    chatId: BotArgument<'approveChatJoinRequest', 'chat_id'>,
    userId: BotArgument<'approveChatJoinRequest', 'user_id'>,
  ];
  declineChatJoinRequest: [
    chatId: BotArgument<'declineChatJoinRequest', 'chat_id'>,
    userId: BotArgument<'declineChatJoinRequest', 'user_id'>,
  ];
  banChatSenderChat: [
    chatId: BotArgument<'banChatSenderChat', 'chat_id'>,
    senderChatId: BotArgument<'banChatSenderChat', 'sender_chat_id'>,
    extra?: Partial<
      BotOther<'banChatSenderChat', 'chat_id' | 'sender_chat_id'>
    >,
  ];
  unbanChatSenderChat: [
    chatId: BotArgument<'unbanChatSenderChat', 'chat_id'>,
    senderChatId: BotArgument<'unbanChatSenderChat', 'sender_chat_id'>,
  ];
  setChatMenuButton: [
    input?: {
      chatId?: BotArgument<'setChatMenuButton', 'chat_id'>;
      menuButton?: BotArgument<'setChatMenuButton', 'menu_button'>;
    },
  ];
  getChatMenuButton: [
    input?: { chatId?: BotArgument<'getChatMenuButton', 'chat_id'> },
  ];
  setMyDefaultAdministratorRights: [
    input?: {
      rights?: BotArgument<'setMyDefaultAdministratorRights', 'rights'>;
      forChannels?: BotArgument<
        'setMyDefaultAdministratorRights',
        'for_channels'
      >;
    },
  ];
  getMyDefaultAdministratorRights: [
    input?: {
      forChannels?: BotArgument<
        'getMyDefaultAdministratorRights',
        'for_channels'
      >;
    },
  ];
  logOut: Signatures['getWebhookInfo'];
  close: Signatures['getWebhookInfo'];
}
interface Routes {
  getFile: 'getFile';
  getUpdates: 'getUpdates';
  getWebhookInfo: 'getWebhookInfo';
  getGameHighScores: 'getGameHighScores';
  setGameScore: 'setGameScore';
  setWebhook: 'setWebhook';
  deleteWebhook: 'deleteWebhook';
  forwardMessage: 'forwardMessage';
  forwardMessages: 'forwardMessages';
  sendChatAction: 'sendChatAction';
  setMessageReaction: 'setMessageReaction';
  getUserProfilePhotos: 'getUserProfilePhotos';
  sendLocation: 'sendLocation';
  sendVenue: 'sendVenue';
  sendInvoice: 'sendInvoice';
  sendContact: 'sendContact';
  sendDice: 'sendDice';
  sendVideoNote: 'sendVideoNote';
  sendGame: 'sendGame';
  sendMediaGroup: 'sendMediaGroup';
  sendPoll: 'sendPoll';
  sendQuiz: 'sendPoll';
  stopPoll: 'stopPoll';
  getChat: 'getChat';
  getChatAdministrators: 'getChatAdministrators';
  getChatMember: 'getChatMember';
  getChatMembersCount: 'getChatMemberCount';
  answerInlineQuery: 'answerInlineQuery';
  setChatPermissions: 'setChatPermissions';
  banChatMember: 'banChatMember';
  kickChatMember: 'banChatMember';
  promoteChatMember: 'promoteChatMember';
  restrictChatMember: 'restrictChatMember';
  setChatAdministratorCustomTitle: 'setChatAdministratorCustomTitle';
  exportChatInviteLink: 'exportChatInviteLink';
  createChatInviteLink: 'createChatInviteLink';
  createInvoiceLink: 'createInvoiceLink';
  editChatInviteLink: 'editChatInviteLink';
  revokeChatInviteLink: 'revokeChatInviteLink';
  setChatPhoto: 'setChatPhoto';
  deleteChatPhoto: 'deleteChatPhoto';
  setChatTitle: 'setChatTitle';
  setChatDescription: 'setChatDescription';
  pinChatMessage: 'pinChatMessage';
  unpinChatMessage: 'unpinChatMessage';
  unpinAllChatMessages: 'unpinAllChatMessages';
  leaveChat: 'leaveChat';
  unbanChatMember: 'unbanChatMember';
  answerCbQuery: 'answerCallbackQuery';
  answerGameQuery: 'answerCallbackQuery';
  getUserChatBoosts: 'getUserChatBoosts';
  answerShippingQuery: 'answerShippingQuery';
  answerPreCheckoutQuery: 'answerPreCheckoutQuery';
  answerWebAppQuery: 'answerWebAppQuery';
  editMessageCaption: 'editMessageCaption';
  editMessageMedia: 'editMessageMedia';
  editMessageReplyMarkup: 'editMessageReplyMarkup';
  editMessageLiveLocation: 'editMessageLiveLocation';
  stopMessageLiveLocation: 'stopMessageLiveLocation';
  deleteMessages: 'deleteMessages';
  setChatStickerSet: 'setChatStickerSet';
  deleteChatStickerSet: 'deleteChatStickerSet';
  getForumTopicIconStickers: 'getForumTopicIconStickers';
  createForumTopic: 'createForumTopic';
  editForumTopic: 'editForumTopic';
  closeForumTopic: 'closeForumTopic';
  reopenForumTopic: 'reopenForumTopic';
  deleteForumTopic: 'deleteForumTopic';
  unpinAllForumTopicMessages: 'unpinAllForumTopicMessages';
  editGeneralForumTopic: 'editGeneralForumTopic';
  closeGeneralForumTopic: 'closeGeneralForumTopic';
  reopenGeneralForumTopic: 'reopenGeneralForumTopic';
  hideGeneralForumTopic: 'hideGeneralForumTopic';
  unhideGeneralForumTopic: 'unhideGeneralForumTopic';
  unpinAllGeneralForumTopicMessages: 'unpinAllGeneralForumTopicMessages';
  getStickerSet: 'getStickerSet';
  uploadStickerFile: 'uploadStickerFile';
  createNewStickerSet: 'createNewStickerSet';
  addStickerToSet: 'addStickerToSet';
  setStickerPositionInSet: 'setStickerPositionInSet';
  setStickerSetThumb: 'setStickerSetThumbnail';
  setStickerSetThumbnail: 'setStickerSetThumbnail';
  setStickerMaskPosition: 'setStickerMaskPosition';
  setStickerKeywords: 'setStickerKeywords';
  setStickerEmojiList: 'setStickerEmojiList';
  deleteStickerSet: 'deleteStickerSet';
  setStickerSetTitle: 'setStickerSetTitle';
  setCustomEmojiStickerSetThumbnail: 'setCustomEmojiStickerSetThumbnail';
  deleteStickerFromSet: 'deleteStickerFromSet';
  getCustomEmojiStickers: 'getCustomEmojiStickers';
  setMyCommands: 'setMyCommands';
  deleteMyCommands: 'deleteMyCommands';
  getMyCommands: 'getMyCommands';
  setMyDescription: 'setMyDescription';
  setMyName: 'setMyName';
  getMyName: 'getMyName';
  getMyDescription: 'getMyDescription';
  setMyShortDescription: 'setMyShortDescription';
  getMyShortDescription: 'getMyShortDescription';
  setPassportDataErrors: 'setPassportDataErrors';
  sendCopy: 'copyMessage';
  copyMessage: 'copyMessage';
  copyMessages: 'copyMessages';
  approveChatJoinRequest: 'approveChatJoinRequest';
  declineChatJoinRequest: 'declineChatJoinRequest';
  banChatSenderChat: 'banChatSenderChat';
  unbanChatSenderChat: 'unbanChatSenderChat';
  setChatMenuButton: 'setChatMenuButton';
  getChatMenuButton: 'getChatMenuButton';
  setMyDefaultAdministratorRights: 'setMyDefaultAdministratorRights';
  getMyDefaultAdministratorRights: 'getMyDefaultAdministratorRights';
  logOut: 'logOut';
  close: 'close';
}
export type TelegrafPositionalArguments<K extends keyof Signatures> = [
  ...Signatures[K],
  request?: RequestOptions | AbortSignal,
];
export type TelegrafPositionalResult<K extends keyof Signatures> = BotApiResult<
  Routes[K]
>;
export type TelegrafPositionalApi = {
  [M in keyof Signatures]: (
    ...args: TelegrafPositionalArguments<M>
  ) => Promise<TelegrafPositionalResult<M>>;
};
