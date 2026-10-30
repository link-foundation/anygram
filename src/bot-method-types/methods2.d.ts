// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods2 {
  approveChatJoinRequest: {
    params: SharedMethodFields['Fields48'];
    result: true;
  };
  declineChatJoinRequest: {
    params: SharedMethodFields['Fields48'];
    result: true;
  };
  answerChatJoinRequestQuery: {
    params: { chat_join_request_query_id: string; result: string };
    result: true;
  };
  sendChatJoinRequestWebApp: {
    params: { chat_join_request_query_id: string; web_app_url: string };
    result: true;
  };
  setChatPhoto: {
    params: {
      chat_id: number | string | bigint;
      photo: BotModels['InputFile'];
    };
    result: true;
  };
  deleteChatPhoto: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  setChatTitle: {
    params: { chat_id: number | string | bigint; title: string };
    result: true;
  };
  setChatDescription: {
    params: { chat_id: number | string | bigint; description?: string };
    result: true;
  };
  pinChatMessage: {
    params: { disable_notification?: boolean } & SharedMethodFields['Fields34'];
    result: true;
  };
  unpinChatMessage: {
    params: { message_id?: number } & SharedMethodFields['Fields46'];
    result: true;
  };
  unpinAllChatMessages: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  leaveChat: { params: { chat_id: number | string | bigint }; result: true };
  getChat: {
    params: { chat_id: number | string | bigint };
    result: BotModels['ChatFullInfo'];
  };
  getChatAdministrators: {
    params: { chat_id: number | string | bigint; return_bots?: boolean };
    result: Array<BotModels['ChatMember']>;
  };
  getChatMemberCount: {
    params: { chat_id: number | string | bigint };
    result: number;
  };
  getChatMember: {
    params: SharedMethodFields['Fields48'];
    result: BotModels['ChatMember'];
  };
  getUserPersonalChatMessages: {
    params: { user_id: number; limit: number };
    result: Array<BotModels['Message']>;
  };
  setChatStickerSet: {
    params: { chat_id: number | string | bigint; sticker_set_name: string };
    result: true;
  };
  deleteChatStickerSet: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  getForumTopicIconStickers: {
    params: object;
    result: Array<BotModels['Sticker']>;
  };
  createForumTopic: {
    params: {
      icon_color?: number;
      icon_custom_emoji_id?: string;
    } & SharedMethodFields['Fields52'];
    result: BotModels['ForumTopic'];
  };
  editForumTopic: {
    params: {
      message_thread_id: number;
      icon_custom_emoji_id?: string;
    } & SharedMethodFields['Fields51'];
    result: true;
  };
  closeForumTopic: { params: SharedMethodFields['Fields53']; result: true };
  reopenForumTopic: { params: SharedMethodFields['Fields53']; result: true };
  deleteForumTopic: { params: SharedMethodFields['Fields53']; result: true };
}
