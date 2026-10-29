// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { Models0 } from './models0.js';
import type { Models1 } from './models1.js';
import type { Models2 } from './models2.js';
import type { Models3 } from './models3.js';
import type { Models4 } from './models4.js';
import type { Models5 } from './models5.js';
import type { Models6 } from './models6.js';
import type { Models7 } from './models7.js';
export interface BotModels
  extends
    Models0,
    Models1,
    Models2,
    Models3,
    Models4,
    Models5,
    Models6,
    Models7 {}
export interface RichTextArray extends Array<RichText> {}
export type Update = BotModels['Update'];
export type WebhookInfo = BotModels['WebhookInfo'];
export type User = BotModels['User'];
export type Chat = BotModels['Chat'];
export type ChatFullInfo = BotModels['ChatFullInfo'];
export type Message = BotModels['Message'];
export type MessageId = BotModels['MessageId'];
export type InaccessibleMessage = BotModels['InaccessibleMessage'];
export type MaybeInaccessibleMessage = BotModels['MaybeInaccessibleMessage'];
export type MessageEntity = BotModels['MessageEntity'];
export type TextQuote = BotModels['TextQuote'];
export type ExternalReplyInfo = BotModels['ExternalReplyInfo'];
export type ReplyParameters = BotModels['ReplyParameters'];
export type EphemeralMessageParameters =
  BotModels['EphemeralMessageParameters'];
export type MessageOrigin = BotModels['MessageOrigin'];
export type MessageOriginUser = BotModels['MessageOriginUser'];
export type MessageOriginHiddenUser = BotModels['MessageOriginHiddenUser'];
export type MessageOriginChat = BotModels['MessageOriginChat'];
export type MessageOriginChannel = BotModels['MessageOriginChannel'];
export type PhotoSize = BotModels['PhotoSize'];
export type Animation = BotModels['Animation'];
export type Audio = BotModels['Audio'];
export type Document = BotModels['Document'];
export type LivePhoto = BotModels['LivePhoto'];
export type Story = BotModels['Story'];
export type VideoQuality = BotModels['VideoQuality'];
export type Video = BotModels['Video'];
export type VideoNote = BotModels['VideoNote'];
export type Voice = BotModels['Voice'];
export type PaidMediaInfo = BotModels['PaidMediaInfo'];
export type PaidMedia = BotModels['PaidMedia'];
export type PaidMediaLivePhoto = BotModels['PaidMediaLivePhoto'];
export type PaidMediaPhoto = BotModels['PaidMediaPhoto'];
export type PaidMediaPreview = BotModels['PaidMediaPreview'];
export type PaidMediaVideo = BotModels['PaidMediaVideo'];
export type Contact = BotModels['Contact'];
export type Dice = BotModels['Dice'];
export type Link = BotModels['Link'];
export type PollMedia = BotModels['PollMedia'];
export type InputPollMedia = BotModels['InputPollMedia'];
export type InputPollOptionMedia = BotModels['InputPollOptionMedia'];
export type PollOption = BotModels['PollOption'];
export type InputPollOption = BotModels['InputPollOption'];
export type PollAnswer = BotModels['PollAnswer'];
export type Poll = BotModels['Poll'];
export type ChecklistTask = BotModels['ChecklistTask'];
export type Checklist = BotModels['Checklist'];
export type InputChecklistTask = BotModels['InputChecklistTask'];
export type InputChecklist = BotModels['InputChecklist'];
export type Location = BotModels['Location'];
export type Venue = BotModels['Venue'];
export type WebAppData = BotModels['WebAppData'];
export type ProximityAlertTriggered = BotModels['ProximityAlertTriggered'];
export type MessageAutoDeleteTimerChanged =
  BotModels['MessageAutoDeleteTimerChanged'];
export type ManagedBotCreated = BotModels['ManagedBotCreated'];
export type ManagedBotUpdated = BotModels['ManagedBotUpdated'];
export type BotSubscriptionUpdated = BotModels['BotSubscriptionUpdated'];
export type MessageGenerationStopped = BotModels['MessageGenerationStopped'];
export type PollOptionAdded = BotModels['PollOptionAdded'];
export type PollOptionDeleted = BotModels['PollOptionDeleted'];
export type ChatBoostAdded = BotModels['ChatBoostAdded'];
export type BackgroundFill = BotModels['BackgroundFill'];
export type BackgroundFillSolid = BotModels['BackgroundFillSolid'];
export type BackgroundFillGradient = BotModels['BackgroundFillGradient'];
export type BackgroundFillFreeformGradient =
  BotModels['BackgroundFillFreeformGradient'];
export type BackgroundType = BotModels['BackgroundType'];
export type BackgroundTypeFill = BotModels['BackgroundTypeFill'];
export type BackgroundTypeWallpaper = BotModels['BackgroundTypeWallpaper'];
export type BackgroundTypePattern = BotModels['BackgroundTypePattern'];
export type BackgroundTypeChatTheme = BotModels['BackgroundTypeChatTheme'];
export type ChatBackground = BotModels['ChatBackground'];
export type ChecklistTasksDone = BotModels['ChecklistTasksDone'];
export type ChecklistTasksAdded = BotModels['ChecklistTasksAdded'];
export type CommunityChatAdded = BotModels['CommunityChatAdded'];
export type CommunityChatJoined = BotModels['CommunityChatJoined'];
export type CommunityChatRemoved = BotModels['CommunityChatRemoved'];
export type ForumTopicCreated = BotModels['ForumTopicCreated'];
export type ForumTopicClosed = BotModels['ForumTopicClosed'];
export type ForumTopicEdited = BotModels['ForumTopicEdited'];
export type ForumTopicReopened = BotModels['ForumTopicReopened'];
export type GeneralForumTopicHidden = BotModels['GeneralForumTopicHidden'];
export type GeneralForumTopicUnhidden = BotModels['GeneralForumTopicUnhidden'];
export type SharedUser = BotModels['SharedUser'];
export type UsersShared = BotModels['UsersShared'];
export type ChatShared = BotModels['ChatShared'];
export type WriteAccessAllowed = BotModels['WriteAccessAllowed'];
export type VideoChatScheduled = BotModels['VideoChatScheduled'];
export type VideoChatStarted = BotModels['VideoChatStarted'];
export type VideoChatEnded = BotModels['VideoChatEnded'];
export type VideoChatParticipantsInvited =
  BotModels['VideoChatParticipantsInvited'];
export type PaidMessagePriceChanged = BotModels['PaidMessagePriceChanged'];
export type DirectMessagePriceChanged = BotModels['DirectMessagePriceChanged'];
export type SuggestedPostApproved = BotModels['SuggestedPostApproved'];
export type SuggestedPostApprovalFailed =
  BotModels['SuggestedPostApprovalFailed'];
export type SuggestedPostDeclined = BotModels['SuggestedPostDeclined'];
export type SuggestedPostPaid = BotModels['SuggestedPostPaid'];
export type SuggestedPostRefunded = BotModels['SuggestedPostRefunded'];
export type GiveawayCreated = BotModels['GiveawayCreated'];
export type Giveaway = BotModels['Giveaway'];
export type GiveawayWinners = BotModels['GiveawayWinners'];
export type GiveawayCompleted = BotModels['GiveawayCompleted'];
export type LinkPreviewOptions = BotModels['LinkPreviewOptions'];
export type SuggestedPostPrice = BotModels['SuggestedPostPrice'];
export type SuggestedPostInfo = BotModels['SuggestedPostInfo'];
export type SuggestedPostParameters = BotModels['SuggestedPostParameters'];
export type DirectMessagesTopic = BotModels['DirectMessagesTopic'];
export type UserProfilePhotos = BotModels['UserProfilePhotos'];
export type UserProfileAudios = BotModels['UserProfileAudios'];
export type File = BotModels['File'];
export type WebAppInfo = BotModels['WebAppInfo'];
export type ReplyKeyboardMarkup = BotModels['ReplyKeyboardMarkup'];
export type KeyboardButton = BotModels['KeyboardButton'];
export type KeyboardButtonRequestUsers =
  BotModels['KeyboardButtonRequestUsers'];
export type KeyboardButtonRequestChat = BotModels['KeyboardButtonRequestChat'];
export type KeyboardButtonRequestManagedBot =
  BotModels['KeyboardButtonRequestManagedBot'];
export type KeyboardButtonPollType = BotModels['KeyboardButtonPollType'];
export type ReplyKeyboardRemove = BotModels['ReplyKeyboardRemove'];
export type InlineKeyboardMarkup = BotModels['InlineKeyboardMarkup'];
export type InlineKeyboardButton = BotModels['InlineKeyboardButton'];
export type LoginUrl = BotModels['LoginUrl'];
export type SwitchInlineQueryChosenChat =
  BotModels['SwitchInlineQueryChosenChat'];
export type CopyTextButton = BotModels['CopyTextButton'];
export type DisabledButton = BotModels['DisabledButton'];
export type CallbackQuery = BotModels['CallbackQuery'];
export type ForceReply = BotModels['ForceReply'];
export type Community = BotModels['Community'];
export type ChatPhoto = BotModels['ChatPhoto'];
export type ChatInviteLink = BotModels['ChatInviteLink'];
export type ChatAdministratorRights = BotModels['ChatAdministratorRights'];
export type ChatMemberUpdated = BotModels['ChatMemberUpdated'];
export type ChatMember = BotModels['ChatMember'];
export type ChatMemberOwner = BotModels['ChatMemberOwner'];
export type ChatMemberAdministrator = BotModels['ChatMemberAdministrator'];
export type ChatMemberMember = BotModels['ChatMemberMember'];
export type ChatMemberRestricted = BotModels['ChatMemberRestricted'];
export type ChatMemberLeft = BotModels['ChatMemberLeft'];
export type ChatMemberBanned = BotModels['ChatMemberBanned'];
export type ChatJoinRequest = BotModels['ChatJoinRequest'];
export type ChatPermissions = BotModels['ChatPermissions'];
export type Birthdate = BotModels['Birthdate'];
export type BusinessIntro = BotModels['BusinessIntro'];
export type BusinessLocation = BotModels['BusinessLocation'];
export type BusinessOpeningHoursInterval =
  BotModels['BusinessOpeningHoursInterval'];
export type BusinessOpeningHours = BotModels['BusinessOpeningHours'];
export type UserRating = BotModels['UserRating'];
export type StoryAreaPosition = BotModels['StoryAreaPosition'];
export type LocationAddress = BotModels['LocationAddress'];
export type StoryAreaType = BotModels['StoryAreaType'];
export type StoryAreaTypeLocation = BotModels['StoryAreaTypeLocation'];
export type StoryAreaTypeSuggestedReaction =
  BotModels['StoryAreaTypeSuggestedReaction'];
export type StoryAreaTypeLink = BotModels['StoryAreaTypeLink'];
export type StoryAreaTypeWeather = BotModels['StoryAreaTypeWeather'];
export type StoryAreaTypeUniqueGift = BotModels['StoryAreaTypeUniqueGift'];
export type StoryArea = BotModels['StoryArea'];
export type ChatLocation = BotModels['ChatLocation'];
export type ReactionType = BotModels['ReactionType'];
export type ReactionTypeEmoji = BotModels['ReactionTypeEmoji'];
export type ReactionTypeCustomEmoji = BotModels['ReactionTypeCustomEmoji'];
export type ReactionTypePaid = BotModels['ReactionTypePaid'];
export type ReactionCount = BotModels['ReactionCount'];
export type MessageReactionUpdated = BotModels['MessageReactionUpdated'];
export type MessageReactionCountUpdated =
  BotModels['MessageReactionCountUpdated'];
export type ForumTopic = BotModels['ForumTopic'];
export type GiftBackground = BotModels['GiftBackground'];
export type Gift = BotModels['Gift'];
export type Gifts = BotModels['Gifts'];
export type UniqueGiftModel = BotModels['UniqueGiftModel'];
export type UniqueGiftSymbol = BotModels['UniqueGiftSymbol'];
export type UniqueGiftBackdropColors = BotModels['UniqueGiftBackdropColors'];
export type UniqueGiftBackdrop = BotModels['UniqueGiftBackdrop'];
export type UniqueGiftColors = BotModels['UniqueGiftColors'];
export type UniqueGift = BotModels['UniqueGift'];
export type GiftInfo = BotModels['GiftInfo'];
export type UniqueGiftInfo = BotModels['UniqueGiftInfo'];
export type OwnedGift = BotModels['OwnedGift'];
export type OwnedGiftRegular = BotModels['OwnedGiftRegular'];
export type OwnedGiftUnique = BotModels['OwnedGiftUnique'];
export type OwnedGifts = BotModels['OwnedGifts'];
export type BotAccessSettings = BotModels['BotAccessSettings'];
export type AcceptedGiftTypes = BotModels['AcceptedGiftTypes'];
export type StarAmount = BotModels['StarAmount'];
export type BotCommand = BotModels['BotCommand'];
export type BotCommandScope = BotModels['BotCommandScope'];
export type BotCommandScopeDefault = BotModels['BotCommandScopeDefault'];
export type BotCommandScopeAllPrivateChats =
  BotModels['BotCommandScopeAllPrivateChats'];
export type BotCommandScopeAllGroupChats =
  BotModels['BotCommandScopeAllGroupChats'];
export type BotCommandScopeAllChatAdministrators =
  BotModels['BotCommandScopeAllChatAdministrators'];
export type BotCommandScopeChat = BotModels['BotCommandScopeChat'];
export type BotCommandScopeChatAdministrators =
  BotModels['BotCommandScopeChatAdministrators'];
export type BotCommandScopeChatMember = BotModels['BotCommandScopeChatMember'];
export type BotName = BotModels['BotName'];
export type BotDescription = BotModels['BotDescription'];
export type BotShortDescription = BotModels['BotShortDescription'];
export type MenuButton = BotModels['MenuButton'];
export type MenuButtonCommands = BotModels['MenuButtonCommands'];
export type MenuButtonWebApp = BotModels['MenuButtonWebApp'];
export type MenuButtonDefault = BotModels['MenuButtonDefault'];
export type ChatBoostSource = BotModels['ChatBoostSource'];
export type ChatBoostSourcePremium = BotModels['ChatBoostSourcePremium'];
export type ChatBoostSourceGiftCode = BotModels['ChatBoostSourceGiftCode'];
export type ChatBoostSourceGiveaway = BotModels['ChatBoostSourceGiveaway'];
export type ChatBoost = BotModels['ChatBoost'];
export type ChatBoostUpdated = BotModels['ChatBoostUpdated'];
export type ChatBoostRemoved = BotModels['ChatBoostRemoved'];
export type ChatOwnerLeft = BotModels['ChatOwnerLeft'];
export type ChatOwnerChanged = BotModels['ChatOwnerChanged'];
export type UserChatBoosts = BotModels['UserChatBoosts'];
export type BusinessBotRights = BotModels['BusinessBotRights'];
export type BusinessConnection = BotModels['BusinessConnection'];
export type BusinessMessagesDeleted = BotModels['BusinessMessagesDeleted'];
export type SentWebAppMessage = BotModels['SentWebAppMessage'];
export type SentGuestMessage = BotModels['SentGuestMessage'];
export type PreparedInlineMessage = BotModels['PreparedInlineMessage'];
export type PreparedKeyboardButton = BotModels['PreparedKeyboardButton'];
export type ResponseParameters = BotModels['ResponseParameters'];
export type InputMedia = BotModels['InputMedia'];
export type InputMediaAnimation = BotModels['InputMediaAnimation'];
export type InputMediaAudio = BotModels['InputMediaAudio'];
export type InputMediaDocument = BotModels['InputMediaDocument'];
export type InputMediaLink = BotModels['InputMediaLink'];
export type InputMediaLivePhoto = BotModels['InputMediaLivePhoto'];
export type InputMediaLocation = BotModels['InputMediaLocation'];
export type InputMediaPhoto = BotModels['InputMediaPhoto'];
export type InputMediaSticker = BotModels['InputMediaSticker'];
export type InputMediaVenue = BotModels['InputMediaVenue'];
export type InputMediaVideo = BotModels['InputMediaVideo'];
export type InputMediaVoiceNote = BotModels['InputMediaVoiceNote'];
export type InputFile = BotModels['InputFile'];
export type InputPaidMedia = BotModels['InputPaidMedia'];
export type InputPaidMediaLivePhoto = BotModels['InputPaidMediaLivePhoto'];
export type InputPaidMediaPhoto = BotModels['InputPaidMediaPhoto'];
export type InputPaidMediaVideo = BotModels['InputPaidMediaVideo'];
export type InputProfilePhoto = BotModels['InputProfilePhoto'];
export type InputProfilePhotoStatic = BotModels['InputProfilePhotoStatic'];
export type InputProfilePhotoAnimated = BotModels['InputProfilePhotoAnimated'];
export type InputStoryContent = BotModels['InputStoryContent'];
export type InputStoryContentPhoto = BotModels['InputStoryContentPhoto'];
export type InputStoryContentVideo = BotModels['InputStoryContentVideo'];
export type Sticker = BotModels['Sticker'];
export type StickerSet = BotModels['StickerSet'];
export type MaskPosition = BotModels['MaskPosition'];
export type InputSticker = BotModels['InputSticker'];
export type RichMessage = BotModels['RichMessage'];
export type InputRichMessage = BotModels['InputRichMessage'];
export type InputRichMessageMedia = BotModels['InputRichMessageMedia'];
export type RichMessageButton = BotModels['RichMessageButton'];
export type RichText = BotModels['RichText'];
export type RichTextBold = BotModels['RichTextBold'];
export type RichTextItalic = BotModels['RichTextItalic'];
export type RichTextUnderline = BotModels['RichTextUnderline'];
export type RichTextStrikethrough = BotModels['RichTextStrikethrough'];
export type RichTextSpoiler = BotModels['RichTextSpoiler'];
export type RichTextDateTime = BotModels['RichTextDateTime'];
export type RichTextTextMention = BotModels['RichTextTextMention'];
export type RichTextSubscript = BotModels['RichTextSubscript'];
export type RichTextSuperscript = BotModels['RichTextSuperscript'];
export type RichTextMarked = BotModels['RichTextMarked'];
export type RichTextCode = BotModels['RichTextCode'];
export type RichTextCustomEmoji = BotModels['RichTextCustomEmoji'];
export type RichTextMathematicalExpression =
  BotModels['RichTextMathematicalExpression'];
export type RichTextUrl = BotModels['RichTextUrl'];
export type RichTextEmailAddress = BotModels['RichTextEmailAddress'];
export type RichTextPhoneNumber = BotModels['RichTextPhoneNumber'];
export type RichTextBankCardNumber = BotModels['RichTextBankCardNumber'];
export type RichTextMention = BotModels['RichTextMention'];
export type RichTextHashtag = BotModels['RichTextHashtag'];
export type RichTextCashtag = BotModels['RichTextCashtag'];
export type RichTextBotCommand = BotModels['RichTextBotCommand'];
export type RichTextButton = BotModels['RichTextButton'];
export type RichTextAnchor = BotModels['RichTextAnchor'];
export type RichTextAnchorLink = BotModels['RichTextAnchorLink'];
export type RichTextReference = BotModels['RichTextReference'];
export type RichTextReferenceLink = BotModels['RichTextReferenceLink'];
export type RichBlockCaption = BotModels['RichBlockCaption'];
export type RichBlockTableCell = BotModels['RichBlockTableCell'];
export type RichBlockListItem = BotModels['RichBlockListItem'];
export type RichBlock = BotModels['RichBlock'];
export type RichBlockParagraph = BotModels['RichBlockParagraph'];
export type RichBlockSectionHeading = BotModels['RichBlockSectionHeading'];
export type RichBlockPreformatted = BotModels['RichBlockPreformatted'];
export type RichBlockFooter = BotModels['RichBlockFooter'];
export type RichBlockDivider = BotModels['RichBlockDivider'];
export type RichBlockMathematicalExpression =
  BotModels['RichBlockMathematicalExpression'];
export type RichBlockAnchor = BotModels['RichBlockAnchor'];
export type RichBlockList = BotModels['RichBlockList'];
export type RichBlockBlockQuotation = BotModels['RichBlockBlockQuotation'];
export type RichBlockExpandableBlockQuotation =
  BotModels['RichBlockExpandableBlockQuotation'];
export type RichBlockPullQuotation = BotModels['RichBlockPullQuotation'];
export type RichBlockCollage = BotModels['RichBlockCollage'];
export type RichBlockSlideshow = BotModels['RichBlockSlideshow'];
export type RichBlockTable = BotModels['RichBlockTable'];
export type RichBlockDetails = BotModels['RichBlockDetails'];
export type RichBlockMap = BotModels['RichBlockMap'];
export type RichBlockButtons = BotModels['RichBlockButtons'];
export type RichBlockAnimation = BotModels['RichBlockAnimation'];
export type RichBlockAudio = BotModels['RichBlockAudio'];
export type RichBlockDocument = BotModels['RichBlockDocument'];
export type RichBlockPhoto = BotModels['RichBlockPhoto'];
export type RichBlockVideo = BotModels['RichBlockVideo'];
export type RichBlockVoiceNote = BotModels['RichBlockVoiceNote'];
export type RichBlockThinking = BotModels['RichBlockThinking'];
export type InputRichBlockListItem = BotModels['InputRichBlockListItem'];
export type InputRichBlock = BotModels['InputRichBlock'];
export type InputRichBlockParagraph = BotModels['InputRichBlockParagraph'];
export type InputRichBlockSectionHeading =
  BotModels['InputRichBlockSectionHeading'];
export type InputRichBlockPreformatted =
  BotModels['InputRichBlockPreformatted'];
export type InputRichBlockFooter = BotModels['InputRichBlockFooter'];
export type InputRichBlockDivider = BotModels['InputRichBlockDivider'];
export type InputRichBlockMathematicalExpression =
  BotModels['InputRichBlockMathematicalExpression'];
export type InputRichBlockAnchor = BotModels['InputRichBlockAnchor'];
export type InputRichBlockList = BotModels['InputRichBlockList'];
export type InputRichBlockBlockQuotation =
  BotModels['InputRichBlockBlockQuotation'];
export type InputRichBlockExpandableBlockQuotation =
  BotModels['InputRichBlockExpandableBlockQuotation'];
export type InputRichBlockPullQuotation =
  BotModels['InputRichBlockPullQuotation'];
export type InputRichBlockCollage = BotModels['InputRichBlockCollage'];
export type InputRichBlockSlideshow = BotModels['InputRichBlockSlideshow'];
export type InputRichBlockTable = BotModels['InputRichBlockTable'];
export type InputRichBlockDetails = BotModels['InputRichBlockDetails'];
export type InputRichBlockMap = BotModels['InputRichBlockMap'];
export type InputRichBlockButtons = BotModels['InputRichBlockButtons'];
export type InputRichBlockAnimation = BotModels['InputRichBlockAnimation'];
export type InputRichBlockAudio = BotModels['InputRichBlockAudio'];
export type InputRichBlockDocument = BotModels['InputRichBlockDocument'];
export type InputRichBlockPhoto = BotModels['InputRichBlockPhoto'];
export type InputRichBlockVideo = BotModels['InputRichBlockVideo'];
export type InputRichBlockVoiceNote = BotModels['InputRichBlockVoiceNote'];
export type InputRichBlockThinking = BotModels['InputRichBlockThinking'];
export type InlineQuery = BotModels['InlineQuery'];
export type InlineQueryResultsButton = BotModels['InlineQueryResultsButton'];
export type InlineQueryResult = BotModels['InlineQueryResult'];
export type InlineQueryResultArticle = BotModels['InlineQueryResultArticle'];
export type InlineQueryResultPhoto = BotModels['InlineQueryResultPhoto'];
export type InlineQueryResultGif = BotModels['InlineQueryResultGif'];
export type InlineQueryResultMpeg4Gif = BotModels['InlineQueryResultMpeg4Gif'];
export type InlineQueryResultVideo = BotModels['InlineQueryResultVideo'];
export type InlineQueryResultAudio = BotModels['InlineQueryResultAudio'];
export type InlineQueryResultVoice = BotModels['InlineQueryResultVoice'];
export type InlineQueryResultDocument = BotModels['InlineQueryResultDocument'];
export type InlineQueryResultLocation = BotModels['InlineQueryResultLocation'];
export type InlineQueryResultVenue = BotModels['InlineQueryResultVenue'];
export type InlineQueryResultContact = BotModels['InlineQueryResultContact'];
export type InlineQueryResultGame = BotModels['InlineQueryResultGame'];
export type InlineQueryResultCachedPhoto =
  BotModels['InlineQueryResultCachedPhoto'];
export type InlineQueryResultCachedGif =
  BotModels['InlineQueryResultCachedGif'];
export type InlineQueryResultCachedMpeg4Gif =
  BotModels['InlineQueryResultCachedMpeg4Gif'];
export type InlineQueryResultCachedSticker =
  BotModels['InlineQueryResultCachedSticker'];
export type InlineQueryResultCachedDocument =
  BotModels['InlineQueryResultCachedDocument'];
export type InlineQueryResultCachedVideo =
  BotModels['InlineQueryResultCachedVideo'];
export type InlineQueryResultCachedVoice =
  BotModels['InlineQueryResultCachedVoice'];
export type InlineQueryResultCachedAudio =
  BotModels['InlineQueryResultCachedAudio'];
export type InputMessageContent = BotModels['InputMessageContent'];
export type InputTextMessageContent = BotModels['InputTextMessageContent'];
export type InputRichMessageContent = BotModels['InputRichMessageContent'];
export type InputLocationMessageContent =
  BotModels['InputLocationMessageContent'];
export type InputVenueMessageContent = BotModels['InputVenueMessageContent'];
export type InputContactMessageContent =
  BotModels['InputContactMessageContent'];
export type InputInvoiceMessageContent =
  BotModels['InputInvoiceMessageContent'];
export type ChosenInlineResult = BotModels['ChosenInlineResult'];
export type LabeledPrice = BotModels['LabeledPrice'];
export type Invoice = BotModels['Invoice'];
export type ShippingAddress = BotModels['ShippingAddress'];
export type OrderInfo = BotModels['OrderInfo'];
export type ShippingOption = BotModels['ShippingOption'];
export type SuccessfulPayment = BotModels['SuccessfulPayment'];
export type RefundedPayment = BotModels['RefundedPayment'];
export type ShippingQuery = BotModels['ShippingQuery'];
export type PreCheckoutQuery = BotModels['PreCheckoutQuery'];
export type PaidMediaPurchased = BotModels['PaidMediaPurchased'];
export type RevenueWithdrawalState = BotModels['RevenueWithdrawalState'];
export type RevenueWithdrawalStatePending =
  BotModels['RevenueWithdrawalStatePending'];
export type RevenueWithdrawalStateSucceeded =
  BotModels['RevenueWithdrawalStateSucceeded'];
export type RevenueWithdrawalStateFailed =
  BotModels['RevenueWithdrawalStateFailed'];
export type AffiliateInfo = BotModels['AffiliateInfo'];
export type TransactionPartner = BotModels['TransactionPartner'];
export type TransactionPartnerUser = BotModels['TransactionPartnerUser'];
export type TransactionPartnerChat = BotModels['TransactionPartnerChat'];
export type TransactionPartnerAffiliateProgram =
  BotModels['TransactionPartnerAffiliateProgram'];
export type TransactionPartnerFragment =
  BotModels['TransactionPartnerFragment'];
export type TransactionPartnerTelegramAds =
  BotModels['TransactionPartnerTelegramAds'];
export type TransactionPartnerTelegramApi =
  BotModels['TransactionPartnerTelegramApi'];
export type TransactionPartnerOther = BotModels['TransactionPartnerOther'];
export type StarTransaction = BotModels['StarTransaction'];
export type StarTransactions = BotModels['StarTransactions'];
export type PassportData = BotModels['PassportData'];
export type PassportFile = BotModels['PassportFile'];
export type EncryptedPassportElement = BotModels['EncryptedPassportElement'];
export type EncryptedCredentials = BotModels['EncryptedCredentials'];
export type PassportElementError = BotModels['PassportElementError'];
export type PassportElementErrorDataField =
  BotModels['PassportElementErrorDataField'];
export type PassportElementErrorFrontSide =
  BotModels['PassportElementErrorFrontSide'];
export type PassportElementErrorReverseSide =
  BotModels['PassportElementErrorReverseSide'];
export type PassportElementErrorSelfie =
  BotModels['PassportElementErrorSelfie'];
export type PassportElementErrorFile = BotModels['PassportElementErrorFile'];
export type PassportElementErrorFiles = BotModels['PassportElementErrorFiles'];
export type PassportElementErrorTranslationFile =
  BotModels['PassportElementErrorTranslationFile'];
export type PassportElementErrorTranslationFiles =
  BotModels['PassportElementErrorTranslationFiles'];
export type PassportElementErrorUnspecified =
  BotModels['PassportElementErrorUnspecified'];
export type Game = BotModels['Game'];
export type CallbackGame = BotModels['CallbackGame'];
export type GameHighScore = BotModels['GameHighScore'];
