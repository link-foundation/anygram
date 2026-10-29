// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models7 {
  InputMessageContent:
    | BotModels['InputTextMessageContent']
    | BotModels['InputRichMessageContent']
    | BotModels['InputLocationMessageContent']
    | BotModels['InputVenueMessageContent']
    | BotModels['InputContactMessageContent']
    | BotModels['InputInvoiceMessageContent'];
  InputTextMessageContent: {
    message_text: string;
    parse_mode?: string;
    entities?: Array<BotModels['MessageEntity']>;
    link_preview_options?: BotModels['LinkPreviewOptions'];
  };
  InputRichMessageContent: { rich_message: BotModels['InputRichMessage'] };
  InputLocationMessageContent: SharedFields['Fields21'];
  InputVenueMessageContent: SharedFields['Fields15'];
  InputContactMessageContent: SharedFields['Fields36'];
  InputInvoiceMessageContent: {
    payload: string;
    provider_token?: string;
    prices: Array<BotModels['LabeledPrice']>;
    max_tip_amount?: number;
    suggested_tip_amounts?: Array<number>;
    provider_data?: string;
    photo_url?: string;
    photo_size?: number;
    need_name?: boolean;
    need_phone_number?: boolean;
    need_email?: boolean;
    need_shipping_address?: boolean;
    send_phone_number_to_provider?: boolean;
    send_email_to_provider?: boolean;
    is_flexible?: boolean;
  } & SharedFields['Fields66'] &
    SharedFields['Fields107'];
  ChosenInlineResult: {
    result_id: string;
    inline_message_id?: string;
  } & SharedFields['Fields64'];
  LabeledPrice: { label: string; amount: number };
  Invoice: {
    start_parameter: string;
    total_amount: number;
  } & SharedFields['Fields66'];
  ShippingAddress: {
    country_code: string;
    state: string;
    city: string;
    street_line1: string;
    street_line2: string;
    post_code: string;
  };
  OrderInfo: {
    name?: string;
    shipping_address?: BotModels['ShippingAddress'];
  } & SharedFields['Fields109'];
  ShippingOption: {
    id: string;
    title: string;
    prices: Array<BotModels['LabeledPrice']>;
  };
  SuccessfulPayment: {
    subscription_expiration_date?: number;
    is_recurring?: true;
    is_first_recurring?: true;
    telegram_payment_charge_id: string;
    provider_payment_charge_id: string;
  } & SharedFields['Fields32'];
  RefundedPayment: {
    currency: 'XTR';
    telegram_payment_charge_id: string;
    provider_payment_charge_id?: string;
  } & SharedFields['Fields110'];
  ShippingQuery: {
    invoice_payload: string;
    shipping_address: BotModels['ShippingAddress'];
  } & SharedFields['Fields79'];
  PreCheckoutQuery: SharedFields['Fields32'] & SharedFields['Fields79'];
  PaidMediaPurchased: { from: BotModels['User']; paid_media_payload: string };
  RevenueWithdrawalState:
    | BotModels['RevenueWithdrawalStatePending']
    | BotModels['RevenueWithdrawalStateSucceeded']
    | BotModels['RevenueWithdrawalStateFailed'];
  RevenueWithdrawalStatePending: { type: 'pending' };
  RevenueWithdrawalStateSucceeded: {
    type: 'succeeded';
    date: number;
    url: string;
  };
  RevenueWithdrawalStateFailed: { type: 'failed' };
  AffiliateInfo: {
    affiliate_user?: BotModels['User'];
    affiliate_chat?: BotModels['Chat'];
    commission_per_mille: number;
  } & SharedFields['Fields88'];
  TransactionPartner:
    | BotModels['TransactionPartnerUser']
    | BotModels['TransactionPartnerChat']
    | BotModels['TransactionPartnerAffiliateProgram']
    | BotModels['TransactionPartnerFragment']
    | BotModels['TransactionPartnerTelegramAds']
    | BotModels['TransactionPartnerTelegramApi']
    | BotModels['TransactionPartnerOther'];
  TransactionPartnerUser: {
    type: 'user';
    transaction_type:
      | 'invoice_payment'
      | 'paid_media_payment'
      | 'gift_purchase'
      | 'premium_purchase'
      | 'business_account_transfer';
    user: BotModels['User'];
    affiliate?: BotModels['AffiliateInfo'];
    invoice_payload?: string;
    subscription_period?: number;
    paid_media?: Array<BotModels['PaidMedia']>;
    paid_media_payload?: string;
    gift?: BotModels['Gift'];
    premium_subscription_duration?: number;
  };
  TransactionPartnerChat: {
    type: 'chat';
    chat: BotModels['Chat'];
    gift?: BotModels['Gift'];
  };
  TransactionPartnerAffiliateProgram: {
    type: 'affiliate_program';
    sponsor_user?: BotModels['User'];
    commission_per_mille: number;
  };
  TransactionPartnerFragment: {
    type: 'fragment';
    withdrawal_state?: BotModels['RevenueWithdrawalState'];
  };
  TransactionPartnerTelegramAds: { type: 'telegram_ads' };
  TransactionPartnerTelegramApi: {
    type: 'telegram_api';
    request_count: number;
  };
  TransactionPartnerOther: { type: 'other' };
  StarTransaction: {
    source?: BotModels['TransactionPartner'];
    receiver?: BotModels['TransactionPartner'];
  } & SharedFields['Fields88'] &
    SharedFields['Fields90'];
  StarTransactions: { transactions: Array<BotModels['StarTransaction']> };
  PassportData: {
    data: Array<BotModels['EncryptedPassportElement']>;
    credentials: BotModels['EncryptedCredentials'];
  };
  PassportFile: {
    file_size: number;
    file_date: number;
  } & SharedFields['Fields111'];
  EncryptedPassportElement: {
    type:
      | 'personal_details'
      | 'passport'
      | 'driver_license'
      | 'identity_card'
      | 'internal_passport'
      | 'address'
      | 'utility_bill'
      | 'bank_statement'
      | 'rental_agreement'
      | 'passport_registration'
      | 'temporary_registration'
      | 'phone_number'
      | 'email';
    data?: string;
    files?: Array<BotModels['PassportFile']>;
    front_side?: BotModels['PassportFile'];
    reverse_side?: BotModels['PassportFile'];
    selfie?: BotModels['PassportFile'];
    translation?: Array<BotModels['PassportFile']>;
    hash: string;
  } & SharedFields['Fields109'];
  EncryptedCredentials: { data: string; hash: string; secret: string };
  PassportElementError:
    | BotModels['PassportElementErrorDataField']
    | BotModels['PassportElementErrorFrontSide']
    | BotModels['PassportElementErrorReverseSide']
    | BotModels['PassportElementErrorSelfie']
    | BotModels['PassportElementErrorFile']
    | BotModels['PassportElementErrorFiles']
    | BotModels['PassportElementErrorTranslationFile']
    | BotModels['PassportElementErrorTranslationFiles']
    | BotModels['PassportElementErrorUnspecified'];
  PassportElementErrorDataField: {
    source: 'data';
    type:
      | 'personal_details'
      | 'passport'
      | 'driver_license'
      | 'identity_card'
      | 'internal_passport'
      | 'address';
    field_name: string;
    data_hash: string;
    message: string;
  };
  PassportElementErrorFrontSide: {
    source: 'front_side';
  } & SharedFields['Fields67'];
  PassportElementErrorReverseSide: {
    source: 'reverse_side';
    type: 'driver_license' | 'identity_card';
  } & SharedFields['Fields112'];
  PassportElementErrorSelfie: { source: 'selfie' } & SharedFields['Fields67'];
  PassportElementErrorFile: {
    source: 'file';
    type:
      | 'utility_bill'
      | 'bank_statement'
      | 'rental_agreement'
      | 'passport_registration'
      | 'temporary_registration';
  } & SharedFields['Fields112'];
  PassportElementErrorFiles: {
    source: 'files';
    type:
      | 'utility_bill'
      | 'bank_statement'
      | 'rental_agreement'
      | 'passport_registration'
      | 'temporary_registration';
  } & SharedFields['Fields113'];
  PassportElementErrorTranslationFile: {
    source: 'translation_file';
    type:
      | 'passport'
      | 'driver_license'
      | 'identity_card'
      | 'internal_passport'
      | 'utility_bill'
      | 'bank_statement'
      | 'rental_agreement'
      | 'passport_registration'
      | 'temporary_registration';
  } & SharedFields['Fields112'];
  PassportElementErrorTranslationFiles: {
    source: 'translation_files';
    type:
      | 'passport'
      | 'driver_license'
      | 'identity_card'
      | 'internal_passport'
      | 'utility_bill'
      | 'bank_statement'
      | 'rental_agreement'
      | 'passport_registration'
      | 'temporary_registration';
  } & SharedFields['Fields113'];
  PassportElementErrorUnspecified: {
    source: 'unspecified';
    type: string;
    element_hash: string;
    message: string;
  };
  Game: {
    photo: Array<BotModels['PhotoSize']>;
    text?: string;
    text_entities?: Array<BotModels['MessageEntity']>;
    animation?: BotModels['Animation'];
  } & SharedFields['Fields114'];
  CallbackGame: object;
  GameHighScore: { position: number; user: BotModels['User']; score: number };
}
