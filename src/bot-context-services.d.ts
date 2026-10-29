import type { Parameters, RequestOptions } from './index.js';
import type { GrammyPositionalArguments as GrammyArgs } from './bot-positional.js';
import type { TelegrafPositionalArguments as TelegrafArgs } from './telegraf-positional.js';
import type { ContextOperation as Operation } from './bot-context-scope.js';

type Settings =
  | 'setChatMenuButton'
  | 'getChatMenuButton'
  | 'setMyDefaultAdministratorRights'
  | 'getMyDefaultAdministratorRights';
type GrammyScoped =
  | 'getUserProfilePhotos'
  | 'getUserProfileAudios'
  | 'setUserEmojiStatus'
  | 'getUserGifts'
  | 'getUserPersonalChatMessages'
  | 'giftPremiumSubscription'
  | 'savePreparedInlineMessage'
  | 'savePreparedKeyboardButton'
  | 'editUserStarSubscription'
  | 'verifyUser'
  | 'removeUserVerification'
  | 'setPassportDataErrors'
  | 'getBusinessConnection'
  | 'setBusinessAccountName'
  | 'setBusinessAccountUsername'
  | 'setBusinessAccountBio'
  | 'setBusinessAccountProfilePhoto'
  | 'removeBusinessAccountProfilePhoto'
  | 'setBusinessAccountGiftSettings'
  | 'getBusinessAccountStarBalance'
  | 'transferBusinessAccountStars'
  | 'getBusinessAccountGifts'
  | 'convertGiftToStars'
  | 'upgradeGift'
  | 'transferGift'
  | 'postStory'
  | 'editStory'
  | 'deleteStory'
  | 'getManagedBotToken'
  | 'replaceManagedBotToken'
  | 'getManagedBotAccessSettings'
  | 'setManagedBotAccessSettings'
  | 'answerInlineQuery'
  | 'answerShippingQuery'
  | 'answerChatJoinRequestQuery'
  | 'answerGuestQuery'
  | 'getFile'
  | 'getCustomEmojiStickers';
type TelegrafScoped =
  | 'setPassportDataErrors'
  | 'uploadStickerFile'
  | 'createNewStickerSet'
  | 'addStickerToSet'
  | 'answerInlineQuery'
  | 'answerCbQuery'
  | 'answerGameQuery'
  | 'answerShippingQuery'
  | 'answerPreCheckoutQuery';
type TelegrafDirect =
  | 'setMyDefaultAdministratorRights'
  | 'getMyDefaultAdministratorRights'
  | 'getStickerSet'
  | 'setStickerPositionInSet'
  | 'setStickerSetThumbnail'
  | 'setStickerMaskPosition'
  | 'setStickerKeywords'
  | 'setStickerEmojiList'
  | 'deleteStickerSet'
  | 'setStickerSetTitle'
  | 'setCustomEmojiStickerSetThumbnail'
  | 'deleteStickerFromSet'
  | 'getMyCommands'
  | 'setMyCommands';
type Request = RequestOptions | AbortSignal;
export type GrammyContextServices = {
  [K in GrammyScoped]: Operation<GrammyArgs<K>>;
} & {
  [K in Settings]: Operation<GrammyArgs<K>, []>;
} & {
  replyWithGift: Operation<GrammyArgs<'sendGift'>>;
  replyWithGiftToChannel: Operation<GrammyArgs<'sendGiftToChannel'>>;
  replyWithChatJoinRequestWebApp: Operation<
    GrammyArgs<'sendChatJoinRequestWebApp'>
  >;
  refundStarPayment: Operation<
    GrammyArgs<'refundStarPayment'>,
    [unknown, unknown]
  >;
  readBusinessMessage: Operation<
    GrammyArgs<'readBusinessMessage'>,
    [unknown, unknown, unknown]
  >;
  repostStory: Operation<
    GrammyArgs<'repostStory'>,
    [unknown, unknown, unknown]
  >;
  getUserChatBoosts(
    chatId?: string | number | bigint,
    request?: Request
  ): Promise<unknown>;
  answerPreCheckoutQuery(
    ok: boolean,
    other?: Parameters | string,
    request?: Request
  ): Promise<unknown>;
};
export type TelegrafContextServices = {
  [K in TelegrafScoped]: Operation<TelegrafArgs<K>>;
} & {
  [K in TelegrafDirect]: Operation<TelegrafArgs<K>, []>;
} & {
  setStickerSetThumb: Operation<TelegrafArgs<'setStickerSetThumbnail'>, []>;
  getUserChatBoosts(request?: Request): Promise<unknown>;
  setChatMenuButton(
    menuButton: Parameters,
    request?: Request
  ): Promise<unknown>;
  getChatMenuButton(request?: Request): Promise<unknown>;
};
