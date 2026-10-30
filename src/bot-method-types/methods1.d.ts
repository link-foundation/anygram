// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods1 {
  sendPoll: {
    params: {
      question_parse_mode?: string;
      question_entities?: ReadonlyArray<BotModels['MessageEntity']>;
      options: ReadonlyArray<BotModels['InputPollOption']>;
      is_anonymous?: boolean;
      type?: string;
      allows_multiple_answers?: boolean;
      allows_revoting?: boolean;
      shuffle_options?: boolean;
      allow_adding_options?: boolean;
      hide_results_until_closes?: boolean;
      members_only?: boolean;
      country_codes?: ReadonlyArray<string>;
      correct_option_ids?: ReadonlyArray<number>;
      explanation_parse_mode?: string;
      explanation_entities?: ReadonlyArray<BotModels['MessageEntity']>;
      explanation_media?: BotModels['InputPollMedia'];
      is_closed?: boolean;
      description_parse_mode?: string;
      description_entities?: ReadonlyArray<BotModels['MessageEntity']>;
      media?: BotModels['InputPollMedia'];
    } & SharedMethodFields['Fields13'] &
      SharedMethodFields['Fields66'] &
      Pick<
        BotModels['Poll'],
        | 'question'
        | 'explanation'
        | 'open_period'
        | 'close_date'
        | 'description'
      >;
    result: BotModels['Message'];
  };
  sendChecklist: {
    params: SharedMethodFields['Fields20'] & SharedMethodFields['Fields31'];
    result: BotModels['Message'];
  };
  sendDice: {
    params: {
      emoji?: '🎲' | '🎯' | '🏀' | '⚽' | '🎳' | '🎰';
    } & SharedMethodFields['Fields10'];
    result: BotModels['Message'];
  };
  sendMessageDraft: {
    params: {
      text?: string;
      parse_mode?: string;
      entities?: ReadonlyArray<BotModels['MessageEntity']>;
    } & SharedMethodFields['Fields21'];
    result: true;
  };
  sendChatAction: {
    params: {
      message_thread_id?: number;
      action: string;
    } & SharedMethodFields['Fields46'];
    result: true;
  };
  setMessageReaction: {
    params: {
      reaction?: ReadonlyArray<BotModels['ReactionType']>;
      is_big?: boolean;
    } & SharedMethodFields['Fields47'];
    result: true;
  };
  getUserProfilePhotos: {
    params: SharedMethodFields['Fields32'];
    result: BotModels['UserProfilePhotos'];
  };
  getUserProfileAudios: {
    params: SharedMethodFields['Fields32'];
    result: BotModels['UserProfileAudios'];
  };
  setUserEmojiStatus: {
    params: {
      user_id: number;
      emoji_status_custom_emoji_id?: string;
      emoji_status_expiration_date?: number;
    };
    result: true;
  };
  getFile: { params: { file_id: string }; result: BotModels['File'] };
  banChatMember: {
    params: { revoke_messages?: boolean } & SharedMethodFields['Fields33'];
    result: true;
  };
  unbanChatMember: {
    params: { only_if_banned?: boolean } & SharedMethodFields['Fields48'];
    result: true;
  };
  restrictChatMember: {
    params: SharedMethodFields['Fields33'] & SharedMethodFields['Fields49'];
    result: true;
  };
  promoteChatMember: {
    params: {
      is_anonymous?: boolean;
      can_manage_chat?: boolean;
      can_delete_messages?: boolean;
      can_manage_video_chats?: boolean;
      can_restrict_members?: boolean;
      can_promote_members?: boolean;
      can_change_info?: boolean;
      can_invite_users?: boolean;
      can_post_stories?: boolean;
      can_edit_stories?: boolean;
      can_delete_stories?: boolean;
      can_send_welcome_messages?: boolean;
    } & SharedMethodFields['Fields48'] &
      Pick<
        BotModels['ChatAdministratorRights'],
        | 'can_post_messages'
        | 'can_edit_messages'
        | 'can_pin_messages'
        | 'can_manage_topics'
        | 'can_manage_direct_messages'
        | 'can_manage_tags'
      >;
    result: true;
  };
  setChatAdministratorCustomTitle: {
    params: { custom_title: string } & SharedMethodFields['Fields48'];
    result: true;
  };
  setChatMemberTag: {
    params: { tag?: string } & SharedMethodFields['Fields48'];
    result: true;
  };
  banChatSenderChat: { params: SharedMethodFields['Fields50']; result: true };
  unbanChatSenderChat: { params: SharedMethodFields['Fields50']; result: true };
  setChatPermissions: {
    params: {
      chat_id: number | string | bigint;
    } & SharedMethodFields['Fields49'];
    result: true;
  };
  exportChatInviteLink: {
    params: { chat_id: number | string | bigint };
    result: string;
  };
  createChatInviteLink: {
    params: SharedMethodFields['Fields22'];
    result: BotModels['ChatInviteLink'];
  };
  editChatInviteLink: {
    params: { invite_link: string } & SharedMethodFields['Fields22'];
    result: BotModels['ChatInviteLink'];
  };
  createChatSubscriptionInviteLink: {
    params: {
      subscription_period: number;
      subscription_price: number;
    } & SharedMethodFields['Fields51'];
    result: BotModels['ChatInviteLink'];
  };
  editChatSubscriptionInviteLink: {
    params: { invite_link: string } & SharedMethodFields['Fields51'];
    result: BotModels['ChatInviteLink'];
  };
  revokeChatInviteLink: {
    params: { chat_id: number | string | bigint; invite_link: string };
    result: BotModels['ChatInviteLink'];
  };
}
