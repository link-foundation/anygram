// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods3 {
  unpinAllForumTopicMessages: {
    params: SharedMethodFields['Fields53'];
    result: true;
  };
  editGeneralForumTopic: {
    params: SharedMethodFields['Fields52'];
    result: true;
  };
  closeGeneralForumTopic: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  reopenGeneralForumTopic: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  hideGeneralForumTopic: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  unhideGeneralForumTopic: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  unpinAllGeneralForumTopicMessages: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  answerCallbackQuery: {
    params: {
      callback_query_id: string;
      text?: string;
      show_alert?: boolean;
      url?: string;
      cache_time?: number;
    };
    result: true;
  };
  answerGuestQuery: {
    params: { guest_query_id: string; result: BotModels['InlineQueryResult'] };
    result: BotModels['SentGuestMessage'];
  };
  getUserChatBoosts: {
    params: SharedMethodFields['Fields48'];
    result: BotModels['UserChatBoosts'];
  };
  getBusinessConnection: {
    params: { business_connection_id: string };
    result: BotModels['BusinessConnection'];
  };
  getManagedBotToken: { params: { user_id: number }; result: string };
  replaceManagedBotToken: { params: { user_id: number }; result: string };
  getManagedBotAccessSettings: {
    params: { user_id: number };
    result: BotModels['BotAccessSettings'];
  };
  setManagedBotAccessSettings: {
    params: {
      user_id: number;
      is_access_restricted: boolean;
      added_user_ids?: ReadonlyArray<number>;
    };
    result: true;
  };
  setMyCommands: {
    params: {
      commands: ReadonlyArray<BotModels['BotCommand']>;
    } & SharedMethodFields['Fields54'];
    result: true;
  };
  deleteMyCommands: { params: SharedMethodFields['Fields54']; result: true };
  getMyCommands: {
    params: SharedMethodFields['Fields54'];
    result: Array<BotModels['BotCommand']>;
  };
  setMyName: {
    params: { name?: string; language_code?: string };
    result: true;
  };
  getMyName: {
    params: { language_code?: string };
    result: BotModels['BotName'];
  };
  setMyDescription: {
    params: { description?: string; language_code?: string };
    result: true;
  };
  getMyDescription: {
    params: { language_code?: string };
    result: BotModels['BotDescription'];
  };
  setMyShortDescription: {
    params: { short_description?: string; language_code?: string };
    result: true;
  };
  getMyShortDescription: {
    params: { language_code?: string };
    result: BotModels['BotShortDescription'];
  };
  setMyProfilePhoto: {
    params: { photo: BotModels['InputProfilePhoto'] };
    result: true;
  };
}
