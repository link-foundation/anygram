// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models3 {
  StoryAreaTypeLink: SharedFields['Fields84'];
  StoryAreaTypeWeather: {
    type: 'weather';
    temperature: number;
    emoji: string;
    background_color: number;
  };
  StoryAreaTypeUniqueGift: { type: 'unique_gift'; name: string };
  StoryArea: {
    position: BotModels['StoryAreaPosition'];
    type: BotModels['StoryAreaType'];
  };
  ChatLocation: { location: BotModels['Location']; address: string };
  ReactionType:
    | BotModels['ReactionTypeEmoji']
    | BotModels['ReactionTypeCustomEmoji']
    | BotModels['ReactionTypePaid'];
  ReactionTypeEmoji: {
    type: 'emoji';
    emoji:
      | '❤'
      | '👍'
      | '👎'
      | '🔥'
      | '🥰'
      | '👏'
      | '😁'
      | '🤔'
      | '🤯'
      | '😱'
      | '🤬'
      | '😢'
      | '🎉'
      | '🤩'
      | '🤮'
      | '💩'
      | '🙏'
      | '👌'
      | '🕊'
      | '🤡'
      | '🥱'
      | '🥴'
      | '😍'
      | '🐳'
      | '❤‍🔥'
      | '🌚'
      | '🌭'
      | '💯'
      | '🤣'
      | '⚡'
      | '🍌'
      | '🏆'
      | '💔'
      | '🤨'
      | '😐'
      | '🍓'
      | '🍾'
      | '💋'
      | '🖕'
      | '😈'
      | '😴'
      | '😭'
      | '🤓'
      | '👻'
      | '👨‍💻'
      | '👀'
      | '🎃'
      | '🙈'
      | '😇'
      | '😨'
      | '🤝'
      | '✍'
      | '🤗'
      | '🫡'
      | '🎅'
      | '🎄'
      | '☃'
      | '💅'
      | '🤪'
      | '🗿'
      | '🆒'
      | '💘'
      | '🙉'
      | '🦄'
      | '😘'
      | '💊'
      | '🙊'
      | '😎'
      | '👾'
      | '🤷‍♂'
      | '🤷'
      | '🤷‍♀'
      | '😡';
  };
  ReactionTypeCustomEmoji: SharedFields['Fields85'];
  ReactionTypePaid: { type: 'paid' };
  ReactionCount: { type: BotModels['ReactionType']; total_count: number };
  MessageReactionUpdated: {
    user?: BotModels['User'];
    actor_chat?: BotModels['Chat'];
    old_reaction: Array<BotModels['ReactionType']>;
    new_reaction: Array<BotModels['ReactionType']>;
  } & SharedFields['Fields52'];
  MessageReactionCountUpdated: {
    reactions: Array<BotModels['ReactionCount']>;
  } & SharedFields['Fields52'];
  ForumTopic: { message_thread_id: number } & SharedFields['Fields38'];
  GiftBackground: SharedFields['Fields53'];
  Gift: {
    id: string;
    sticker: BotModels['Sticker'];
    star_count: number;
    upgrade_star_count?: number;
    has_colors?: true;
    total_count?: number;
    remaining_count?: number;
    personal_total_count?: number;
    personal_remaining_count?: number;
    background?: BotModels['GiftBackground'];
    unique_gift_variant_count?: number;
  } & SharedFields['Fields86'];
  Gifts: { gifts: Array<BotModels['Gift']> };
  UniqueGiftModel: {
    rarity?: 'uncommon' | 'rare' | 'epic' | 'legendary';
  } & SharedFields['Fields54'];
  UniqueGiftSymbol: SharedFields['Fields54'];
  UniqueGiftBackdropColors: { symbol_color: number } & SharedFields['Fields53'];
  UniqueGiftBackdrop: {
    colors: BotModels['UniqueGiftBackdropColors'];
  } & SharedFields['Fields87'];
  UniqueGiftColors: {
    model_custom_emoji_id: string;
    symbol_custom_emoji_id: string;
    light_theme_main_color: number;
    light_theme_other_colors: Array<number>;
    dark_theme_main_color: number;
    dark_theme_other_colors: Array<number>;
  };
  UniqueGift: {
    gift_id: string;
    base_name: string;
    name: string;
    number: number;
    model: BotModels['UniqueGiftModel'];
    symbol: BotModels['UniqueGiftSymbol'];
    backdrop: BotModels['UniqueGiftBackdrop'];
    is_burned?: true;
    is_from_blockchain?: true;
    colors?: BotModels['UniqueGiftColors'];
  } & SharedFields['Fields86'];
  GiftInfo: SharedFields['Fields2'];
  UniqueGiftInfo: {
    origin: string;
    last_resale_currency?: 'XTR' | 'TON';
    last_resale_amount?: number;
  } & SharedFields['Fields40'] &
    SharedFields['Fields55'];
  OwnedGift: BotModels['OwnedGiftRegular'] | BotModels['OwnedGiftUnique'];
  OwnedGiftRegular: {
    type: 'regular';
    was_refunded?: true;
  } & SharedFields['Fields2'] &
    SharedFields['Fields56'];
  OwnedGiftUnique: {
    type: 'unique';
    can_be_transferred?: true;
  } & SharedFields['Fields40'] &
    SharedFields['Fields56'];
  OwnedGifts: {
    total_count: number;
    gifts: Array<BotModels['OwnedGift']>;
    next_offset?: string;
  };
  BotAccessSettings: {
    is_access_restricted: boolean;
    added_users?: Array<BotModels['User']>;
  };
  AcceptedGiftTypes: {
    unlimited_gifts: boolean;
    limited_gifts: boolean;
    unique_gifts: boolean;
    premium_subscription: boolean;
    gifts_from_channels: boolean;
  };
  StarAmount: SharedFields['Fields88'];
  BotCommand: { command: string; description: string; is_ephemeral?: boolean };
  BotCommandScope:
    | BotModels['BotCommandScopeDefault']
    | BotModels['BotCommandScopeAllPrivateChats']
    | BotModels['BotCommandScopeAllGroupChats']
    | BotModels['BotCommandScopeAllChatAdministrators']
    | BotModels['BotCommandScopeChat']
    | BotModels['BotCommandScopeChatAdministrators']
    | BotModels['BotCommandScopeChatMember'];
  BotCommandScopeDefault: { type: 'default' };
  BotCommandScopeAllPrivateChats: { type: 'all_private_chats' };
  BotCommandScopeAllGroupChats: { type: 'all_group_chats' };
  BotCommandScopeAllChatAdministrators: { type: 'all_chat_administrators' };
  BotCommandScopeChat: { type: 'chat'; chat_id: number | string };
  BotCommandScopeChatAdministrators: {
    type: 'chat_administrators';
    chat_id: number | string;
  };
  BotCommandScopeChatMember: {
    type: 'chat_member';
    chat_id: number | string;
    user_id: number;
  };
  BotName: { name: string };
  BotDescription: { description: string };
  BotShortDescription: { short_description: string };
  MenuButton:
    | BotModels['MenuButtonCommands']
    | BotModels['MenuButtonWebApp']
    | BotModels['MenuButtonDefault'];
  MenuButtonCommands: { type: 'commands' };
  MenuButtonWebApp: {
    type: 'web_app';
    text: string;
    web_app: BotModels['WebAppInfo'];
  };
  MenuButtonDefault: { type: 'default' };
  ChatBoostSource:
    | BotModels['ChatBoostSourcePremium']
    | BotModels['ChatBoostSourceGiftCode']
    | BotModels['ChatBoostSourceGiveaway'];
  ChatBoostSourcePremium: { source: 'premium'; user: BotModels['User'] };
  ChatBoostSourceGiftCode: { source: 'gift_code'; user: BotModels['User'] };
}
