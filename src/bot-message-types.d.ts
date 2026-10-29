// Public subtype names and owned official field projections; no SDK implementation.
// Regenerate: node experiments/generate-bot-subtypes.mjs
import type { BotModels } from './bot-types/index.js';
export type Message = BotModels['Message'];
export declare namespace Message {
  export type ServiceMessage = Pick<
    Message,
    | 'message_id'
    | 'message_thread_id'
    | 'from'
    | 'sender_chat'
    | 'date'
    | 'guest_query_id'
    | 'business_connection_id'
    | 'chat'
    | 'is_topic_message'
    | 'direct_messages_topic'
  >;
  export type CommonMessage = ServiceMessage &
    Pick<
      Message,
      | 'sender_tag'
      | 'receiver_user'
      | 'ephemeral_message_id'
      | 'sender_boost_count'
      | 'sender_business_bot'
      | 'forward_origin'
      | 'is_automatic_forward'
      | 'reply_to_message'
      | 'reply_to_checklist_task_id'
      | 'reply_to_poll_option_id'
      | 'is_paid_post'
      | 'external_reply'
      | 'quote'
      | 'reply_to_story'
      | 'via_bot'
      | 'guest_bot_caller_user'
      | 'guest_bot_caller_chat'
      | 'edit_date'
      | 'has_protected_content'
      | 'show_caption_above_media'
      | 'is_from_offline'
      | 'author_signature'
      | 'link_preview_options'
      | 'effect_id'
      | 'paid_star_count'
      | 'reply_markup'
    >;
  export type CaptionableMessage = CommonMessage &
    Pick<Message, 'caption' | 'caption_entities'>;
  export type MediaMessage = CaptionableMessage &
    Pick<Message, 'media_group_id' | 'has_media_spoiler'>;
  export type TextMessage = CommonMessage &
    Required<Pick<Message, 'text'>> &
    Pick<Message, 'entities'>;
  export type RichMessageMessage = CommonMessage &
    Required<Pick<Message, 'rich_message'>>;
  export type AnimationMessage = CaptionableMessage &
    Required<Pick<Message, 'animation' | 'document'>>;
  export type AudioMessage = CaptionableMessage &
    Required<Pick<Message, 'audio'>>;
  export type DocumentMessage = CaptionableMessage &
    Required<Pick<Message, 'document'>>;
  export type LivePhotoMessage = MediaMessage &
    Required<Pick<Message, 'live_photo'>>;
  export type PaidMediaMessage = CommonMessage &
    Required<Pick<Message, 'paid_media'>>;
  export type PhotoMessage = MediaMessage & Required<Pick<Message, 'photo'>>;
  export type StickerMessage = CommonMessage &
    Required<Pick<Message, 'sticker'>>;
  export type StoryMessage = CommonMessage & Required<Pick<Message, 'story'>>;
  export type VideoMessage = MediaMessage & Required<Pick<Message, 'video'>>;
  export type VideoNoteMessage = CommonMessage &
    Required<Pick<Message, 'video_note'>>;
  export type VoiceMessage = CaptionableMessage &
    Required<Pick<Message, 'voice'>>;
  export type ContactMessage = CommonMessage &
    Required<Pick<Message, 'contact'>>;
  export type DiceMessage = CommonMessage & Required<Pick<Message, 'dice'>>;
  export type GameMessage = CommonMessage & Required<Pick<Message, 'game'>>;
  export type PollMessage = CommonMessage & Required<Pick<Message, 'poll'>>;
  export type VenueMessage = CommonMessage &
    Required<Pick<Message, 'venue' | 'location'>>;
  export type LocationMessage = CommonMessage &
    Required<Pick<Message, 'location'>>;
  export type DirectMessagePriceChangedMessage = ServiceMessage &
    Required<Pick<Message, 'direct_message_price_changed'>>;
  export type ChecklistMessage = CommonMessage &
    Required<Pick<Message, 'checklist'>>;
  export type ChecklistTasksDoneMessage = ServiceMessage &
    Required<Pick<Message, 'checklist_tasks_done'>>;
  export type ChecklistTasksAddedMessage = ServiceMessage &
    Required<Pick<Message, 'checklist_tasks_added'>>;
  export type SuggestedPostInfoMessage = ServiceMessage &
    Required<Pick<Message, 'suggested_post_info'>>;
  export type SuggestedPostApprovedMessage = ServiceMessage &
    Required<Pick<Message, 'suggested_post_approved'>>;
  export type SuggestedPostApprovalFailedMessage = ServiceMessage &
    Required<Pick<Message, 'suggested_post_approval_failed'>>;
  export type SuggestedPostDeclinedMessage = ServiceMessage &
    Required<Pick<Message, 'suggested_post_declined'>>;
  export type SuggestedPostPaidMessage = ServiceMessage &
    Required<Pick<Message, 'suggested_post_paid'>>;
  export type SuggestedPostRefundedMessage = ServiceMessage &
    Required<Pick<Message, 'suggested_post_refunded'>>;
  export type ChatOwnerLeftMessage = ServiceMessage &
    Required<Pick<Message, 'chat_owner_left'>>;
  export type ChatOwnerChangedMessage = ServiceMessage &
    Required<Pick<Message, 'chat_owner_changed'>>;
  export type NewChatMembersMessage = ServiceMessage &
    Required<Pick<Message, 'new_chat_members'>>;
  export type CommunityChatJoinedMessage = ServiceMessage &
    Required<Pick<Message, 'community_chat_joined'>>;
  export type LeftChatMemberMessage = ServiceMessage &
    Required<Pick<Message, 'left_chat_member'>>;
  export type NewChatTitleMessage = ServiceMessage &
    Required<Pick<Message, 'new_chat_title'>>;
  export type NewChatPhotoMessage = ServiceMessage &
    Required<Pick<Message, 'new_chat_photo'>>;
  export type DeleteChatPhotoMessage = ServiceMessage &
    Required<Pick<Message, 'delete_chat_photo'>>;
  export type GroupChatCreatedMessage = ServiceMessage &
    Required<Pick<Message, 'group_chat_created'>>;
  export type SupergroupChatCreated = ServiceMessage &
    Required<Pick<Message, 'supergroup_chat_created'>>;
  export type ChannelChatCreatedMessage = ServiceMessage &
    Required<Pick<Message, 'channel_chat_created'>>;
  export type ManagedBotCreatedMessage = ServiceMessage &
    Required<Pick<Message, 'managed_bot_created'>>;
  export type PollOptionAddedMessage = ServiceMessage &
    Required<Pick<Message, 'poll_option_added'>>;
  export type PollOptionDeletedMessage = ServiceMessage &
    Required<Pick<Message, 'poll_option_deleted'>>;
  export type MessageAutoDeleteTimerChangedMessage = ServiceMessage &
    Required<Pick<Message, 'message_auto_delete_timer_changed'>>;
  export type MigrateToChatIdMessage = ServiceMessage &
    Required<Pick<Message, 'migrate_to_chat_id'>>;
  export type MigrateFromChatIdMessage = ServiceMessage &
    Required<Pick<Message, 'migrate_from_chat_id'>>;
  export type PinnedMessageMessage = ServiceMessage &
    Required<Pick<Message, 'pinned_message'>>;
  export type InvoiceMessage = ServiceMessage &
    Required<Pick<Message, 'invoice'>>;
  export type SuccessfulPaymentMessage = ServiceMessage &
    Required<Pick<Message, 'successful_payment'>>;
  export type RefundedPaymentMessage = ServiceMessage &
    Required<Pick<Message, 'refunded_payment'>>;
  export type UsersSharedMessage = ServiceMessage &
    Required<Pick<Message, 'users_shared'>>;
  export type ChatSharedMessage = ServiceMessage &
    Required<Pick<Message, 'chat_shared'>>;
  export type ConnectedWebsiteMessage = ServiceMessage &
    Required<Pick<Message, 'connected_website'>>;
  export type WriteAccessAllowedMessage = ServiceMessage &
    Required<Pick<Message, 'write_access_allowed'>>;
  export type PassportDataMessage = ServiceMessage &
    Required<Pick<Message, 'passport_data'>>;
  export type ProximityAlertTriggeredMessage = ServiceMessage &
    Required<Pick<Message, 'proximity_alert_triggered'>>;
  export type BoostAddedMessage = ServiceMessage &
    Required<Pick<Message, 'boost_added'>>;
  export type ChatBackgroundSetMessage = ServiceMessage &
    Required<Pick<Message, 'chat_background_set'>>;
  export type ForumTopicCreatedMessage = ServiceMessage &
    Required<Pick<Message, 'forum_topic_created'>>;
  export type ForumTopicEditedMessage = ServiceMessage &
    Required<Pick<Message, 'forum_topic_edited'>>;
  export type ForumTopicClosedMessage = ServiceMessage &
    Required<Pick<Message, 'forum_topic_closed'>>;
  export type ForumTopicReopenedMessage = ServiceMessage &
    Required<Pick<Message, 'forum_topic_reopened'>>;
  export type GeneralForumTopicHiddenMessage = ServiceMessage &
    Required<Pick<Message, 'general_forum_topic_hidden'>>;
  export type GeneralForumTopicUnhiddenMessage = ServiceMessage &
    Required<Pick<Message, 'general_forum_topic_unhidden'>>;
  export type GiveawayCreatedMessage = ServiceMessage &
    Required<Pick<Message, 'giveaway_created'>>;
  export type GiveawayMessage = ServiceMessage &
    Required<Pick<Message, 'giveaway'>>;
  export type GiveawayWinnersMessage = ServiceMessage &
    Required<Pick<Message, 'giveaway_winners'>>;
  export type GiveawayCompletedMessage = ServiceMessage &
    Required<Pick<Message, 'giveaway_completed'>>;
  export type GiftMessage = ServiceMessage & Required<Pick<Message, 'gift'>>;
  export type UniqueGiftMessage = ServiceMessage &
    Required<Pick<Message, 'unique_gift'>>;
  export type GiftUpgradeSentMessage = ServiceMessage &
    Required<Pick<Message, 'gift_upgrade_sent'>>;
  export type PaidMessagePriceChangedMessage = ServiceMessage &
    Required<Pick<Message, 'paid_message_price_changed'>>;
  export type VideoChatScheduledMessage = ServiceMessage &
    Required<Pick<Message, 'video_chat_scheduled'>>;
  export type VideoChatStartedMessage = ServiceMessage &
    Required<Pick<Message, 'video_chat_started'>>;
  export type VideoChatEndedMessage = ServiceMessage &
    Required<Pick<Message, 'video_chat_ended'>>;
  export type VideoChatParticipantsInvitedMessage = ServiceMessage &
    Required<Pick<Message, 'video_chat_participants_invited'>>;
  export type WebAppDataMessage = ServiceMessage &
    Required<Pick<Message, 'web_app_data'>>;
}
type ChatKind = 'private' | 'group' | 'supergroup' | 'channel';
type ChatShape<T, K extends ChatKind> = Omit<
  T,
  | 'type'
  | 'title'
  | 'first_name'
  | 'last_name'
  | 'username'
  | 'is_forum'
  | 'is_direct_messages'
> & {
  type: K;
} & (K extends 'private'
    ? { first_name: string; last_name?: string; title?: undefined }
    : { title: string; first_name?: undefined; last_name?: undefined }) & {
    username?: K extends 'group' ? undefined : string;
    is_forum?: K extends 'supergroup' ? true : undefined;
    is_direct_messages?: K extends 'supergroup' ? true : undefined;
  };
export type Chat = BotModels['Chat'];
export declare namespace Chat {
  export type PrivateChat = ChatShape<Chat, 'private'>;
  export type GroupChat = ChatShape<Chat, 'group'>;
  export type SupergroupChat = ChatShape<Chat, 'supergroup'>;
  export type ChannelChat = ChatShape<Chat, 'channel'>;
}
export type ChatFullInfo = BotModels['ChatFullInfo'];
export declare namespace ChatFullInfo {
  export type PrivateChat = ChatShape<ChatFullInfo, 'private'>;
  export type GroupChat = ChatShape<ChatFullInfo, 'group'>;
  export type SupergroupChat = ChatShape<ChatFullInfo, 'supergroup'>;
  export type ChannelChat = ChatShape<ChatFullInfo, 'channel'>;
}
export type Update = BotModels['Update'];
export declare namespace Update {
  export type Private = { chat: Chat.PrivateChat };
  export type Channel = { chat: Chat.ChannelChat };
  export type NonChannel = {
    chat: Chat.GroupChat | Chat.SupergroupChat | Chat.PrivateChat;
    from: BotModels['User'];
  };
  export type Edited = { edit_date: number };
}
