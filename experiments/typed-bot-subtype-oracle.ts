// Actual SDK field-presence comparisons; regenerate with generate-bot-subtype-oracle.mjs.
import type * as Original from '@grammyjs/types';
import type { Telegram } from '../src/index.js';
type Assert<T extends true> = T;
type Equal<A, B> = [A, B] extends [B, A] ? true : false;
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];
export interface MessageSubtypeOracle {
  ServiceMessage: Assert<
    Equal<
      keyof Telegram.Message.ServiceMessage,
      keyof Original.Message.ServiceMessage
    >
  >;
  ServiceMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ServiceMessage>,
      RequiredKeys<Original.Message.ServiceMessage>
    >
  >;
  CommonMessage: Assert<
    Equal<
      keyof Telegram.Message.CommonMessage,
      keyof Original.Message.CommonMessage
    >
  >;
  CommonMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.CommonMessage>,
      RequiredKeys<Original.Message.CommonMessage>
    >
  >;
  CaptionableMessage: Assert<
    Equal<
      keyof Telegram.Message.CaptionableMessage,
      keyof Original.Message.CaptionableMessage
    >
  >;
  CaptionableMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.CaptionableMessage>,
      RequiredKeys<Original.Message.CaptionableMessage>
    >
  >;
  MediaMessage: Assert<
    Equal<
      keyof Telegram.Message.MediaMessage,
      keyof Original.Message.MediaMessage
    >
  >;
  MediaMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.MediaMessage>,
      RequiredKeys<Original.Message.MediaMessage>
    >
  >;
  TextMessage: Assert<
    Equal<
      keyof Telegram.Message.TextMessage,
      keyof Original.Message.TextMessage
    >
  >;
  TextMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.TextMessage>,
      RequiredKeys<Original.Message.TextMessage>
    >
  >;
  RichMessageMessage: Assert<
    Equal<
      keyof Telegram.Message.RichMessageMessage,
      keyof Original.Message.RichMessageMessage
    >
  >;
  RichMessageMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.RichMessageMessage>,
      RequiredKeys<Original.Message.RichMessageMessage>
    >
  >;
  AnimationMessage: Assert<
    Equal<
      keyof Telegram.Message.AnimationMessage,
      keyof Original.Message.AnimationMessage
    >
  >;
  AnimationMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.AnimationMessage>,
      RequiredKeys<Original.Message.AnimationMessage>
    >
  >;
  AudioMessage: Assert<
    Equal<
      keyof Telegram.Message.AudioMessage,
      keyof Original.Message.AudioMessage
    >
  >;
  AudioMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.AudioMessage>,
      RequiredKeys<Original.Message.AudioMessage>
    >
  >;
  DocumentMessage: Assert<
    Equal<
      keyof Telegram.Message.DocumentMessage,
      keyof Original.Message.DocumentMessage
    >
  >;
  DocumentMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.DocumentMessage>,
      RequiredKeys<Original.Message.DocumentMessage>
    >
  >;
  LivePhotoMessage: Assert<
    Equal<
      keyof Telegram.Message.LivePhotoMessage,
      keyof Original.Message.LivePhotoMessage
    >
  >;
  LivePhotoMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.LivePhotoMessage>,
      RequiredKeys<Original.Message.LivePhotoMessage>
    >
  >;
  PaidMediaMessage: Assert<
    Equal<
      keyof Telegram.Message.PaidMediaMessage,
      keyof Original.Message.PaidMediaMessage
    >
  >;
  PaidMediaMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PaidMediaMessage>,
      RequiredKeys<Original.Message.PaidMediaMessage>
    >
  >;
  PhotoMessage: Assert<
    Equal<
      keyof Telegram.Message.PhotoMessage,
      keyof Original.Message.PhotoMessage
    >
  >;
  PhotoMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PhotoMessage>,
      RequiredKeys<Original.Message.PhotoMessage>
    >
  >;
  StickerMessage: Assert<
    Equal<
      keyof Telegram.Message.StickerMessage,
      keyof Original.Message.StickerMessage
    >
  >;
  StickerMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.StickerMessage>,
      RequiredKeys<Original.Message.StickerMessage>
    >
  >;
  StoryMessage: Assert<
    Equal<
      keyof Telegram.Message.StoryMessage,
      keyof Original.Message.StoryMessage
    >
  >;
  StoryMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.StoryMessage>,
      RequiredKeys<Original.Message.StoryMessage>
    >
  >;
  VideoMessage: Assert<
    Equal<
      keyof Telegram.Message.VideoMessage,
      keyof Original.Message.VideoMessage
    >
  >;
  VideoMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VideoMessage>,
      RequiredKeys<Original.Message.VideoMessage>
    >
  >;
  VideoNoteMessage: Assert<
    Equal<
      keyof Telegram.Message.VideoNoteMessage,
      keyof Original.Message.VideoNoteMessage
    >
  >;
  VideoNoteMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VideoNoteMessage>,
      RequiredKeys<Original.Message.VideoNoteMessage>
    >
  >;
  VoiceMessage: Assert<
    Equal<
      keyof Telegram.Message.VoiceMessage,
      keyof Original.Message.VoiceMessage
    >
  >;
  VoiceMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VoiceMessage>,
      RequiredKeys<Original.Message.VoiceMessage>
    >
  >;
  ContactMessage: Assert<
    Equal<
      keyof Telegram.Message.ContactMessage,
      keyof Original.Message.ContactMessage
    >
  >;
  ContactMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ContactMessage>,
      RequiredKeys<Original.Message.ContactMessage>
    >
  >;
  DiceMessage: Assert<
    Equal<
      keyof Telegram.Message.DiceMessage,
      keyof Original.Message.DiceMessage
    >
  >;
  DiceMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.DiceMessage>,
      RequiredKeys<Original.Message.DiceMessage>
    >
  >;
  GameMessage: Assert<
    Equal<
      keyof Telegram.Message.GameMessage,
      keyof Original.Message.GameMessage
    >
  >;
  GameMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GameMessage>,
      RequiredKeys<Original.Message.GameMessage>
    >
  >;
  PollMessage: Assert<
    Equal<
      keyof Telegram.Message.PollMessage,
      keyof Original.Message.PollMessage
    >
  >;
  PollMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PollMessage>,
      RequiredKeys<Original.Message.PollMessage>
    >
  >;
  VenueMessage: Assert<
    Equal<
      keyof Telegram.Message.VenueMessage,
      keyof Original.Message.VenueMessage
    >
  >;
  VenueMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VenueMessage>,
      RequiredKeys<Original.Message.VenueMessage>
    >
  >;
  LocationMessage: Assert<
    Equal<
      keyof Telegram.Message.LocationMessage,
      keyof Original.Message.LocationMessage
    >
  >;
  LocationMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.LocationMessage>,
      RequiredKeys<Original.Message.LocationMessage>
    >
  >;
  DirectMessagePriceChangedMessage: Assert<
    Equal<
      keyof Telegram.Message.DirectMessagePriceChangedMessage,
      keyof Original.Message.DirectMessagePriceChangedMessage
    >
  >;
  DirectMessagePriceChangedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.DirectMessagePriceChangedMessage>,
      RequiredKeys<Original.Message.DirectMessagePriceChangedMessage>
    >
  >;
  ChecklistMessage: Assert<
    Equal<
      keyof Telegram.Message.ChecklistMessage,
      keyof Original.Message.ChecklistMessage
    >
  >;
  ChecklistMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChecklistMessage>,
      RequiredKeys<Original.Message.ChecklistMessage>
    >
  >;
  ChecklistTasksDoneMessage: Assert<
    Equal<
      keyof Telegram.Message.ChecklistTasksDoneMessage,
      keyof Original.Message.ChecklistTasksDoneMessage
    >
  >;
  ChecklistTasksDoneMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChecklistTasksDoneMessage>,
      RequiredKeys<Original.Message.ChecklistTasksDoneMessage>
    >
  >;
  ChecklistTasksAddedMessage: Assert<
    Equal<
      keyof Telegram.Message.ChecklistTasksAddedMessage,
      keyof Original.Message.ChecklistTasksAddedMessage
    >
  >;
  ChecklistTasksAddedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChecklistTasksAddedMessage>,
      RequiredKeys<Original.Message.ChecklistTasksAddedMessage>
    >
  >;
  SuggestedPostInfoMessage: Assert<
    Equal<
      keyof Telegram.Message.SuggestedPostInfoMessage,
      keyof Original.Message.SuggestedPostInfoMessage
    >
  >;
  SuggestedPostInfoMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuggestedPostInfoMessage>,
      RequiredKeys<Original.Message.SuggestedPostInfoMessage>
    >
  >;
  SuggestedPostApprovedMessage: Assert<
    Equal<
      keyof Telegram.Message.SuggestedPostApprovedMessage,
      keyof Original.Message.SuggestedPostApprovedMessage
    >
  >;
  SuggestedPostApprovedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuggestedPostApprovedMessage>,
      RequiredKeys<Original.Message.SuggestedPostApprovedMessage>
    >
  >;
  SuggestedPostApprovalFailedMessage: Assert<
    Equal<
      keyof Telegram.Message.SuggestedPostApprovalFailedMessage,
      keyof Original.Message.SuggestedPostApprovalFailedMessage
    >
  >;
  SuggestedPostApprovalFailedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuggestedPostApprovalFailedMessage>,
      RequiredKeys<Original.Message.SuggestedPostApprovalFailedMessage>
    >
  >;
  SuggestedPostDeclinedMessage: Assert<
    Equal<
      keyof Telegram.Message.SuggestedPostDeclinedMessage,
      keyof Original.Message.SuggestedPostDeclinedMessage
    >
  >;
  SuggestedPostDeclinedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuggestedPostDeclinedMessage>,
      RequiredKeys<Original.Message.SuggestedPostDeclinedMessage>
    >
  >;
  SuggestedPostPaidMessage: Assert<
    Equal<
      keyof Telegram.Message.SuggestedPostPaidMessage,
      keyof Original.Message.SuggestedPostPaidMessage
    >
  >;
  SuggestedPostPaidMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuggestedPostPaidMessage>,
      RequiredKeys<Original.Message.SuggestedPostPaidMessage>
    >
  >;
  SuggestedPostRefundedMessage: Assert<
    Equal<
      keyof Telegram.Message.SuggestedPostRefundedMessage,
      keyof Original.Message.SuggestedPostRefundedMessage
    >
  >;
  SuggestedPostRefundedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuggestedPostRefundedMessage>,
      RequiredKeys<Original.Message.SuggestedPostRefundedMessage>
    >
  >;
  ChatOwnerLeftMessage: Assert<
    Equal<
      keyof Telegram.Message.ChatOwnerLeftMessage,
      keyof Original.Message.ChatOwnerLeftMessage
    >
  >;
  ChatOwnerLeftMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChatOwnerLeftMessage>,
      RequiredKeys<Original.Message.ChatOwnerLeftMessage>
    >
  >;
  ChatOwnerChangedMessage: Assert<
    Equal<
      keyof Telegram.Message.ChatOwnerChangedMessage,
      keyof Original.Message.ChatOwnerChangedMessage
    >
  >;
  ChatOwnerChangedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChatOwnerChangedMessage>,
      RequiredKeys<Original.Message.ChatOwnerChangedMessage>
    >
  >;
  NewChatMembersMessage: Assert<
    Equal<
      keyof Telegram.Message.NewChatMembersMessage,
      keyof Original.Message.NewChatMembersMessage
    >
  >;
  NewChatMembersMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.NewChatMembersMessage>,
      RequiredKeys<Original.Message.NewChatMembersMessage>
    >
  >;
  CommunityChatJoinedMessage: Assert<
    Equal<
      keyof Telegram.Message.CommunityChatJoinedMessage,
      keyof Original.Message.CommunityChatJoinedMessage
    >
  >;
  CommunityChatJoinedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.CommunityChatJoinedMessage>,
      RequiredKeys<Original.Message.CommunityChatJoinedMessage>
    >
  >;
  LeftChatMemberMessage: Assert<
    Equal<
      keyof Telegram.Message.LeftChatMemberMessage,
      keyof Original.Message.LeftChatMemberMessage
    >
  >;
  LeftChatMemberMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.LeftChatMemberMessage>,
      RequiredKeys<Original.Message.LeftChatMemberMessage>
    >
  >;
  NewChatTitleMessage: Assert<
    Equal<
      keyof Telegram.Message.NewChatTitleMessage,
      keyof Original.Message.NewChatTitleMessage
    >
  >;
  NewChatTitleMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.NewChatTitleMessage>,
      RequiredKeys<Original.Message.NewChatTitleMessage>
    >
  >;
  NewChatPhotoMessage: Assert<
    Equal<
      keyof Telegram.Message.NewChatPhotoMessage,
      keyof Original.Message.NewChatPhotoMessage
    >
  >;
  NewChatPhotoMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.NewChatPhotoMessage>,
      RequiredKeys<Original.Message.NewChatPhotoMessage>
    >
  >;
  DeleteChatPhotoMessage: Assert<
    Equal<
      keyof Telegram.Message.DeleteChatPhotoMessage,
      keyof Original.Message.DeleteChatPhotoMessage
    >
  >;
  DeleteChatPhotoMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.DeleteChatPhotoMessage>,
      RequiredKeys<Original.Message.DeleteChatPhotoMessage>
    >
  >;
  GroupChatCreatedMessage: Assert<
    Equal<
      keyof Telegram.Message.GroupChatCreatedMessage,
      keyof Original.Message.GroupChatCreatedMessage
    >
  >;
  GroupChatCreatedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GroupChatCreatedMessage>,
      RequiredKeys<Original.Message.GroupChatCreatedMessage>
    >
  >;
  SupergroupChatCreated: Assert<
    Equal<
      keyof Telegram.Message.SupergroupChatCreated,
      keyof Original.Message.SupergroupChatCreated
    >
  >;
  SupergroupChatCreatedRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SupergroupChatCreated>,
      RequiredKeys<Original.Message.SupergroupChatCreated>
    >
  >;
  ChannelChatCreatedMessage: Assert<
    Equal<
      keyof Telegram.Message.ChannelChatCreatedMessage,
      keyof Original.Message.ChannelChatCreatedMessage
    >
  >;
  ChannelChatCreatedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChannelChatCreatedMessage>,
      RequiredKeys<Original.Message.ChannelChatCreatedMessage>
    >
  >;
  ManagedBotCreatedMessage: Assert<
    Equal<
      keyof Telegram.Message.ManagedBotCreatedMessage,
      keyof Original.Message.ManagedBotCreatedMessage
    >
  >;
  ManagedBotCreatedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ManagedBotCreatedMessage>,
      RequiredKeys<Original.Message.ManagedBotCreatedMessage>
    >
  >;
  PollOptionAddedMessage: Assert<
    Equal<
      keyof Telegram.Message.PollOptionAddedMessage,
      keyof Original.Message.PollOptionAddedMessage
    >
  >;
  PollOptionAddedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PollOptionAddedMessage>,
      RequiredKeys<Original.Message.PollOptionAddedMessage>
    >
  >;
  PollOptionDeletedMessage: Assert<
    Equal<
      keyof Telegram.Message.PollOptionDeletedMessage,
      keyof Original.Message.PollOptionDeletedMessage
    >
  >;
  PollOptionDeletedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PollOptionDeletedMessage>,
      RequiredKeys<Original.Message.PollOptionDeletedMessage>
    >
  >;
  MessageAutoDeleteTimerChangedMessage: Assert<
    Equal<
      keyof Telegram.Message.MessageAutoDeleteTimerChangedMessage,
      keyof Original.Message.MessageAutoDeleteTimerChangedMessage
    >
  >;
  MessageAutoDeleteTimerChangedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.MessageAutoDeleteTimerChangedMessage>,
      RequiredKeys<Original.Message.MessageAutoDeleteTimerChangedMessage>
    >
  >;
  MigrateToChatIdMessage: Assert<
    Equal<
      keyof Telegram.Message.MigrateToChatIdMessage,
      keyof Original.Message.MigrateToChatIdMessage
    >
  >;
  MigrateToChatIdMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.MigrateToChatIdMessage>,
      RequiredKeys<Original.Message.MigrateToChatIdMessage>
    >
  >;
  MigrateFromChatIdMessage: Assert<
    Equal<
      keyof Telegram.Message.MigrateFromChatIdMessage,
      keyof Original.Message.MigrateFromChatIdMessage
    >
  >;
  MigrateFromChatIdMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.MigrateFromChatIdMessage>,
      RequiredKeys<Original.Message.MigrateFromChatIdMessage>
    >
  >;
  PinnedMessageMessage: Assert<
    Equal<
      keyof Telegram.Message.PinnedMessageMessage,
      keyof Original.Message.PinnedMessageMessage
    >
  >;
  PinnedMessageMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PinnedMessageMessage>,
      RequiredKeys<Original.Message.PinnedMessageMessage>
    >
  >;
  InvoiceMessage: Assert<
    Equal<
      keyof Telegram.Message.InvoiceMessage,
      keyof Original.Message.InvoiceMessage
    >
  >;
  InvoiceMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.InvoiceMessage>,
      RequiredKeys<Original.Message.InvoiceMessage>
    >
  >;
  SuccessfulPaymentMessage: Assert<
    Equal<
      keyof Telegram.Message.SuccessfulPaymentMessage,
      keyof Original.Message.SuccessfulPaymentMessage
    >
  >;
  SuccessfulPaymentMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.SuccessfulPaymentMessage>,
      RequiredKeys<Original.Message.SuccessfulPaymentMessage>
    >
  >;
  RefundedPaymentMessage: Assert<
    Equal<
      keyof Telegram.Message.RefundedPaymentMessage,
      keyof Original.Message.RefundedPaymentMessage
    >
  >;
  RefundedPaymentMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.RefundedPaymentMessage>,
      RequiredKeys<Original.Message.RefundedPaymentMessage>
    >
  >;
  UsersSharedMessage: Assert<
    Equal<
      keyof Telegram.Message.UsersSharedMessage,
      keyof Original.Message.UsersSharedMessage
    >
  >;
  UsersSharedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.UsersSharedMessage>,
      RequiredKeys<Original.Message.UsersSharedMessage>
    >
  >;
  ChatSharedMessage: Assert<
    Equal<
      keyof Telegram.Message.ChatSharedMessage,
      keyof Original.Message.ChatSharedMessage
    >
  >;
  ChatSharedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChatSharedMessage>,
      RequiredKeys<Original.Message.ChatSharedMessage>
    >
  >;
  ConnectedWebsiteMessage: Assert<
    Equal<
      keyof Telegram.Message.ConnectedWebsiteMessage,
      keyof Original.Message.ConnectedWebsiteMessage
    >
  >;
  ConnectedWebsiteMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ConnectedWebsiteMessage>,
      RequiredKeys<Original.Message.ConnectedWebsiteMessage>
    >
  >;
  WriteAccessAllowedMessage: Assert<
    Equal<
      keyof Telegram.Message.WriteAccessAllowedMessage,
      keyof Original.Message.WriteAccessAllowedMessage
    >
  >;
  WriteAccessAllowedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.WriteAccessAllowedMessage>,
      RequiredKeys<Original.Message.WriteAccessAllowedMessage>
    >
  >;
  PassportDataMessage: Assert<
    Equal<
      keyof Telegram.Message.PassportDataMessage,
      keyof Original.Message.PassportDataMessage
    >
  >;
  PassportDataMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PassportDataMessage>,
      RequiredKeys<Original.Message.PassportDataMessage>
    >
  >;
  ProximityAlertTriggeredMessage: Assert<
    Equal<
      keyof Telegram.Message.ProximityAlertTriggeredMessage,
      keyof Original.Message.ProximityAlertTriggeredMessage
    >
  >;
  ProximityAlertTriggeredMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ProximityAlertTriggeredMessage>,
      RequiredKeys<Original.Message.ProximityAlertTriggeredMessage>
    >
  >;
  BoostAddedMessage: Assert<
    Equal<
      keyof Telegram.Message.BoostAddedMessage,
      keyof Original.Message.BoostAddedMessage
    >
  >;
  BoostAddedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.BoostAddedMessage>,
      RequiredKeys<Original.Message.BoostAddedMessage>
    >
  >;
  ChatBackgroundSetMessage: Assert<
    Equal<
      keyof Telegram.Message.ChatBackgroundSetMessage,
      keyof Original.Message.ChatBackgroundSetMessage
    >
  >;
  ChatBackgroundSetMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ChatBackgroundSetMessage>,
      RequiredKeys<Original.Message.ChatBackgroundSetMessage>
    >
  >;
  ForumTopicCreatedMessage: Assert<
    Equal<
      keyof Telegram.Message.ForumTopicCreatedMessage,
      keyof Original.Message.ForumTopicCreatedMessage
    >
  >;
  ForumTopicCreatedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ForumTopicCreatedMessage>,
      RequiredKeys<Original.Message.ForumTopicCreatedMessage>
    >
  >;
  ForumTopicEditedMessage: Assert<
    Equal<
      keyof Telegram.Message.ForumTopicEditedMessage,
      keyof Original.Message.ForumTopicEditedMessage
    >
  >;
  ForumTopicEditedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ForumTopicEditedMessage>,
      RequiredKeys<Original.Message.ForumTopicEditedMessage>
    >
  >;
  ForumTopicClosedMessage: Assert<
    Equal<
      keyof Telegram.Message.ForumTopicClosedMessage,
      keyof Original.Message.ForumTopicClosedMessage
    >
  >;
  ForumTopicClosedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ForumTopicClosedMessage>,
      RequiredKeys<Original.Message.ForumTopicClosedMessage>
    >
  >;
  ForumTopicReopenedMessage: Assert<
    Equal<
      keyof Telegram.Message.ForumTopicReopenedMessage,
      keyof Original.Message.ForumTopicReopenedMessage
    >
  >;
  ForumTopicReopenedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.ForumTopicReopenedMessage>,
      RequiredKeys<Original.Message.ForumTopicReopenedMessage>
    >
  >;
  GeneralForumTopicHiddenMessage: Assert<
    Equal<
      keyof Telegram.Message.GeneralForumTopicHiddenMessage,
      keyof Original.Message.GeneralForumTopicHiddenMessage
    >
  >;
  GeneralForumTopicHiddenMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GeneralForumTopicHiddenMessage>,
      RequiredKeys<Original.Message.GeneralForumTopicHiddenMessage>
    >
  >;
  GeneralForumTopicUnhiddenMessage: Assert<
    Equal<
      keyof Telegram.Message.GeneralForumTopicUnhiddenMessage,
      keyof Original.Message.GeneralForumTopicUnhiddenMessage
    >
  >;
  GeneralForumTopicUnhiddenMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GeneralForumTopicUnhiddenMessage>,
      RequiredKeys<Original.Message.GeneralForumTopicUnhiddenMessage>
    >
  >;
  GiveawayCreatedMessage: Assert<
    Equal<
      keyof Telegram.Message.GiveawayCreatedMessage,
      keyof Original.Message.GiveawayCreatedMessage
    >
  >;
  GiveawayCreatedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GiveawayCreatedMessage>,
      RequiredKeys<Original.Message.GiveawayCreatedMessage>
    >
  >;
  GiveawayMessage: Assert<
    Equal<
      keyof Telegram.Message.GiveawayMessage,
      keyof Original.Message.GiveawayMessage
    >
  >;
  GiveawayMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GiveawayMessage>,
      RequiredKeys<Original.Message.GiveawayMessage>
    >
  >;
  GiveawayWinnersMessage: Assert<
    Equal<
      keyof Telegram.Message.GiveawayWinnersMessage,
      keyof Original.Message.GiveawayWinnersMessage
    >
  >;
  GiveawayWinnersMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GiveawayWinnersMessage>,
      RequiredKeys<Original.Message.GiveawayWinnersMessage>
    >
  >;
  GiveawayCompletedMessage: Assert<
    Equal<
      keyof Telegram.Message.GiveawayCompletedMessage,
      keyof Original.Message.GiveawayCompletedMessage
    >
  >;
  GiveawayCompletedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GiveawayCompletedMessage>,
      RequiredKeys<Original.Message.GiveawayCompletedMessage>
    >
  >;
  GiftMessage: Assert<
    Equal<
      keyof Telegram.Message.GiftMessage,
      keyof Original.Message.GiftMessage
    >
  >;
  GiftMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GiftMessage>,
      RequiredKeys<Original.Message.GiftMessage>
    >
  >;
  UniqueGiftMessage: Assert<
    Equal<
      keyof Telegram.Message.UniqueGiftMessage,
      keyof Original.Message.UniqueGiftMessage
    >
  >;
  UniqueGiftMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.UniqueGiftMessage>,
      RequiredKeys<Original.Message.UniqueGiftMessage>
    >
  >;
  GiftUpgradeSentMessage: Assert<
    Equal<
      keyof Telegram.Message.GiftUpgradeSentMessage,
      keyof Original.Message.GiftUpgradeSentMessage
    >
  >;
  GiftUpgradeSentMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.GiftUpgradeSentMessage>,
      RequiredKeys<Original.Message.GiftUpgradeSentMessage>
    >
  >;
  PaidMessagePriceChangedMessage: Assert<
    Equal<
      keyof Telegram.Message.PaidMessagePriceChangedMessage,
      keyof Original.Message.PaidMessagePriceChangedMessage
    >
  >;
  PaidMessagePriceChangedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.PaidMessagePriceChangedMessage>,
      RequiredKeys<Original.Message.PaidMessagePriceChangedMessage>
    >
  >;
  VideoChatScheduledMessage: Assert<
    Equal<
      keyof Telegram.Message.VideoChatScheduledMessage,
      keyof Original.Message.VideoChatScheduledMessage
    >
  >;
  VideoChatScheduledMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VideoChatScheduledMessage>,
      RequiredKeys<Original.Message.VideoChatScheduledMessage>
    >
  >;
  VideoChatStartedMessage: Assert<
    Equal<
      keyof Telegram.Message.VideoChatStartedMessage,
      keyof Original.Message.VideoChatStartedMessage
    >
  >;
  VideoChatStartedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VideoChatStartedMessage>,
      RequiredKeys<Original.Message.VideoChatStartedMessage>
    >
  >;
  VideoChatEndedMessage: Assert<
    Equal<
      keyof Telegram.Message.VideoChatEndedMessage,
      keyof Original.Message.VideoChatEndedMessage
    >
  >;
  VideoChatEndedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VideoChatEndedMessage>,
      RequiredKeys<Original.Message.VideoChatEndedMessage>
    >
  >;
  VideoChatParticipantsInvitedMessage: Assert<
    Equal<
      keyof Telegram.Message.VideoChatParticipantsInvitedMessage,
      keyof Original.Message.VideoChatParticipantsInvitedMessage
    >
  >;
  VideoChatParticipantsInvitedMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.VideoChatParticipantsInvitedMessage>,
      RequiredKeys<Original.Message.VideoChatParticipantsInvitedMessage>
    >
  >;
  WebAppDataMessage: Assert<
    Equal<
      keyof Telegram.Message.WebAppDataMessage,
      keyof Original.Message.WebAppDataMessage
    >
  >;
  WebAppDataMessageRequired: Assert<
    Equal<
      RequiredKeys<Telegram.Message.WebAppDataMessage>,
      RequiredKeys<Original.Message.WebAppDataMessage>
    >
  >;
}
