// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
export interface SharedMethodFields {
  Fields0: { width?: number; height?: number } & SharedMethodFields['Fields3'] &
    SharedMethodFields['Fields63'];
  Fields1: {
    prices: ReadonlyArray<BotModels['LabeledPrice']>;
    suggested_tip_amounts?: ReadonlyArray<number>;
  } & Pick<
    BotModels['InputInvoiceMessageContent'],
    | 'title'
    | 'description'
    | 'payload'
    | 'provider_token'
    | 'currency'
    | 'max_tip_amount'
    | 'provider_data'
    | 'photo_url'
    | 'photo_size'
    | 'photo_width'
    | 'photo_height'
    | 'need_name'
    | 'need_phone_number'
    | 'need_email'
    | 'need_shipping_address'
    | 'send_phone_number_to_provider'
    | 'send_email_to_provider'
    | 'is_flexible'
  >;
  Fields2: {
    photo: BotModels['InputFile'] | string;
  } & SharedMethodFields['Fields5'] &
    SharedMethodFields['Fields63'];
  Fields3: { duration?: number } & SharedMethodFields['Fields4'];
  Fields4: {
    thumbnail?: BotModels['InputFile'] | string;
  } & SharedMethodFields['Fields5'];
  Fields5: SharedMethodFields['Fields7'] & SharedMethodFields['Fields64'];
  Fields6: SharedMethodFields['Fields9'] & SharedMethodFields['Fields58'];
  Fields7: { parse_mode?: string } & SharedMethodFields['Fields9'];
  Fields8: { parse_mode?: string } & SharedMethodFields['Fields15'] &
    SharedMethodFields['Fields38'] &
    SharedMethodFields['Fields66'];
  Fields9: {
    ephemeral_message_parameters?: BotModels['EphemeralMessageParameters'];
  } & SharedMethodFields['Fields10'];
  Fields10: {
    suggested_post_parameters?: BotModels['SuggestedPostParameters'];
  } & SharedMethodFields['Fields12'] &
    SharedMethodFields['Fields66'];
  Fields11: {
    exclude_unsaved?: boolean;
    exclude_saved?: boolean;
  } & SharedMethodFields['Fields14'];
  Fields12: {
    direct_messages_topic_id?: number;
  } & SharedMethodFields['Fields13'];
  Fields13: {
    business_connection_id?: string;
    message_thread_id?: number;
    allow_paid_broadcast?: boolean;
  } & SharedMethodFields['Fields20'];
  Fields14: {
    exclude_unlimited?: boolean;
    exclude_limited_upgradable?: boolean;
    exclude_limited_non_upgradable?: boolean;
    exclude_from_blockchain?: boolean;
    exclude_unique?: boolean;
    sort_by_price?: boolean;
    offset?: string;
    limit?: number;
  };
  Fields15: {
    allow_paid_broadcast?: boolean;
    reply_parameters?: BotModels['ReplyParameters'];
  } & SharedMethodFields['Fields17'];
  Fields16: {
    from_chat_id: number | string | bigint;
    message_ids: ReadonlyArray<number>;
  } & SharedMethodFields['Fields25'];
  Fields17: {
    suggested_post_parameters?: BotModels['SuggestedPostParameters'];
  } & SharedMethodFields['Fields25'];
  Fields18: {
    business_connection_id: string;
    content: BotModels['InputStoryContent'];
    parse_mode?: string;
    areas?: ReadonlyArray<BotModels['StoryArea']>;
  } & SharedMethodFields['Fields64'];
  Fields19: { parse_mode?: string } & SharedMethodFields['Fields23'];
  Fields20: {
    message_effect_id?: string;
    reply_parameters?: BotModels['ReplyParameters'];
  } & SharedMethodFields['Fields42'];
  Fields21: {
    chat_id: number | bigint;
    message_thread_id?: number;
    draft_id: number;
    can_stop?: boolean;
    keep_on_stop?: boolean;
  };
  Fields22: {
    expire_date?: number;
    member_limit?: number;
    creates_join_request?: boolean;
  } & SharedMethodFields['Fields51'];
  Fields23: {
    business_connection_id?: string;
    chat_id?: number | string | bigint;
    reply_markup?: BotModels['InlineKeyboardMarkup'];
  } & SharedMethodFields['Fields65'];
  Fields24: { parse_mode?: string } & SharedMethodFields['Fields29'];
  Fields25: {
    message_thread_id?: number;
    direct_messages_topic_id?: number;
  } & SharedMethodFields['Fields42'];
  Fields26: {
    from_chat_id: number | string | bigint;
    video_start_timestamp?: number;
    message_effect_id?: string;
    message_id: number;
  };
  Fields27: Pick<
    BotModels['Location'],
    'horizontal_accuracy' | 'live_period' | 'heading' | 'proximity_alert_radius'
  >;
  Fields28: {
    text?: string;
    rich_message?: BotModels['InputRichMessage'];
  } & SharedMethodFields['Fields44'];
  Fields29: {
    reply_markup?: BotModels['InlineKeyboardMarkup'];
  } & SharedMethodFields['Fields39'];
  Fields30: {
    user_id: number;
    chat_id?: number | bigint;
  } & SharedMethodFields['Fields65'];
  Fields31: {
    business_connection_id: string;
    checklist: BotModels['InputChecklist'];
    reply_markup?: BotModels['InlineKeyboardMarkup'];
  };
  Fields32: { user_id: number } & SharedMethodFields['Fields43'];
  Fields33: { until_date?: number } & SharedMethodFields['Fields48'];
  Fields34: { message_id: number } & SharedMethodFields['Fields46'];
  Fields35: {
    text?: string;
    text_parse_mode?: string;
    text_entities?: ReadonlyArray<BotModels['MessageEntity']>;
  };
  Fields36: { star_count?: number } & SharedMethodFields['Fields57'];
  Fields37: {
    active_period: number;
    post_to_chat_page?: boolean;
    protect_content?: boolean;
  };
  Fields38: {
    show_caption_above_media?: boolean;
  } & SharedMethodFields['Fields64'];
  Fields39: {
    chat_id: number | string | bigint;
    receiver_user_id: number;
    ephemeral_message_id: number;
  };
  Fields40: {
    chat_id: number | string | bigint;
    user_id?: number;
    actor_chat_id?: number | bigint;
  };
  Fields41: {
    sticker: BotModels['InputSticker'];
  } & SharedMethodFields['Fields60'];
  Fields42: {
    chat_id: number | string | bigint;
    disable_notification?: boolean;
    protect_content?: boolean;
  };
  Fields43: { offset?: number; limit?: number };
  Fields44: {
    entities?: ReadonlyArray<BotModels['MessageEntity']>;
    link_preview_options?: BotModels['LinkPreviewOptions'];
  };
  Fields45: { first_name: string; last_name?: string };
  Fields46: {
    business_connection_id?: string;
    chat_id: number | string | bigint;
  };
  Fields47: { chat_id: number | string | bigint; message_id: number };
  Fields48: { chat_id: number | string | bigint; user_id: number };
  Fields49: {
    permissions: BotModels['ChatPermissions'];
    use_independent_chat_permissions?: boolean;
  };
  Fields50: {
    chat_id: number | string | bigint;
    sender_chat_id: number | bigint;
  };
  Fields51: { chat_id: number | string | bigint; name?: string };
  Fields52: { chat_id: number | string | bigint; name: string };
  Fields53: { chat_id: number | string | bigint; message_thread_id: number };
  Fields54: { scope?: BotModels['BotCommandScope']; language_code?: string };
  Fields55: { chat_id: number | bigint; message_id: number };
  Fields56: { business_connection_id: string; is_public?: boolean };
  Fields57: { business_connection_id: string; owned_gift_id: string };
  Fields58: { latitude: number; longitude: number };
  Fields59: { name: string; title: string };
  Fields60: { name: string; user_id: number };
  Fields61: { ok: boolean; error_message?: string };
  Fields62: { user_id: number; telegram_payment_charge_id: string };
  Fields63: { show_caption_above_media?: boolean; has_spoiler?: boolean };
  Fields64: {
    caption?: string;
    caption_entities?: ReadonlyArray<BotModels['MessageEntity']>;
  };
  Fields65: { message_id?: number; inline_message_id?: string };
  Fields66: {
    reply_markup?:
      | BotModels['InlineKeyboardMarkup']
      | BotModels['ReplyKeyboardMarkup']
      | BotModels['ReplyKeyboardRemove']
      | BotModels['ForceReply'];
  };
}
