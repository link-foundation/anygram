import type { RequestOptions } from './index.js';
// Public argument facts share one callable declaration and request boundary.
interface Signatures {
  getFile: [fileId: unknown];
  getUpdates: [
    timeout: unknown,
    limit: unknown,
    offset: unknown,
    allowedUpdates: unknown,
  ];
  getWebhookInfo: [];
  getGameHighScores: [
    userId: unknown,
    inlineMessageId: unknown,
    chatId: unknown,
    messageId: unknown,
  ];
  setGameScore: [
    userId: unknown,
    score: unknown,
    inlineMessageId: unknown,
    chatId: unknown,
    messageId: unknown,
    editMessage?: unknown,
    force?: unknown,
  ];
  setWebhook: [url: unknown, extra?: unknown];
  deleteWebhook: [extra?: unknown];
  forwardMessage: [
    chatId: unknown,
    fromChatId: unknown,
    messageId: unknown,
    extra?: unknown,
  ];
  forwardMessages: [
    chatId: unknown,
    fromChatId: unknown,
    messageIds: unknown,
    extra?: unknown,
  ];
  sendChatAction: [chat_id: unknown, action: unknown, extra?: unknown];
  setMessageReaction: [
    chat_id: unknown,
    message_id: unknown,
    reaction: unknown,
    is_big: unknown,
  ];
  getUserProfilePhotos: [userId: unknown, offset: unknown, limit: unknown];
  sendLocation: [
    chatId: unknown,
    latitude: unknown,
    longitude: unknown,
    extra?: unknown,
  ];
  sendVenue: [
    chatId: unknown,
    latitude: unknown,
    longitude: unknown,
    title: unknown,
    address: unknown,
    extra?: unknown,
  ];
  sendInvoice: [chatId: unknown, invoice: unknown, extra?: unknown];
  sendContact: [
    chatId: unknown,
    phoneNumber: unknown,
    firstName: unknown,
    extra?: unknown,
  ];
  sendDice: [chatId: unknown, extra?: unknown];
  sendVideoNote: [chatId: unknown, videoNote: unknown, extra?: unknown];
  sendGame: [chatId: unknown, gameName: unknown, extra?: unknown];
  sendMediaGroup: [chatId: unknown, media: unknown, extra?: unknown];
  sendPoll: [
    chatId: unknown,
    question: unknown,
    options: unknown,
    extra?: unknown,
  ];
  sendQuiz: [
    chatId: unknown,
    question: unknown,
    options: unknown,
    extra?: unknown,
  ];
  stopPoll: [chatId: unknown, messageId: unknown, extra?: unknown];
  getChat: [chatId: unknown];
  getChatAdministrators: [chatId: unknown];
  getChatMember: [chatId: unknown, userId: unknown];
  getChatMembersCount: [chatId: unknown];
  answerInlineQuery: [
    inlineQueryId: unknown,
    results: unknown,
    extra?: unknown,
  ];
  setChatPermissions: [chatId: unknown, permissions: unknown, extra?: unknown];
  banChatMember: [
    chatId: unknown,
    userId: unknown,
    untilDate: unknown,
    extra?: unknown,
  ];
  kickChatMember: [
    chatId: unknown,
    userId: unknown,
    untilDate: unknown,
    extra?: unknown,
  ];
  promoteChatMember: [chatId: unknown, userId: unknown, extra?: unknown];
  restrictChatMember: [chatId: unknown, userId: unknown, extra?: unknown];
  setChatAdministratorCustomTitle: [
    chatId: unknown,
    userId: unknown,
    title: unknown,
  ];
  exportChatInviteLink: [chatId: unknown];
  createChatInviteLink: [chatId: unknown, extra?: unknown];
  createInvoiceLink: [invoice: unknown];
  editChatInviteLink: [chatId: unknown, inviteLink: unknown, extra?: unknown];
  revokeChatInviteLink: [chatId: unknown, inviteLink: unknown];
  setChatPhoto: [chatId: unknown, photo: unknown];
  deleteChatPhoto: [chatId: unknown];
  setChatTitle: [chatId: unknown, title: unknown];
  setChatDescription: [chatId: unknown, description: unknown];
  pinChatMessage: [chatId: unknown, messageId: unknown, extra?: unknown];
  unpinChatMessage: [chatId: unknown, messageId: unknown];
  unpinAllChatMessages: [chatId: unknown];
  leaveChat: [chatId: unknown];
  unbanChatMember: [chatId: unknown, userId: unknown, extra?: unknown];
  answerCbQuery: [callbackQueryId: unknown, text: unknown, extra?: unknown];
  answerGameQuery: [callbackQueryId: unknown, url: unknown];
  getUserChatBoosts: [chat_id: unknown, user_id: unknown];
  answerShippingQuery: [
    shippingQueryId: unknown,
    ok: unknown,
    shippingOptions: unknown,
    errorMessage: unknown,
  ];
  answerPreCheckoutQuery: [
    preCheckoutQueryId: unknown,
    ok: unknown,
    errorMessage: unknown,
  ];
  answerWebAppQuery: [webAppQueryId: unknown, result: unknown];
  editMessageCaption: [
    chatId: unknown,
    messageId: unknown,
    inlineMessageId: unknown,
    caption: unknown,
    extra?: unknown,
  ];
  editMessageMedia: [
    chatId: unknown,
    messageId: unknown,
    inlineMessageId: unknown,
    media: unknown,
    extra?: unknown,
  ];
  editMessageReplyMarkup: [
    chatId: unknown,
    messageId: unknown,
    inlineMessageId: unknown,
    markup: unknown,
  ];
  editMessageLiveLocation: [
    chatId: unknown,
    messageId: unknown,
    inlineMessageId: unknown,
    latitude: unknown,
    longitude: unknown,
    extra?: unknown,
  ];
  stopMessageLiveLocation: [
    chatId: unknown,
    messageId: unknown,
    inlineMessageId: unknown,
    markup: unknown,
  ];
  deleteMessages: [chatId: unknown, messageIds: unknown];
  setChatStickerSet: [chatId: unknown, setName: unknown];
  deleteChatStickerSet: [chatId: unknown];
  getForumTopicIconStickers: [];
  createForumTopic: [chat_id: unknown, name: unknown, extra?: unknown];
  editForumTopic: [
    chat_id: unknown,
    message_thread_id: unknown,
    extra?: unknown,
  ];
  closeForumTopic: [chat_id: unknown, message_thread_id: unknown];
  reopenForumTopic: [chat_id: unknown, message_thread_id: unknown];
  deleteForumTopic: [chat_id: unknown, message_thread_id: unknown];
  unpinAllForumTopicMessages: [chat_id: unknown, message_thread_id: unknown];
  editGeneralForumTopic: [chat_id: unknown, name: unknown];
  closeGeneralForumTopic: [chat_id: unknown];
  reopenGeneralForumTopic: [chat_id: unknown];
  hideGeneralForumTopic: [chat_id: unknown];
  unhideGeneralForumTopic: [chat_id: unknown];
  unpinAllGeneralForumTopicMessages: [chat_id: unknown];
  getStickerSet: [name: unknown];
  uploadStickerFile: [
    ownerId: unknown,
    sticker: unknown,
    sticker_format: unknown,
  ];
  createNewStickerSet: [
    ownerId: unknown,
    name: unknown,
    title: unknown,
    stickerData: unknown,
  ];
  addStickerToSet: [ownerId: unknown, name: unknown, stickerData: unknown];
  setStickerPositionInSet: [sticker: unknown, position: unknown];
  setStickerSetThumb: [name: unknown, userId: unknown, thumbnail: unknown];
  setStickerSetThumbnail: [name: unknown, userId: unknown, thumbnail: unknown];
  setStickerMaskPosition: [sticker: unknown, mask_position: unknown];
  setStickerKeywords: [sticker: unknown, keywords: unknown];
  setStickerEmojiList: [sticker: unknown, emoji_list: unknown];
  deleteStickerSet: [name: unknown];
  setStickerSetTitle: [name: unknown, title: unknown];
  setCustomEmojiStickerSetThumbnail: [name: unknown, custom_emoji_id: unknown];
  deleteStickerFromSet: [sticker: unknown];
  getCustomEmojiStickers: [custom_emoji_ids: unknown];
  setMyCommands: [commands: unknown, extra?: unknown];
  deleteMyCommands: [extra?: unknown];
  getMyCommands: [extra?: unknown];
  setMyDescription: [description: unknown, language_code: unknown];
  setMyName: [name: unknown, language_code: unknown];
  getMyName: [language_code: unknown];
  getMyDescription: [language_code: unknown];
  setMyShortDescription: [short_description: unknown, language_code: unknown];
  getMyShortDescription: [language_code: unknown];
  setPassportDataErrors: [userId: unknown, errors: unknown];
  sendCopy: [chatId: unknown, message: unknown, extra?: unknown];
  copyMessage: [
    chatId: unknown,
    fromChatId: unknown,
    messageId: unknown,
    extra?: unknown,
  ];
  copyMessages: [
    chatId: unknown,
    fromChatId: unknown,
    messageIds: unknown,
    extra?: unknown,
  ];
  approveChatJoinRequest: [chatId: unknown, userId: unknown];
  declineChatJoinRequest: [chatId: unknown, userId: unknown];
  banChatSenderChat: [chatId: unknown, senderChatId: unknown, extra?: unknown];
  unbanChatSenderChat: [chatId: unknown, senderChatId: unknown];
  setChatMenuButton: [input?: unknown];
  getChatMenuButton: [input?: unknown];
  setMyDefaultAdministratorRights: [input?: unknown];
  getMyDefaultAdministratorRights: [input?: unknown];
  logOut: [];
  close: [];
}
export type TelegrafPositionalArguments<K extends keyof Signatures> = [
  ...Signatures[K],
  request?: RequestOptions | AbortSignal,
];
export type TelegrafPositionalApi = {
  [M in keyof Signatures]: (
    ...args: [...Signatures[M], request?: RequestOptions | AbortSignal]
  ) => Promise<unknown>;
};
