// Independently generated official Bot API method facts.
// Regenerate: node experiments/generate-bot-method-types.mjs
import type { BotModels } from '../bot-types/index.js';
import type { SharedMethodFields } from './shared.js';
export interface Methods0 {
  getUpdates: {
    params: {
      timeout?: number;
      allowed_updates?: ReadonlyArray<string>;
    } & SharedMethodFields['Fields43'];
    result: Array<BotModels['Update']>;
  };
  setWebhook: {
    params: {
      certificate?: BotModels['InputFile'];
      allowed_updates?: ReadonlyArray<string>;
      drop_pending_updates?: boolean;
      secret_token?: string;
    } & Pick<
      BotModels['WebhookInfo'],
      'url' | 'ip_address' | 'max_connections'
    >;
    result: true;
  };
  deleteWebhook: { params: { drop_pending_updates?: boolean }; result: true };
  getWebhookInfo: { params: object; result: BotModels['WebhookInfo'] };
  getMe: { params: object; result: BotModels['User'] };
  logOut: { params: object; result: true };
  close: { params: object; result: true };
  sendMessage: {
    params: { text: string } & SharedMethodFields['Fields7'] &
      SharedMethodFields['Fields44'];
    result: BotModels['Message'];
  };
  forwardMessage: {
    params: SharedMethodFields['Fields17'] & SharedMethodFields['Fields26'];
    result: BotModels['Message'];
  };
  forwardMessages: {
    params: SharedMethodFields['Fields16'];
    result: Array<BotModels['MessageId']>;
  };
  copyMessage: {
    params: SharedMethodFields['Fields8'] & SharedMethodFields['Fields26'];
    result: BotModels['MessageId'];
  };
  copyMessages: {
    params: { remove_caption?: boolean } & SharedMethodFields['Fields16'];
    result: Array<BotModels['MessageId']>;
  };
  sendPhoto: {
    params: SharedMethodFields['Fields2'];
    result: BotModels['Message'];
  };
  sendLivePhoto: {
    params: {
      live_photo: BotModels['InputFile'] | string;
    } & SharedMethodFields['Fields2'];
    result: BotModels['Message'];
  };
  sendAudio: {
    params: {
      audio: BotModels['InputFile'] | string;
      performer?: string;
      title?: string;
    } & SharedMethodFields['Fields3'];
    result: BotModels['Message'];
  };
  sendDocument: {
    params: {
      document: BotModels['InputFile'] | string;
      disable_content_type_detection?: boolean;
    } & SharedMethodFields['Fields4'];
    result: BotModels['Message'];
  };
  sendVideo: {
    params: {
      video: BotModels['InputFile'] | string;
      cover?: BotModels['InputFile'] | string;
      start_timestamp?: number;
      supports_streaming?: boolean;
    } & SharedMethodFields['Fields0'];
    result: BotModels['Message'];
  };
  sendAnimation: {
    params: {
      animation: BotModels['InputFile'] | string;
    } & SharedMethodFields['Fields0'];
    result: BotModels['Message'];
  };
  sendVoice: {
    params: {
      voice: BotModels['InputFile'] | string;
      duration?: number;
    } & SharedMethodFields['Fields5'];
    result: BotModels['Message'];
  };
  sendVideoNote: {
    params: {
      video_note: BotModels['InputFile'] | string;
      duration?: number;
      length?: number;
      thumbnail?: BotModels['InputFile'] | string;
    } & SharedMethodFields['Fields9'];
    result: BotModels['Message'];
  };
  sendPaidMedia: {
    params: {
      business_connection_id?: string;
      star_count: number;
      media: ReadonlyArray<BotModels['InputPaidMedia']>;
      payload?: string;
    } & SharedMethodFields['Fields8'];
    result: BotModels['Message'];
  };
  sendMediaGroup: {
    params: {
      media: ReadonlyArray<
        | BotModels['InputMediaAudio']
        | BotModels['InputMediaDocument']
        | BotModels['InputMediaLivePhoto']
        | BotModels['InputMediaPhoto']
        | BotModels['InputMediaVideo']
      >;
    } & SharedMethodFields['Fields12'];
    result: Array<BotModels['Message']>;
  };
  sendLocation: {
    params: SharedMethodFields['Fields6'] & SharedMethodFields['Fields27'];
    result: BotModels['Message'];
  };
  sendVenue: {
    params: SharedMethodFields['Fields6'] &
      Pick<
        BotModels['Venue'],
        | 'title'
        | 'address'
        | 'foursquare_id'
        | 'foursquare_type'
        | 'google_place_id'
        | 'google_place_type'
      >;
    result: BotModels['Message'];
  };
  sendContact: {
    params: {
      phone_number: string;
      vcard?: string;
    } & SharedMethodFields['Fields9'] &
      SharedMethodFields['Fields45'];
    result: BotModels['Message'];
  };
}
