// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods6 {
  deleteMessages: {
    params: {
      chat_id: number | string | bigint;
      message_ids: ReadonlyArray<number>;
    };
    result: true;
  };
  deleteEphemeralMessage: {
    params: SharedMethodFields['Fields39'];
    result: true;
  };
  deleteMessageReaction: {
    params: { message_id: number } & SharedMethodFields['Fields40'];
    result: true;
  };
  deleteAllMessageReactions: {
    params: SharedMethodFields['Fields40'];
    result: true;
  };
  sendSticker: {
    params: {
      sticker: BotModels['InputFile'] | string;
      emoji?: string;
    } & SharedMethodFields['Fields9'];
    result: BotModels['Message'];
  };
  getStickerSet: { params: { name: string }; result: BotModels['StickerSet'] };
  getCustomEmojiStickers: {
    params: { custom_emoji_ids: ReadonlyArray<string> };
    result: Array<BotModels['Sticker']>;
  };
  uploadStickerFile: {
    params: {
      user_id: number;
      sticker: BotModels['InputFile'];
      sticker_format: 'static' | 'animated' | 'video';
    };
    result: BotModels['File'];
  };
  createNewStickerSet: {
    params: {
      user_id: number;
      stickers: ReadonlyArray<BotModels['InputSticker']>;
      sticker_type?: string;
      needs_repainting?: boolean;
    } & SharedMethodFields['Fields59'];
    result: true;
  };
  addStickerToSet: { params: SharedMethodFields['Fields41']; result: true };
  setStickerPositionInSet: {
    params: { sticker: string; position: number };
    result: true;
  };
  deleteStickerFromSet: { params: { sticker: string }; result: true };
  replaceStickerInSet: {
    params: { old_sticker: string } & SharedMethodFields['Fields41'];
    result: true;
  };
  setStickerEmojiList: {
    params: { sticker: string; emoji_list: ReadonlyArray<string> };
    result: true;
  };
  setStickerKeywords: {
    params: { sticker: string; keywords?: ReadonlyArray<string> };
    result: true;
  };
  setStickerMaskPosition: {
    params: { sticker: string; mask_position?: BotModels['MaskPosition'] };
    result: true;
  };
  setStickerSetTitle: { params: SharedMethodFields['Fields59']; result: true };
  setStickerSetThumbnail: {
    params: {
      thumbnail?: BotModels['InputFile'] | string;
      format: 'static' | 'animated' | 'video';
    } & SharedMethodFields['Fields60'];
    result: true;
  };
  setCustomEmojiStickerSetThumbnail: {
    params: { name: string; custom_emoji_id?: string };
    result: true;
  };
  deleteStickerSet: { params: { name: string }; result: true };
  sendRichMessage: {
    params: {
      rich_message: BotModels['InputRichMessage'];
    } & SharedMethodFields['Fields9'];
    result: BotModels['Message'];
  };
  sendRichMessageDraft: {
    params: {
      rich_message: BotModels['InputRichMessage'];
    } & SharedMethodFields['Fields21'];
    result: true;
  };
  answerInlineQuery: {
    params: {
      inline_query_id: string;
      results: ReadonlyArray<BotModels['InlineQueryResult']>;
      cache_time?: number;
      is_personal?: boolean;
      next_offset?: string;
      button?: BotModels['InlineQueryResultsButton'];
    };
    result: true;
  };
  sendInvoice: {
    params: {
      start_parameter?: string;
      message_effect_id?: string;
      reply_markup?: BotModels['InlineKeyboardMarkup'];
    } & SharedMethodFields['Fields1'] &
      SharedMethodFields['Fields15'];
    result: BotModels['Message'];
  };
  createInvoiceLink: {
    params: {
      business_connection_id?: string;
      subscription_period?: number;
    } & SharedMethodFields['Fields1'];
    result: string;
  };
}
