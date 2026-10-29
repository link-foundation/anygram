// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods4 {
  removeMyProfilePhoto: { params: object; result: true };
  setChatMenuButton: {
    params: {
      chat_id?: number | bigint;
      menu_button?: BotModels['MenuButton'];
    };
    result: true;
  };
  getChatMenuButton: {
    params: { chat_id?: number | bigint };
    result: BotModels['MenuButton'];
  };
  setMyDefaultAdministratorRights: {
    params: {
      rights?: BotModels['ChatAdministratorRights'];
      for_channels?: boolean;
    };
    result: true;
  };
  getMyDefaultAdministratorRights: {
    params: { for_channels?: boolean };
    result: BotModels['ChatAdministratorRights'];
  };
  getAvailableGifts: { params: object; result: BotModels['Gifts'] };
  sendGift: {
    params: {
      user_id?: number;
      chat_id?: number | string | bigint;
      gift_id: string;
      pay_for_upgrade?: boolean;
    } & SharedMethodFields['Fields35'];
    result: true;
  };
  giftPremiumSubscription: {
    params: {
      user_id: number;
      month_count: number;
      star_count: number;
    } & SharedMethodFields['Fields35'];
    result: true;
  };
  verifyUser: {
    params: { user_id: number; custom_description?: string };
    result: true;
  };
  verifyChat: {
    params: { chat_id: number | string | bigint; custom_description?: string };
    result: true;
  };
  removeUserVerification: { params: { user_id: number }; result: true };
  removeChatVerification: {
    params: { chat_id: number | string | bigint };
    result: true;
  };
  readBusinessMessage: {
    params: { business_connection_id: string } & SharedMethodFields['Fields55'];
    result: true;
  };
  deleteBusinessMessages: {
    params: {
      business_connection_id: string;
      message_ids: ReadonlyArray<number>;
    };
    result: true;
  };
  setBusinessAccountName: {
    params: { business_connection_id: string } & SharedMethodFields['Fields45'];
    result: true;
  };
  setBusinessAccountUsername: {
    params: { business_connection_id: string; username?: string };
    result: true;
  };
  setBusinessAccountBio: {
    params: { business_connection_id: string; bio?: string };
    result: true;
  };
  setBusinessAccountProfilePhoto: {
    params: {
      photo: BotModels['InputProfilePhoto'];
    } & SharedMethodFields['Fields56'];
    result: true;
  };
  removeBusinessAccountProfilePhoto: {
    params: SharedMethodFields['Fields56'];
    result: true;
  };
  setBusinessAccountGiftSettings: {
    params: {
      business_connection_id: string;
      show_gift_button: boolean;
      accepted_gift_types: BotModels['AcceptedGiftTypes'];
    };
    result: true;
  };
  getBusinessAccountStarBalance: {
    params: { business_connection_id: string };
    result: BotModels['StarAmount'];
  };
  transferBusinessAccountStars: {
    params: { business_connection_id: string; star_count: number };
    result: true;
  };
  getBusinessAccountGifts: {
    params: { business_connection_id: string } & SharedMethodFields['Fields11'];
    result: BotModels['OwnedGifts'];
  };
  getUserGifts: {
    params: { user_id: number } & SharedMethodFields['Fields14'];
    result: BotModels['OwnedGifts'];
  };
  getChatGifts: {
    params: {
      chat_id: number | string | bigint;
    } & SharedMethodFields['Fields11'];
    result: BotModels['OwnedGifts'];
  };
}
