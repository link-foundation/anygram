// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models2 {
  GiveawayCompleted: {
    winner_count: number;
    unclaimed_prize_count?: number;
    giveaway_message?: BotModels['Message'];
    is_star_giveaway?: true;
  };
  LinkPreviewOptions: {
    is_disabled?: boolean;
    url?: string;
    prefer_small_media?: boolean;
    prefer_large_media?: boolean;
    show_above_text?: boolean;
  };
  SuggestedPostPrice: { currency: 'XTR' | 'TON'; amount: number };
  SuggestedPostInfo: {
    state: 'pending' | 'approved' | 'declined';
  } & SharedFields['Fields77'];
  SuggestedPostParameters: SharedFields['Fields77'];
  DirectMessagesTopic: { topic_id: number; user?: BotModels['User'] };
  UserProfilePhotos: {
    total_count: number;
    photos: Array<Array<BotModels['PhotoSize']>>;
  };
  UserProfileAudios: { total_count: number; audios: Array<BotModels['Audio']> };
  File: { file_path?: string } & SharedFields['Fields48'];
  WebAppInfo: { url: string };
  ReplyKeyboardMarkup: {
    keyboard: Array<Array<BotModels['KeyboardButton']>>;
    is_persistent?: boolean;
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
    force_reply?: boolean;
  } & SharedFields['Fields78'];
  KeyboardButton:
    | ({
        request_users?: BotModels['KeyboardButtonRequestUsers'];
        request_chat?: BotModels['KeyboardButtonRequestChat'];
        request_managed_bot?: BotModels['KeyboardButtonRequestManagedBot'];
        request_contact?: boolean;
        request_location?: boolean;
        request_poll?: BotModels['KeyboardButtonPollType'];
        web_app?: BotModels['WebAppInfo'];
      } & SharedFields['Fields49'])
    | string;
  KeyboardButtonRequestUsers: {
    user_is_bot?: boolean;
    user_is_premium?: boolean;
    max_quantity?: number;
    request_name?: boolean;
  } & SharedFields['Fields50'];
  KeyboardButtonRequestChat: {
    chat_is_channel: boolean;
    chat_is_forum?: boolean;
    chat_has_username?: boolean;
    chat_is_created?: boolean;
    user_administrator_rights?: BotModels['ChatAdministratorRights'];
    bot_administrator_rights?: BotModels['ChatAdministratorRights'];
    bot_is_member?: boolean;
    request_title?: boolean;
  } & SharedFields['Fields50'];
  KeyboardButtonRequestManagedBot: {
    request_id: number;
    suggested_name?: string;
    suggested_username?: string;
  };
  KeyboardButtonPollType: { type?: string };
  ReplyKeyboardRemove: { remove_keyboard: true; selective?: boolean };
  InlineKeyboardMarkup: {
    inline_keyboard: Array<Array<BotModels['InlineKeyboardButton']>>;
    force_reply?: boolean;
  };
  InlineKeyboardButton: {
    callback_game?: BotModels['CallbackGame'];
    pay?: boolean;
  } & SharedFields['Fields9'] &
    SharedFields['Fields49'];
  LoginUrl: {
    url: string;
    forward_text?: string;
    bot_username?: string;
    request_write_access?: boolean;
  };
  SwitchInlineQueryChosenChat: {
    query?: string;
    allow_user_chats?: boolean;
    allow_bot_chats?: boolean;
    allow_group_chats?: boolean;
    allow_channel_chats?: boolean;
  };
  CopyTextButton: { text: string };
  DisabledButton: object;
  CallbackQuery: {
    message?: BotModels['MaybeInaccessibleMessage'];
    inline_message_id?: string;
    chat_instance: string;
    data?: string;
    game_short_name?: string;
  } & SharedFields['Fields79'];
  ForceReply: { force_reply: true } & SharedFields['Fields78'];
  Community: { id: number; name: string };
  ChatPhoto: {
    small_file_id: string;
    small_file_unique_id: string;
    big_file_id: string;
    big_file_unique_id: string;
  };
  ChatInviteLink: {
    invite_link: string;
    creator: BotModels['User'];
    creates_join_request: boolean;
    is_primary: boolean;
    is_revoked: boolean;
    name?: string;
    expire_date?: number;
    member_limit?: number;
    pending_join_request_count?: number;
    subscription_period?: number;
    subscription_price?: number;
  };
  ChatAdministratorRights: SharedFields['Fields1'];
  ChatMemberUpdated: {
    old_chat_member: BotModels['ChatMember'];
    new_chat_member: BotModels['ChatMember'];
    via_join_request?: boolean;
    via_chat_folder_invite_link?: boolean;
  } & SharedFields['Fields39'];
  ChatMember:
    | BotModels['ChatMemberOwner']
    | BotModels['ChatMemberAdministrator']
    | BotModels['ChatMemberMember']
    | BotModels['ChatMemberRestricted']
    | BotModels['ChatMemberLeft']
    | BotModels['ChatMemberBanned'];
  ChatMemberOwner: {
    status: 'creator';
    is_anonymous: boolean;
  } & SharedFields['Fields80'];
  ChatMemberAdministrator: {
    status: 'administrator';
    can_be_edited: boolean;
  } & SharedFields['Fields1'] &
    SharedFields['Fields80'];
  ChatMemberMember: {
    status: 'member';
    until_date?: number;
  } & SharedFields['Fields81'];
  ChatMemberRestricted: {
    status: 'restricted';
    is_member: boolean;
    can_send_messages: boolean;
    can_send_audios: boolean;
    can_send_documents: boolean;
    can_send_photos: boolean;
    can_send_videos: boolean;
    can_send_video_notes: boolean;
    can_send_voice_notes: boolean;
    can_send_polls: boolean;
    can_send_other_messages: boolean;
    can_add_web_page_previews: boolean;
    can_react_to_messages: boolean;
    can_edit_tag: boolean;
    can_pin_messages: boolean;
    can_manage_topics: boolean;
    until_date: number;
  } & SharedFields['Fields81'] &
    SharedFields['Fields82'];
  ChatMemberLeft: { status: 'left'; user: BotModels['User'] };
  ChatMemberBanned: {
    status: 'kicked';
    user: BotModels['User'];
    until_date: number;
  };
  ChatJoinRequest: {
    user_chat_id: number;
    bio?: string;
    query_id?: string;
  } & SharedFields['Fields39'];
  ChatPermissions: {
    can_send_messages?: boolean;
    can_send_audios?: boolean;
    can_send_documents?: boolean;
    can_send_photos?: boolean;
    can_send_videos?: boolean;
    can_send_video_notes?: boolean;
    can_send_voice_notes?: boolean;
    can_send_polls?: boolean;
    can_send_other_messages?: boolean;
    can_add_web_page_previews?: boolean;
    can_react_to_messages?: boolean;
    can_edit_tag?: boolean;
    can_change_info?: boolean;
    can_invite_users?: boolean;
  } & SharedFields['Fields83'];
  Birthdate: { day: number; month: number; year?: number };
  BusinessIntro: {
    title?: string;
    message?: string;
    sticker?: BotModels['Sticker'];
  };
  BusinessLocation: { address: string; location?: BotModels['Location'] };
  BusinessOpeningHoursInterval: {
    opening_minute: number;
    closing_minute: number;
  };
  BusinessOpeningHours: {
    time_zone_name: string;
    opening_hours: Array<BotModels['BusinessOpeningHoursInterval']>;
  };
  UserRating: {
    level: number;
    rating: number;
    current_level_rating: number;
    next_level_rating?: number;
  };
  StoryAreaPosition: {
    x_percentage: number;
    y_percentage: number;
    width_percentage: number;
    height_percentage: number;
    rotation_angle: number;
    corner_radius_percentage: number;
  };
  LocationAddress: {
    country_code: string;
    state?: string;
    city?: string;
    street?: string;
  };
  StoryAreaType:
    | BotModels['StoryAreaTypeLocation']
    | BotModels['StoryAreaTypeSuggestedReaction']
    | BotModels['StoryAreaTypeLink']
    | BotModels['StoryAreaTypeWeather']
    | BotModels['StoryAreaTypeUniqueGift'];
  StoryAreaTypeLocation: {
    address?: BotModels['LocationAddress'];
  } & SharedFields['Fields51'];
  StoryAreaTypeSuggestedReaction: {
    type: 'suggested_reaction';
    reaction_type: BotModels['ReactionType'];
    is_dark?: boolean;
    is_flipped?: boolean;
  };
}
