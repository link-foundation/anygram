// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods5 {
  convertGiftToStars: { params: SharedMethodFields['Fields57']; result: true };
  upgradeGift: {
    params: {
      keep_original_details?: boolean;
    } & SharedMethodFields['Fields36'];
    result: true;
  };
  transferGift: {
    params: {
      new_owner_chat_id: number | bigint;
    } & SharedMethodFields['Fields36'];
    result: true;
  };
  postStory: {
    params: SharedMethodFields['Fields18'] & SharedMethodFields['Fields37'];
    result: BotModels['Story'];
  };
  repostStory: {
    params: {
      business_connection_id: string;
      from_chat_id: number | bigint;
      from_story_id: number;
    } & SharedMethodFields['Fields37'];
    result: BotModels['Story'];
  };
  editStory: {
    params: { story_id: number } & SharedMethodFields['Fields18'];
    result: BotModels['Story'];
  };
  deleteStory: {
    params: { business_connection_id: string; story_id: number };
    result: true;
  };
  answerWebAppQuery: {
    params: {
      web_app_query_id: string;
      result: BotModels['InlineQueryResult'];
    };
    result: BotModels['SentWebAppMessage'];
  };
  savePreparedInlineMessage: {
    params: { user_id: number; result: BotModels['InlineQueryResult'] } & Pick<
      BotModels['SwitchInlineQueryChosenChat'],
      | 'allow_user_chats'
      | 'allow_bot_chats'
      | 'allow_group_chats'
      | 'allow_channel_chats'
    >;
    result: BotModels['PreparedInlineMessage'];
  };
  savePreparedKeyboardButton: {
    params: { user_id: number; button: BotModels['KeyboardButton'] };
    result: BotModels['PreparedKeyboardButton'];
  };
  editMessageText: {
    params: SharedMethodFields['Fields19'] & SharedMethodFields['Fields28'];
    result: BotModels['Message'] | true;
  };
  editMessageCaption: {
    params: SharedMethodFields['Fields19'] & SharedMethodFields['Fields38'];
    result: BotModels['Message'] | true;
  };
  editMessageMedia: {
    params: { media: BotModels['InputMedia'] } & SharedMethodFields['Fields23'];
    result: BotModels['Message'] | true;
  };
  editMessageLiveLocation: {
    params: SharedMethodFields['Fields23'] &
      SharedMethodFields['Fields27'] &
      SharedMethodFields['Fields58'];
    result: BotModels['Message'] | true;
  };
  stopMessageLiveLocation: {
    params: SharedMethodFields['Fields23'];
    result: BotModels['Message'] | true;
  };
  editMessageChecklist: {
    params: SharedMethodFields['Fields31'] & SharedMethodFields['Fields47'];
    result: BotModels['Message'];
  };
  editMessageReplyMarkup: {
    params: SharedMethodFields['Fields23'];
    result: BotModels['Message'] | true;
  };
  stopPoll: {
    params: {
      reply_markup?: BotModels['InlineKeyboardMarkup'];
    } & SharedMethodFields['Fields34'];
    result: BotModels['Poll'];
  };
  editEphemeralMessageText: {
    params: SharedMethodFields['Fields24'] & SharedMethodFields['Fields28'];
    result: true;
  };
  editEphemeralMessageMedia: {
    params: { media: BotModels['InputMedia'] } & SharedMethodFields['Fields29'];
    result: true;
  };
  editEphemeralMessageCaption: {
    params: SharedMethodFields['Fields24'] & SharedMethodFields['Fields38'];
    result: true;
  };
  editEphemeralMessageReplyMarkup: {
    params: SharedMethodFields['Fields29'];
    result: true;
  };
  approveSuggestedPost: {
    params: { send_date?: number } & SharedMethodFields['Fields55'];
    result: true;
  };
  declineSuggestedPost: {
    params: { comment?: string } & SharedMethodFields['Fields55'];
    result: true;
  };
  deleteMessage: { params: SharedMethodFields['Fields47']; result: true };
}
