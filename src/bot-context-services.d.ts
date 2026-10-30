import type { Parameters, RequestOptions } from './index.js';
import type {
  GrammyContextOperation as GrammyOperation,
  TelegrafContextOperation as TelegrafOperation,
} from './bot-context-scope.js';
import type { BotApiResult } from './bot-api-types.js';

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
  [K in GrammyScoped]: GrammyOperation<K>;
} & {
  [K in Settings]: GrammyOperation<K, []>;
} & {
  replyWithGift: GrammyOperation<'sendGift'>;
  replyWithGiftToChannel: GrammyOperation<'sendGiftToChannel'>;
  replyWithChatJoinRequestWebApp: GrammyOperation<'sendChatJoinRequestWebApp'>;
  refundStarPayment: GrammyOperation<'refundStarPayment', [unknown, unknown]>;
  readBusinessMessage: GrammyOperation<
    'readBusinessMessage',
    [unknown, unknown, unknown]
  >;
  repostStory: GrammyOperation<'repostStory', [unknown, unknown, unknown]>;
  getUserChatBoosts(
    chatId?: string | number | bigint,
    request?: Request
  ): Promise<BotApiResult<'getUserChatBoosts'>>;
  answerPreCheckoutQuery(
    ok: boolean,
    other?: Parameters | string,
    request?: Request
  ): Promise<true>;
};
export type TelegrafContextServices = {
  [K in TelegrafScoped]: TelegrafOperation<K>;
} & {
  [K in TelegrafDirect]: TelegrafOperation<K, []>;
} & {
  setStickerSetThumb: TelegrafOperation<'setStickerSetThumbnail', []>;
  getUserChatBoosts(
    request?: Request
  ): Promise<BotApiResult<'getUserChatBoosts'>>;
  setChatMenuButton(menuButton: Parameters, request?: Request): Promise<true>;
  getChatMenuButton(
    request?: Request
  ): Promise<BotApiResult<'getChatMenuButton'>>;
};
