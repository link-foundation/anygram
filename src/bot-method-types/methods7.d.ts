// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods7 {
  answerShippingQuery: {
    params: {
      shipping_query_id: string;
      shipping_options?: ReadonlyArray<BotModels['ShippingOption']>;
    } & SharedMethodFields['Fields61'];
    result: true;
  };
  answerPreCheckoutQuery: {
    params: { pre_checkout_query_id: string } & SharedMethodFields['Fields61'];
    result: true;
  };
  getMyStarBalance: { params: object; result: BotModels['StarAmount'] };
  getStarTransactions: {
    params: SharedMethodFields['Fields43'];
    result: BotModels['StarTransactions'];
  };
  refundStarPayment: { params: SharedMethodFields['Fields62']; result: true };
  editUserStarSubscription: {
    params: { is_canceled: boolean } & SharedMethodFields['Fields62'];
    result: true;
  };
  setPassportDataErrors: {
    params: {
      user_id: number;
      errors: ReadonlyArray<BotModels['PassportElementError']>;
    };
    result: true;
  };
  sendGame: {
    params: {
      game_short_name: string;
      reply_markup?: BotModels['InlineKeyboardMarkup'];
    } & SharedMethodFields['Fields13'];
    result: BotModels['Message'];
  };
  setGameScore: {
    params: {
      score: number;
      force?: boolean;
      disable_edit_message?: boolean;
    } & SharedMethodFields['Fields30'];
    result: BotModels['Message'] | true;
  };
  getGameHighScores: {
    params: SharedMethodFields['Fields30'];
    result: Array<BotModels['GameHighScore']>;
  };
}
