// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models1 {
  Venue: { location: BotModels['Location'] } & SharedFields['Fields22'];
  WebAppData: { data: string; button_text: string };
  ProximityAlertTriggered: {
    traveler: BotModels['User'];
    watcher: BotModels['User'];
    distance: number;
  };
  MessageAutoDeleteTimerChanged: { message_auto_delete_time: number };
  ManagedBotCreated: { bot: BotModels['User'] };
  ManagedBotUpdated: { user: BotModels['User']; bot: BotModels['User'] };
  BotSubscriptionUpdated: {
    user: BotModels['User'];
    invoice_payload: string;
    state: 'canceled' | 'active' | 'failed';
  };
  MessageGenerationStopped: {
    chat: BotModels['Chat'];
    message_thread_id?: number;
    draft_id: number;
  };
  PollOptionAdded: SharedFields['Fields37'];
  PollOptionDeleted: SharedFields['Fields37'];
  ChatBoostAdded: { boost_count: number };
  BackgroundFill:
    | BotModels['BackgroundFillSolid']
    | BotModels['BackgroundFillGradient']
    | BotModels['BackgroundFillFreeformGradient'];
  BackgroundFillSolid: { type: 'solid'; color: number };
  BackgroundFillGradient: {
    type: 'gradient';
    top_color: number;
    bottom_color: number;
    rotation_angle: number;
  };
  BackgroundFillFreeformGradient: {
    type: 'freeform_gradient';
    colors: Array<number>;
  };
  BackgroundType:
    | BotModels['BackgroundTypeFill']
    | BotModels['BackgroundTypeWallpaper']
    | BotModels['BackgroundTypePattern']
    | BotModels['BackgroundTypeChatTheme'];
  BackgroundTypeFill: {
    type: 'fill';
    fill: BotModels['BackgroundFill'];
    dark_theme_dimming: number;
  };
  BackgroundTypeWallpaper: {
    type: 'wallpaper';
    dark_theme_dimming: number;
    is_blurred?: true;
  } & SharedFields['Fields75'];
  BackgroundTypePattern: {
    type: 'pattern';
    fill: BotModels['BackgroundFill'];
    intensity: number;
    is_inverted?: true;
  } & SharedFields['Fields75'];
  BackgroundTypeChatTheme: { type: 'chat_theme'; theme_name: string };
  ChatBackground: { type: BotModels['BackgroundType'] };
  ChecklistTasksDone: {
    checklist_message?: BotModels['Message'];
    marked_as_done_task_ids?: Array<number>;
    marked_as_not_done_task_ids?: Array<number>;
  };
  ChecklistTasksAdded: {
    checklist_message?: BotModels['Message'];
    tasks: Array<BotModels['ChecklistTask']>;
  };
  CommunityChatAdded: { community: BotModels['Community'] };
  CommunityChatJoined: { community: BotModels['Community'] };
  CommunityChatRemoved: object;
  ForumTopicCreated: SharedFields['Fields38'];
  ForumTopicClosed: object;
  ForumTopicEdited: { name?: string; icon_custom_emoji_id?: string };
  ForumTopicReopened: object;
  GeneralForumTopicHidden: object;
  GeneralForumTopicUnhidden: object;
  SharedUser: {
    user_id: number;
    first_name?: string;
    last_name?: string;
  } & SharedFields['Fields76'];
  UsersShared: { request_id: number; users: Array<BotModels['SharedUser']> };
  ChatShared: {
    request_id: number;
    chat_id: number;
    title?: string;
  } & SharedFields['Fields76'];
  WriteAccessAllowed: {
    from_request?: boolean;
    web_app_name?: string;
    from_attachment_menu?: boolean;
  };
  VideoChatScheduled: { start_date: number };
  VideoChatStarted: object;
  VideoChatEnded: { duration: number };
  VideoChatParticipantsInvited: { users: Array<BotModels['User']> };
  PaidMessagePriceChanged: { paid_message_star_count: number };
  DirectMessagePriceChanged: {
    are_direct_messages_enabled: boolean;
    direct_message_star_count?: number;
  };
  SuggestedPostApproved: {
    suggested_post_message?: BotModels['Message'];
    price?: BotModels['SuggestedPostPrice'];
    send_date: number;
  };
  SuggestedPostApprovalFailed: {
    suggested_post_message?: BotModels['Message'];
    price: BotModels['SuggestedPostPrice'];
  };
  SuggestedPostDeclined: {
    suggested_post_message?: BotModels['Message'];
    comment?: string;
  };
  SuggestedPostPaid: {
    suggested_post_message?: BotModels['Message'];
    currency: 'XTR' | 'TON';
    amount?: number;
    star_amount?: BotModels['StarAmount'];
  };
  SuggestedPostRefunded: {
    suggested_post_message?: BotModels['Message'];
    reason: 'post_deleted' | 'payment_refunded';
  };
  GiveawayCreated: { prize_star_count?: number };
  Giveaway: {
    chats: Array<BotModels['Chat']>;
    has_public_winners?: true;
    country_codes?: Array<string>;
  } & SharedFields['Fields23'];
  GiveawayWinners: {
    chat: BotModels['Chat'];
    giveaway_message_id: number;
    winners: Array<BotModels['User']>;
    additional_chat_count?: number;
    unclaimed_prize_count?: number;
    was_refunded?: true;
  } & SharedFields['Fields23'];
}
