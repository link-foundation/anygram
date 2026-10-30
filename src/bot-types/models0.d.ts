// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models0 {
  Update: {
    update_id: number;
    message?: BotModels['Message'];
    edited_message?: BotModels['Message'];
    channel_post?: BotModels['Message'];
    edited_channel_post?: BotModels['Message'];
    business_connection?: BotModels['BusinessConnection'];
    business_message?: BotModels['Message'];
    edited_business_message?: BotModels['Message'];
    deleted_business_messages?: BotModels['BusinessMessagesDeleted'];
    guest_message?: BotModels['Message'];
    message_reaction?: BotModels['MessageReactionUpdated'];
    message_reaction_count?: BotModels['MessageReactionCountUpdated'];
    inline_query?: BotModels['InlineQuery'];
    chosen_inline_result?: BotModels['ChosenInlineResult'];
    callback_query?: BotModels['CallbackQuery'];
    shipping_query?: BotModels['ShippingQuery'];
    pre_checkout_query?: BotModels['PreCheckoutQuery'];
    purchased_paid_media?: BotModels['PaidMediaPurchased'];
    poll?: BotModels['Poll'];
    poll_answer?: BotModels['PollAnswer'];
    my_chat_member?: BotModels['ChatMemberUpdated'];
    chat_member?: BotModels['ChatMemberUpdated'];
    chat_join_request?: BotModels['ChatJoinRequest'];
    chat_boost?: BotModels['ChatBoostUpdated'];
    removed_chat_boost?: BotModels['ChatBoostRemoved'];
    managed_bot?: BotModels['ManagedBotUpdated'];
    subscription?: BotModels['BotSubscriptionUpdated'];
    stopped_message_generation?: BotModels['MessageGenerationStopped'];
  };
  WebhookInfo: {
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    ip_address?: string;
    last_error_date?: number;
    last_error_message?: string;
    last_synchronization_error_date?: number;
    max_connections?: number;
    allowed_updates?: Array<string>;
  };
  User: {
    is_bot: boolean;
    first_name: string;
    language_code?: string;
    is_premium?: true;
    added_to_attachment_menu?: true;
    can_join_groups?: boolean;
    can_read_all_group_messages?: boolean;
    supports_guest_queries?: boolean;
    supports_inline_queries?: boolean;
    can_connect_to_business?: boolean;
    has_main_web_app?: boolean;
    has_topics_enabled?: boolean;
    allows_users_to_create_topics?: boolean;
    can_manage_bots?: boolean;
    supports_join_request_queries?: boolean;
  } & SharedFields['Fields44'];
  Chat: SharedFields['Fields12'];
  ChatFullInfo: {
    accent_color_id: number;
    max_reaction_count: number;
    photo?: BotModels['ChatPhoto'];
    active_usernames?: Array<string>;
    birthdate?: BotModels['Birthdate'];
    business_intro?: BotModels['BusinessIntro'];
    business_location?: BotModels['BusinessLocation'];
    business_opening_hours?: BotModels['BusinessOpeningHours'];
    personal_chat?: BotModels['Chat'];
    parent_chat?: BotModels['Chat'];
    available_reactions?: Array<BotModels['ReactionType']>;
    background_custom_emoji_id?: string;
    profile_accent_color_id?: number;
    profile_background_custom_emoji_id?: string;
    emoji_status_custom_emoji_id?: string;
    emoji_status_expiration_date?: number;
    bio?: string;
    has_private_forwards?: true;
    has_restricted_voice_and_video_messages?: true;
    join_to_send_messages?: true;
    join_by_request?: true;
    description?: string;
    invite_link?: string;
    pinned_message?: BotModels['Message'];
    permissions?: BotModels['ChatPermissions'];
    accepted_gift_types: BotModels['AcceptedGiftTypes'];
    can_send_paid_media?: true;
    slow_mode_delay?: number;
    unrestrict_boost_count?: number;
    message_auto_delete_time?: number;
    has_aggressive_anti_spam_enabled?: true;
    has_hidden_members?: true;
    has_protected_content?: true;
    has_visible_history?: true;
    sticker_set_name?: string;
    can_set_sticker_set?: true;
    custom_emoji_sticker_set_name?: string;
    linked_chat_id?: number;
    location?: BotModels['ChatLocation'];
    rating?: BotModels['UserRating'];
    first_profile_audio?: BotModels['Audio'];
    unique_gift_colors?: BotModels['UniqueGiftColors'];
    paid_message_star_count?: number;
    guard_bot?: BotModels['User'];
    community?: BotModels['Community'];
  } & SharedFields['Fields12'];
  Message: {
    message_thread_id?: number;
    direct_messages_topic?: BotModels['DirectMessagesTopic'];
    from?: BotModels['User'];
    sender_chat?: BotModels['Chat'];
    sender_boost_count?: number;
    sender_business_bot?: BotModels['User'];
    sender_tag?: string;
    receiver_user?: BotModels['User'];
    ephemeral_message_id?: number;
    guest_query_id?: string;
    business_connection_id?: string;
    forward_origin?: BotModels['MessageOrigin'];
    is_topic_message?: true;
    is_automatic_forward?: true;
    reply_to_message?: BotModels['Message'];
    external_reply?: BotModels['ExternalReplyInfo'];
    quote?: BotModels['TextQuote'];
    reply_to_story?: BotModels['Story'];
    reply_to_checklist_task_id?: number;
    reply_to_poll_option_id?: string;
    via_bot?: BotModels['User'];
    guest_bot_caller_user?: BotModels['User'];
    guest_bot_caller_chat?: BotModels['Chat'];
    edit_date?: number;
    has_protected_content?: true;
    is_from_offline?: true;
    is_paid_post?: true;
    media_group_id?: string;
    paid_star_count?: number;
    suggested_post_info?: BotModels['SuggestedPostInfo'];
    effect_id?: string;
    rich_message?: BotModels['RichMessage'];
    show_caption_above_media?: true;
    new_chat_members?: Array<BotModels['User']>;
    left_chat_member?: BotModels['User'];
    chat_owner_left?: BotModels['ChatOwnerLeft'];
    chat_owner_changed?: BotModels['ChatOwnerChanged'];
    new_chat_title?: string;
    new_chat_photo?: Array<BotModels['PhotoSize']>;
    delete_chat_photo?: true;
    group_chat_created?: true;
    supergroup_chat_created?: true;
    channel_chat_created?: true;
    message_auto_delete_timer_changed?: BotModels['MessageAutoDeleteTimerChanged'];
    migrate_to_chat_id?: number;
    migrate_from_chat_id?: number;
    pinned_message?: BotModels['MaybeInaccessibleMessage'];
    successful_payment?: BotModels['SuccessfulPayment'];
    refunded_payment?: BotModels['RefundedPayment'];
    users_shared?: BotModels['UsersShared'];
    chat_shared?: BotModels['ChatShared'];
    gift?: BotModels['GiftInfo'];
    unique_gift?: BotModels['UniqueGiftInfo'];
    gift_upgrade_sent?: BotModels['GiftInfo'];
    connected_website?: string;
    write_access_allowed?: BotModels['WriteAccessAllowed'];
    passport_data?: BotModels['PassportData'];
    proximity_alert_triggered?: BotModels['ProximityAlertTriggered'];
    boost_added?: BotModels['ChatBoostAdded'];
    chat_background_set?: BotModels['ChatBackground'];
    checklist_tasks_done?: BotModels['ChecklistTasksDone'];
    checklist_tasks_added?: BotModels['ChecklistTasksAdded'];
    community_chat_added?: BotModels['CommunityChatAdded'];
    community_chat_joined?: BotModels['CommunityChatJoined'];
    community_chat_removed?: BotModels['CommunityChatRemoved'];
    direct_message_price_changed?: BotModels['DirectMessagePriceChanged'];
    forum_topic_created?: BotModels['ForumTopicCreated'];
    forum_topic_edited?: BotModels['ForumTopicEdited'];
    forum_topic_closed?: BotModels['ForumTopicClosed'];
    forum_topic_reopened?: BotModels['ForumTopicReopened'];
    general_forum_topic_hidden?: BotModels['GeneralForumTopicHidden'];
    general_forum_topic_unhidden?: BotModels['GeneralForumTopicUnhidden'];
    giveaway_created?: BotModels['GiveawayCreated'];
    giveaway_completed?: BotModels['GiveawayCompleted'];
    managed_bot_created?: BotModels['ManagedBotCreated'];
    paid_message_price_changed?: BotModels['PaidMessagePriceChanged'];
    poll_option_added?: BotModels['PollOptionAdded'];
    poll_option_deleted?: BotModels['PollOptionDeleted'];
    suggested_post_approved?: BotModels['SuggestedPostApproved'];
    suggested_post_approval_failed?: BotModels['SuggestedPostApprovalFailed'];
    suggested_post_declined?: BotModels['SuggestedPostDeclined'];
    suggested_post_paid?: BotModels['SuggestedPostPaid'];
    suggested_post_refunded?: BotModels['SuggestedPostRefunded'];
    video_chat_scheduled?: BotModels['VideoChatScheduled'];
    video_chat_started?: BotModels['VideoChatStarted'];
    video_chat_ended?: BotModels['VideoChatEnded'];
    video_chat_participants_invited?: BotModels['VideoChatParticipantsInvited'];
    web_app_data?: BotModels['WebAppData'];
  } & SharedFields['Fields0'] &
    SharedFields['Fields34'] &
    SharedFields['Fields45'] &
    SharedFields['Fields68'];
  MessageId: { message_id: number };
  InaccessibleMessage: { date: 0 } & SharedFields['Fields69'];
  MaybeInaccessibleMessage:
    | BotModels['Message']
    | BotModels['InaccessibleMessage'];
  MessageEntity: {
    type:
      | 'mention'
      | 'hashtag'
      | 'cashtag'
      | 'bot_command'
      | 'url'
      | 'email'
      | 'phone_number'
      | 'bold'
      | 'italic'
      | 'underline'
      | 'strikethrough'
      | 'spoiler'
      | 'blockquote'
      | 'expandable_blockquote'
      | 'code'
      | 'pre'
      | 'text_link'
      | 'text_mention'
      | 'custom_emoji'
      | 'date_time';
    offset: number;
    length: number;
    url?: string;
    user?: BotModels['User'];
    language?: string;
    custom_emoji_id?: string;
    unix_time?: number;
    date_time_format?: string;
  };
  TextQuote: {
    text: string;
    entities?: Array<BotModels['MessageEntity']>;
    position: number;
    is_manual?: true;
  };
  ExternalReplyInfo: {
    origin: BotModels['MessageOrigin'];
    chat?: BotModels['Chat'];
    message_id?: number;
  } & SharedFields['Fields0'];
  ReplyParameters: {
    message_id?: number;
    chat_id?: number | string;
    ephemeral_message_id?: number;
    allow_sending_without_reply?: boolean;
    quote?: string;
    quote_parse_mode?: string;
    quote_entities?: Array<BotModels['MessageEntity']>;
    quote_position?: number;
    checklist_task_id?: number;
    poll_option_id?: string;
  };
  EphemeralMessageParameters: {
    receiver_user_id: number;
    callback_query_id?: string;
    replace_callback_query_message?: boolean;
  };
  MessageOrigin:
    | BotModels['MessageOriginUser']
    | BotModels['MessageOriginHiddenUser']
    | BotModels['MessageOriginChat']
    | BotModels['MessageOriginChannel'];
  MessageOriginUser: {
    type: 'user';
    date: number;
    sender_user: BotModels['User'];
  };
  MessageOriginHiddenUser: {
    type: 'hidden_user';
    date: number;
    sender_user_name: string;
  };
  MessageOriginChat: {
    type: 'chat';
    date: number;
    sender_chat: BotModels['Chat'];
    author_signature?: string;
  };
  MessageOriginChannel: { type: 'channel' } & SharedFields['Fields34'];
  PhotoSize: SharedFields['Fields30'];
  Animation: SharedFields['Fields7'];
  Audio: SharedFields['Fields17'] & SharedFields['Fields70'];
  Document: SharedFields['Fields20'];
  LivePhoto: {
    photo?: Array<BotModels['PhotoSize']>;
    duration: number;
    mime_type?: string;
  } & SharedFields['Fields30'];
  Story: { chat: BotModels['Chat']; id: number };
  VideoQuality: { codec: string } & SharedFields['Fields30'];
  Video: {
    cover?: Array<BotModels['PhotoSize']>;
    start_timestamp?: number;
    qualities?: Array<BotModels['VideoQuality']>;
  } & SharedFields['Fields7'];
  VideoNote: {
    length: number;
    thumbnail?: BotModels['PhotoSize'];
  } & SharedFields['Fields35'];
  Voice: { mime_type?: string } & SharedFields['Fields35'];
  PaidMediaInfo: {
    star_count: number;
    paid_media: Array<BotModels['PaidMedia']>;
  };
  PaidMedia:
    | BotModels['PaidMediaLivePhoto']
    | BotModels['PaidMediaPhoto']
    | BotModels['PaidMediaPreview']
    | BotModels['PaidMediaVideo'];
  PaidMediaLivePhoto: {
    type: 'live_photo';
    live_photo: BotModels['LivePhoto'];
  };
  PaidMediaPhoto: SharedFields['Fields71'];
  PaidMediaPreview: { type: 'preview' } & SharedFields['Fields46'];
  PaidMediaVideo: SharedFields['Fields72'];
  Contact: { user_id?: number } & SharedFields['Fields36'];
  Dice: { emoji: string; value: number };
  Link: { url: string };
  PollMedia: { link?: BotModels['Link'] } & SharedFields['Fields8'];
  InputPollMedia:
    | BotModels['InputMediaAnimation']
    | BotModels['InputMediaAudio']
    | BotModels['InputMediaDocument']
    | BotModels['InputMediaLivePhoto']
    | BotModels['InputMediaLocation']
    | BotModels['InputMediaPhoto']
    | BotModels['InputMediaVenue']
    | BotModels['InputMediaVideo'];
  InputPollOptionMedia:
    | BotModels['InputMediaAnimation']
    | BotModels['InputMediaLink']
    | BotModels['InputMediaLivePhoto']
    | BotModels['InputMediaLocation']
    | BotModels['InputMediaPhoto']
    | BotModels['InputMediaSticker']
    | BotModels['InputMediaVenue']
    | BotModels['InputMediaVideo'];
  PollOption: {
    persistent_id: string;
    media?: BotModels['PollMedia'];
    voter_count: number;
    added_by_user?: BotModels['User'];
    added_by_chat?: BotModels['Chat'];
    addition_date?: number;
  } & SharedFields['Fields73'];
  InputPollOption: {
    text_parse_mode?: string;
    media?: BotModels['InputPollOptionMedia'];
  } & SharedFields['Fields73'];
  PollAnswer: {
    poll_id: string;
    voter_chat?: BotModels['Chat'];
    user?: BotModels['User'];
    option_ids: Array<number>;
    option_persistent_ids: Array<string>;
  };
  Poll: {
    id: string;
    question: string;
    question_entities?: Array<BotModels['MessageEntity']>;
    options: Array<BotModels['PollOption']>;
    total_voter_count: number;
    is_closed: boolean;
    is_anonymous: boolean;
    type: 'regular' | 'quiz';
    allows_multiple_answers: boolean;
    allows_revoting: boolean;
    members_only: boolean;
    country_codes?: Array<string>;
    correct_option_ids?: Array<number>;
    explanation?: string;
    explanation_entities?: Array<BotModels['MessageEntity']>;
    explanation_media?: BotModels['PollMedia'];
    open_period?: number;
    close_date?: number;
    description?: string;
    description_entities?: Array<BotModels['MessageEntity']>;
    media?: BotModels['PollMedia'];
  };
  ChecklistTask: {
    completed_by_user?: BotModels['User'];
    completed_by_chat?: BotModels['Chat'];
    completion_date?: number;
  } & SharedFields['Fields47'];
  Checklist: {
    tasks: Array<BotModels['ChecklistTask']>;
    others_can_add_tasks?: true;
    others_can_mark_tasks_as_done?: true;
  } & SharedFields['Fields74'];
  InputChecklistTask: { parse_mode?: string } & SharedFields['Fields47'];
  InputChecklist: {
    parse_mode?: string;
    tasks: Array<BotModels['InputChecklistTask']>;
    others_can_add_tasks?: boolean;
    others_can_mark_tasks_as_done?: boolean;
  } & SharedFields['Fields74'];
  Location: SharedFields['Fields21'];
}
