// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
export interface SharedFields {
  Fields0: {
    link_preview_options?: BotModels['LinkPreviewOptions'];
    paid_media?: BotModels['PaidMediaInfo'];
    story?: BotModels['Story'];
    video_note?: BotModels['VideoNote'];
    voice?: BotModels['Voice'];
    has_media_spoiler?: true;
    checklist?: BotModels['Checklist'];
    contact?: BotModels['Contact'];
    dice?: BotModels['Dice'];
    game?: BotModels['Game'];
    poll?: BotModels['Poll'];
    invoice?: BotModels['Invoice'];
    giveaway?: BotModels['Giveaway'];
    giveaway_winners?: BotModels['GiveawayWinners'];
  } & SharedFields['Fields8'];
  Fields1: {
    is_anonymous: boolean;
    can_manage_chat: boolean;
    can_delete_messages: boolean;
    can_manage_video_chats: boolean;
    can_restrict_members: boolean;
    can_promote_members: boolean;
    can_post_stories: boolean;
    can_edit_stories: boolean;
    can_delete_stories: boolean;
    can_post_messages?: boolean;
    can_edit_messages?: boolean;
    can_manage_direct_messages?: boolean;
    can_manage_tags?: boolean;
    can_send_welcome_messages: boolean;
  } & SharedFields['Fields82'] &
    SharedFields['Fields83'];
  Fields2: {
    gift: BotModels['Gift'];
    owned_gift_id?: string;
    convert_star_count?: number;
    prepaid_upgrade_star_count?: number;
    is_upgrade_separate?: true;
    can_be_upgraded?: true;
    unique_gift_number?: number;
  } & SharedFields['Fields55'];
  Fields3: SharedFields['Fields24'] &
    SharedFields['Fields106'] &
    SharedFields['Fields115'];
  Fields4: { type: 'photo'; description?: string } & SharedFields['Fields14'];
  Fields5: {
    thumbnail_url: string;
    thumbnail_mime_type?: 'image/jpeg' | 'image/gif' | 'video/mp4';
  } & SharedFields['Fields14'];
  Fields6: {
    type: 'video';
    show_caption_above_media?: boolean;
  } & SharedFields['Fields16'];
  Fields7: SharedFields['Fields17'] & SharedFields['Fields99'];
  Fields8: {
    animation?: BotModels['Animation'];
    audio?: BotModels['Audio'];
    document?: BotModels['Document'];
    live_photo?: BotModels['LivePhoto'];
    location?: BotModels['Location'];
    photo?: Array<BotModels['PhotoSize']>;
    sticker?: BotModels['Sticker'];
    venue?: BotModels['Venue'];
    video?: BotModels['Video'];
  };
  Fields9: {
    url?: string;
    callback_data?: string;
    web_app?: BotModels['WebAppInfo'];
    login_url?: BotModels['LoginUrl'];
    switch_inline_query?: string;
    switch_inline_query_current_chat?: string;
    switch_inline_query_chosen_chat?: BotModels['SwitchInlineQueryChosenChat'];
    copy_text?: BotModels['CopyTextButton'];
    disabled?: BotModels['DisabledButton'];
  };
  Fields10: { type: 'venue' } & SharedFields['Fields15'];
  Fields11: { type: 'document' } & SharedFields['Fields16'];
  Fields12: {
    type: 'private' | 'group' | 'supergroup' | 'channel';
    title?: string;
    first_name?: string;
    is_forum?: true;
    is_direct_messages?: true;
  } & SharedFields['Fields44'];
  Fields13: { type: 'voice' } & SharedFields['Fields19'];
  Fields14: {
    title?: string;
    show_caption_above_media?: boolean;
  } & SharedFields['Fields29'];
  Fields15: SharedFields['Fields22'] & SharedFields['Fields116'];
  Fields16: { description?: string } & SharedFields['Fields19'];
  Fields17: { duration: number } & SharedFields['Fields20'];
  Fields18: { type: 'audio' } & SharedFields['Fields29'];
  Fields19: { title: string } & SharedFields['Fields29'];
  Fields20: {
    thumbnail?: BotModels['PhotoSize'];
    file_name?: string;
    mime_type?: string;
  } & SharedFields['Fields48'];
  Fields21: {
    horizontal_accuracy?: number;
    live_period?: number;
    heading?: number;
    proximity_alert_radius?: number;
  } & SharedFields['Fields116'];
  Fields22: {
    title: string;
    address: string;
    foursquare_id?: string;
    foursquare_type?: string;
    google_place_id?: string;
    google_place_type?: string;
  };
  Fields23: {
    winners_selection_date: number;
    winner_count: number;
    only_new_members?: true;
    prize_description?: string;
    prize_star_count?: number;
    premium_subscription_month_count?: number;
  };
  Fields24: { duration?: number } & SharedFields['Fields31'];
  Fields25: SharedFields['Fields42'] & SharedFields['Fields115'];
  Fields26: {
    type: 'table';
    cells: Array<Array<BotModels['RichBlockTableCell']>>;
    is_bordered?: true;
    is_striped?: true;
    is_compact?: true;
    caption?: BotModels['RichText'];
  };
  Fields27: { title: string } & SharedFields['Fields33'];
  Fields28: {
    input_message_content?: BotModels['InputMessageContent'];
  } & SharedFields['Fields33'];
  Fields29: {
    id: string;
    parse_mode?: string;
    input_message_content?: BotModels['InputMessageContent'];
  } & SharedFields['Fields45'];
  Fields30: SharedFields['Fields48'] & SharedFields['Fields99'];
  Fields31: {
    thumbnail?: string | BotModels['InputFile'];
  } & SharedFields['Fields42'];
  Fields32: {
    currency: string;
    shipping_option_id?: string;
    order_info?: BotModels['OrderInfo'];
  } & SharedFields['Fields110'];
  Fields33: SharedFields['Fields65'] & SharedFields['Fields108'];
  Fields34: { author_signature?: string } & SharedFields['Fields52'];
  Fields35: { duration: number } & SharedFields['Fields48'];
  Fields36: {
    phone_number: string;
    first_name: string;
    last_name?: string;
    vcard?: string;
  };
  Fields37: {
    poll_message?: BotModels['MaybeInaccessibleMessage'];
    option_persistent_id: string;
    option_text: string;
    option_text_entities?: Array<BotModels['MessageEntity']>;
  };
  Fields38: {
    name: string;
    icon_color: number;
    icon_custom_emoji_id?: string;
    is_name_implicit?: true;
  };
  Fields39: {
    chat: BotModels['Chat'];
    from: BotModels['User'];
    date: number;
    invite_link?: BotModels['ChatInviteLink'];
  };
  Fields40: {
    gift: BotModels['UniqueGift'];
    owned_gift_id?: string;
    transfer_star_count?: number;
    next_transfer_date?: number;
  };
  Fields41: {
    type: 'video';
    cover?: string | BotModels['InputFile'];
    start_timestamp?: number;
    supports_streaming?: boolean;
  };
  Fields42: {
    media: string | BotModels['InputFile'];
    parse_mode?: string;
  } & SharedFields['Fields117'];
  Fields43: {
    has_checkbox?: true;
    is_checked?: true;
    value?: number;
    type?: 'a' | 'A' | 'i' | 'I' | '1';
  };
  Fields44: { id: number; last_name?: string; username?: string };
  Fields45: {
    reply_markup?: BotModels['InlineKeyboardMarkup'];
  } & SharedFields['Fields117'];
  Fields46: { duration?: number } & SharedFields['Fields106'];
  Fields47: { id: number } & SharedFields['Fields73'];
  Fields48: { file_size?: number } & SharedFields['Fields111'];
  Fields49: {
    text: string;
    icon_custom_emoji_id?: string;
    style?: 'danger' | 'success' | 'primary';
  };
  Fields50: {
    request_id: number;
    request_username?: boolean;
    request_photo?: boolean;
  };
  Fields51: { type: 'location' } & SharedFields['Fields116'];
  Fields52: { date: number } & SharedFields['Fields69'];
  Fields53: { center_color: number; edge_color: number; text_color: number };
  Fields54: { sticker: BotModels['Sticker'] } & SharedFields['Fields87'];
  Fields55: { is_private?: true } & SharedFields['Fields68'];
  Fields56: {
    sender_user?: BotModels['User'];
    send_date: number;
    is_saved?: true;
  };
  Fields57: { type: 'heading'; text: BotModels['RichText']; size: number };
  Fields58: { type: 'pre'; text: BotModels['RichText']; language?: string };
  Fields59: { type: 'expandable_blockquote' } & SharedFields['Fields94'];
  Fields60: { type: 'pullquote' } & SharedFields['Fields94'];
  Fields61: { type: 'details'; summary: BotModels['RichText']; is_open?: true };
  Fields62: {
    type: 'map';
    location: BotModels['Location'];
    caption?: BotModels['RichBlockCaption'];
  };
  Fields63: {
    type: 'buttons';
    buttons: Array<BotModels['RichMessageButton']>;
    align?: 'left' | 'center' | 'right';
  };
  Fields64: {
    from: BotModels['User'];
    query: string;
    location?: BotModels['Location'];
  };
  Fields65: {
    thumbnail_url?: string;
    thumbnail_width?: number;
    thumbnail_height?: number;
  };
  Fields66: { currency: string } & SharedFields['Fields114'];
  Fields67: {
    type: 'passport' | 'driver_license' | 'identity_card' | 'internal_passport';
  } & SharedFields['Fields112'];
  Fields68: { text?: string; entities?: Array<BotModels['MessageEntity']> };
  Fields69: { chat: BotModels['Chat']; message_id: number };
  Fields70: { performer?: string; title?: string };
  Fields71: { type: 'photo'; photo: Array<BotModels['PhotoSize']> };
  Fields72: { type: 'video'; video: BotModels['Video'] };
  Fields73: { text: string; text_entities?: Array<BotModels['MessageEntity']> };
  Fields74: {
    title: string;
    title_entities?: Array<BotModels['MessageEntity']>;
  };
  Fields75: { document: BotModels['Document']; is_moving?: true };
  Fields76: { username?: string; photo?: Array<BotModels['PhotoSize']> };
  Fields77: { price?: BotModels['SuggestedPostPrice']; send_date?: number };
  Fields78: { input_field_placeholder?: string; selective?: boolean };
  Fields79: { id: string; from: BotModels['User'] };
  Fields80: { user: BotModels['User']; custom_title?: string };
  Fields81: { tag?: string; user: BotModels['User'] };
  Fields82: { can_change_info: boolean; can_invite_users: boolean };
  Fields83: { can_pin_messages?: boolean; can_manage_topics?: boolean };
  Fields84: { type: 'link'; url: string };
  Fields85: { type: 'custom_emoji'; custom_emoji_id: string };
  Fields86: { is_premium?: true; publisher_chat?: BotModels['Chat'] };
  Fields87: { name: string; rarity_per_mille: number };
  Fields88: { amount: number; nanostar_amount?: number };
  Fields89: { boost_id: string; source: BotModels['ChatBoostSource'] };
  Fields90: { id: string; date: number };
  Fields91: { type: 'live_photo'; photo: string | BotModels['InputFile'] };
  Fields92: { type: 'mathematical_expression'; expression: string };
  Fields93: { type: 'anchor'; name: string };
  Fields94: { text: BotModels['RichText']; credit?: BotModels['RichText'] };
  Fields95: { type: 'paragraph'; text: BotModels['RichText'] };
  Fields96: { type: 'footer'; text: BotModels['RichText'] };
  Fields97: { type: 'blockquote'; credit?: BotModels['RichText'] };
  Fields98: {
    blocks: Array<BotModels['RichBlock']>;
    caption?: BotModels['RichBlockCaption'];
  };
  Fields99: { width: number; height: number };
  Fields100: { has_spoiler?: true; caption?: BotModels['RichBlockCaption'] };
  Fields101: { type: 'audio'; caption?: BotModels['RichBlockCaption'] };
  Fields102: { type: 'document'; caption?: BotModels['RichBlockCaption'] };
  Fields103: { type: 'voice_note'; caption?: BotModels['RichBlockCaption'] };
  Fields104: { type: 'thinking'; text: BotModels['RichText'] };
  Fields105: {
    blocks: Array<BotModels['InputRichBlock']>;
    caption?: BotModels['RichBlockCaption'];
  };
  Fields106: { width?: number; height?: number };
  Fields107: { photo_width?: number; photo_height?: number };
  Fields108: { id: string; reply_markup?: BotModels['InlineKeyboardMarkup'] };
  Fields109: { phone_number?: string; email?: string };
  Fields110: { total_amount: number; invoice_payload: string };
  Fields111: { file_id: string; file_unique_id: string };
  Fields112: { file_hash: string; message: string };
  Fields113: { file_hashes: Array<string>; message: string };
  Fields114: { title: string; description: string };
  Fields115: { show_caption_above_media?: boolean; has_spoiler?: boolean };
  Fields116: { latitude: number; longitude: number };
  Fields117: {
    caption?: string;
    caption_entities?: Array<BotModels['MessageEntity']>;
  };
}
