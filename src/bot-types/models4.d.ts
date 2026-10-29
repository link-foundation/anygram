// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models4 {
  ChatBoostSourceGiveaway: {
    source: 'giveaway';
    giveaway_message_id: number;
    user?: BotModels['User'];
    prize_star_count?: number;
    is_unclaimed?: true;
  };
  ChatBoost: {
    add_date: number;
    expiration_date: number;
  } & SharedFields['Fields89'];
  ChatBoostUpdated: { chat: BotModels['Chat']; boost: BotModels['ChatBoost'] };
  ChatBoostRemoved: {
    chat: BotModels['Chat'];
    remove_date: number;
  } & SharedFields['Fields89'];
  ChatOwnerLeft: { new_owner?: BotModels['User'] };
  ChatOwnerChanged: { new_owner: BotModels['User'] };
  UserChatBoosts: { boosts: Array<BotModels['ChatBoost']> };
  BusinessBotRights: {
    can_reply?: true;
    can_read_messages?: true;
    can_delete_sent_messages?: true;
    can_delete_all_messages?: true;
    can_edit_name?: true;
    can_edit_bio?: true;
    can_edit_profile_photo?: true;
    can_edit_username?: true;
    can_change_gift_settings?: true;
    can_view_gifts_and_stars?: true;
    can_convert_gifts_to_stars?: true;
    can_transfer_and_upgrade_gifts?: true;
    can_transfer_stars?: true;
    can_manage_stories?: true;
  };
  BusinessConnection: {
    user: BotModels['User'];
    user_chat_id: number;
    rights?: BotModels['BusinessBotRights'];
    is_enabled: boolean;
  } & SharedFields['Fields90'];
  BusinessMessagesDeleted: {
    business_connection_id: string;
    chat: BotModels['Chat'];
    message_ids: Array<number>;
  };
  SentWebAppMessage: { inline_message_id?: string };
  SentGuestMessage: { inline_message_id: string };
  PreparedInlineMessage: { id: string; expiration_date: number };
  PreparedKeyboardButton: { id: string };
  ResponseParameters: { migrate_to_chat_id?: number; retry_after?: number };
  InputMedia:
    | BotModels['InputMediaAnimation']
    | BotModels['InputMediaAudio']
    | BotModels['InputMediaDocument']
    | BotModels['InputMediaLivePhoto']
    | BotModels['InputMediaPhoto']
    | BotModels['InputMediaVideo'];
  InputMediaAnimation: { type: 'animation' } & SharedFields['Fields3'];
  InputMediaAudio: { type: 'audio' } & SharedFields['Fields24'] &
    SharedFields['Fields70'];
  InputMediaDocument: {
    type: 'document';
    disable_content_type_detection?: boolean;
  } & SharedFields['Fields31'];
  InputMediaLink: SharedFields['Fields84'];
  InputMediaLivePhoto: SharedFields['Fields25'] & SharedFields['Fields91'];
  InputMediaLocation: {
    horizontal_accuracy?: number;
  } & SharedFields['Fields51'];
  InputMediaPhoto: { type: 'photo' } & SharedFields['Fields25'];
  InputMediaSticker: {
    type: 'sticker';
    media: string | BotModels['InputFile'];
    emoji?: string;
  };
  InputMediaVenue: SharedFields['Fields10'];
  InputMediaVideo: SharedFields['Fields3'] & SharedFields['Fields41'];
  InputMediaVoiceNote: {
    type: 'voice_note';
    duration?: number;
  } & SharedFields['Fields42'];
  InputFile: import('../index.js').InputFile;
  InputPaidMedia:
    | BotModels['InputPaidMediaLivePhoto']
    | BotModels['InputPaidMediaPhoto']
    | BotModels['InputPaidMediaVideo'];
  InputPaidMediaLivePhoto: {
    media: string | BotModels['InputFile'];
  } & SharedFields['Fields91'];
  InputPaidMediaPhoto: {
    type: 'photo';
    media: string | BotModels['InputFile'];
  };
  InputPaidMediaVideo: {
    media: string | BotModels['InputFile'];
    thumbnail?: string | BotModels['InputFile'];
  } & SharedFields['Fields41'] &
    SharedFields['Fields46'];
  InputProfilePhoto:
    | BotModels['InputProfilePhotoStatic']
    | BotModels['InputProfilePhotoAnimated'];
  InputProfilePhotoStatic: {
    type: 'static';
    photo: string | BotModels['InputFile'];
  };
  InputProfilePhotoAnimated: {
    type: 'animated';
    animation: string | BotModels['InputFile'];
    main_frame_timestamp?: number;
  };
  InputStoryContent:
    | BotModels['InputStoryContentPhoto']
    | BotModels['InputStoryContentVideo'];
  InputStoryContentPhoto: {
    type: 'photo';
    photo: string | BotModels['InputFile'];
  };
  InputStoryContentVideo: {
    type: 'video';
    video: string | BotModels['InputFile'];
    duration?: number;
    cover_frame_timestamp?: number;
    is_animation?: boolean;
  };
  Sticker: {
    type: 'regular' | 'mask' | 'custom_emoji';
    is_animated: boolean;
    is_video: boolean;
    thumbnail?: BotModels['PhotoSize'];
    emoji?: string;
    set_name?: string;
    premium_animation?: BotModels['File'];
    mask_position?: BotModels['MaskPosition'];
    custom_emoji_id?: string;
    needs_repainting?: true;
  } & SharedFields['Fields30'];
  StickerSet: {
    name: string;
    title: string;
    sticker_type: 'regular' | 'mask' | 'custom_emoji';
    stickers: Array<BotModels['Sticker']>;
    thumbnail?: BotModels['PhotoSize'];
  };
  MaskPosition: {
    point: 'forehead' | 'eyes' | 'mouth' | 'chin';
    x_shift: number;
    y_shift: number;
    scale: number;
  };
  InputSticker: {
    sticker: string | BotModels['InputFile'];
    format: 'static' | 'animated' | 'video';
    emoji_list: Array<string>;
    mask_position?: BotModels['MaskPosition'];
    keywords?: Array<string>;
  };
  RichMessage: { blocks: Array<BotModels['RichBlock']>; is_rtl?: boolean };
  InputRichMessage: {
    blocks?: Array<BotModels['InputRichBlock']>;
    html?: string;
    markdown?: string;
    media?: Array<BotModels['InputRichMessageMedia']>;
    is_rtl?: boolean;
    skip_entity_detection?: boolean;
  };
  InputRichMessageMedia: {
    id: string;
    media:
      | BotModels['InputMediaAnimation']
      | BotModels['InputMediaAudio']
      | BotModels['InputMediaDocument']
      | BotModels['InputMediaPhoto']
      | BotModels['InputMediaVideo']
      | BotModels['InputMediaVoiceNote'];
  };
  RichMessageButton: {
    text: BotModels['RichText'];
    style?: 'danger' | 'success' | 'primary' | 'link';
  } & SharedFields['Fields9'];
  RichText:
    | string
    | import('./index.js').RichTextArray
    | BotModels['RichTextBold']
    | BotModels['RichTextItalic']
    | BotModels['RichTextUnderline']
    | BotModels['RichTextStrikethrough']
    | BotModels['RichTextSpoiler']
    | BotModels['RichTextDateTime']
    | BotModels['RichTextTextMention']
    | BotModels['RichTextSubscript']
    | BotModels['RichTextSuperscript']
    | BotModels['RichTextMarked']
    | BotModels['RichTextCode']
    | BotModels['RichTextCustomEmoji']
    | BotModels['RichTextMathematicalExpression']
    | BotModels['RichTextUrl']
    | BotModels['RichTextEmailAddress']
    | BotModels['RichTextPhoneNumber']
    | BotModels['RichTextBankCardNumber']
    | BotModels['RichTextMention']
    | BotModels['RichTextHashtag']
    | BotModels['RichTextCashtag']
    | BotModels['RichTextBotCommand']
    | BotModels['RichTextButton']
    | BotModels['RichTextAnchor']
    | BotModels['RichTextAnchorLink']
    | BotModels['RichTextReference']
    | BotModels['RichTextReferenceLink'];
  RichTextBold: { type: 'bold'; text: BotModels['RichText'] };
  RichTextItalic: { type: 'italic'; text: BotModels['RichText'] };
  RichTextUnderline: { type: 'underline'; text: BotModels['RichText'] };
}
