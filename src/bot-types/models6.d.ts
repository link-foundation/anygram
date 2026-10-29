// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models6 {
  RichBlockThinking: SharedFields['Fields104'];
  InputRichBlockListItem: {
    blocks: Array<BotModels['InputRichBlock']>;
  } & SharedFields['Fields43'];
  InputRichBlock:
    | BotModels['InputRichBlockParagraph']
    | BotModels['InputRichBlockSectionHeading']
    | BotModels['InputRichBlockPreformatted']
    | BotModels['InputRichBlockFooter']
    | BotModels['InputRichBlockDivider']
    | BotModels['InputRichBlockMathematicalExpression']
    | BotModels['InputRichBlockAnchor']
    | BotModels['InputRichBlockList']
    | BotModels['InputRichBlockBlockQuotation']
    | BotModels['InputRichBlockExpandableBlockQuotation']
    | BotModels['InputRichBlockPullQuotation']
    | BotModels['InputRichBlockCollage']
    | BotModels['InputRichBlockSlideshow']
    | BotModels['InputRichBlockTable']
    | BotModels['InputRichBlockDetails']
    | BotModels['InputRichBlockMap']
    | BotModels['InputRichBlockButtons']
    | BotModels['InputRichBlockAnimation']
    | BotModels['InputRichBlockAudio']
    | BotModels['InputRichBlockDocument']
    | BotModels['InputRichBlockPhoto']
    | BotModels['InputRichBlockVideo']
    | BotModels['InputRichBlockVoiceNote']
    | BotModels['InputRichBlockThinking'];
  InputRichBlockParagraph: SharedFields['Fields95'];
  InputRichBlockSectionHeading: SharedFields['Fields57'];
  InputRichBlockPreformatted: SharedFields['Fields58'];
  InputRichBlockFooter: SharedFields['Fields96'];
  InputRichBlockDivider: { type: 'divider' };
  InputRichBlockMathematicalExpression: SharedFields['Fields92'];
  InputRichBlockAnchor: SharedFields['Fields93'];
  InputRichBlockList: {
    type: 'list';
    items: Array<BotModels['InputRichBlockListItem']>;
  };
  InputRichBlockBlockQuotation: {
    blocks: Array<BotModels['InputRichBlock']>;
  } & SharedFields['Fields97'];
  InputRichBlockExpandableBlockQuotation: SharedFields['Fields59'];
  InputRichBlockPullQuotation: SharedFields['Fields60'];
  InputRichBlockCollage: { type: 'collage' } & SharedFields['Fields105'];
  InputRichBlockSlideshow: { type: 'slideshow' } & SharedFields['Fields105'];
  InputRichBlockTable: SharedFields['Fields26'];
  InputRichBlockDetails: {
    blocks: Array<BotModels['InputRichBlock']>;
  } & SharedFields['Fields61'];
  InputRichBlockMap: { zoom?: number } & SharedFields['Fields62'] &
    SharedFields['Fields106'];
  InputRichBlockButtons: SharedFields['Fields63'];
  InputRichBlockAnimation: {
    type: 'animation';
    animation: BotModels['InputMediaAnimation'];
    caption?: BotModels['RichBlockCaption'];
  };
  InputRichBlockAudio: {
    audio: BotModels['InputMediaAudio'];
  } & SharedFields['Fields101'];
  InputRichBlockDocument: {
    document: BotModels['InputMediaDocument'];
  } & SharedFields['Fields102'];
  InputRichBlockPhoto: {
    type: 'photo';
    photo: BotModels['InputMediaPhoto'];
    caption?: BotModels['RichBlockCaption'];
  };
  InputRichBlockVideo: {
    type: 'video';
    video: BotModels['InputMediaVideo'];
    caption?: BotModels['RichBlockCaption'];
  };
  InputRichBlockVoiceNote: {
    voice_note: BotModels['InputMediaVoiceNote'];
  } & SharedFields['Fields103'];
  InputRichBlockThinking: SharedFields['Fields104'];
  InlineQuery: {
    id: string;
    offset: string;
    chat_type?: 'sender' | 'private' | 'group' | 'supergroup' | 'channel';
  } & SharedFields['Fields64'];
  InlineQueryResultsButton: {
    text: string;
    web_app?: BotModels['WebAppInfo'];
    start_parameter?: string;
  };
  InlineQueryResult:
    | BotModels['InlineQueryResultCachedAudio']
    | BotModels['InlineQueryResultCachedDocument']
    | BotModels['InlineQueryResultCachedGif']
    | BotModels['InlineQueryResultCachedMpeg4Gif']
    | BotModels['InlineQueryResultCachedPhoto']
    | BotModels['InlineQueryResultCachedSticker']
    | BotModels['InlineQueryResultCachedVideo']
    | BotModels['InlineQueryResultCachedVoice']
    | BotModels['InlineQueryResultArticle']
    | BotModels['InlineQueryResultAudio']
    | BotModels['InlineQueryResultContact']
    | BotModels['InlineQueryResultGame']
    | BotModels['InlineQueryResultDocument']
    | BotModels['InlineQueryResultGif']
    | BotModels['InlineQueryResultLocation']
    | BotModels['InlineQueryResultMpeg4Gif']
    | BotModels['InlineQueryResultPhoto']
    | BotModels['InlineQueryResultVenue']
    | BotModels['InlineQueryResultVideo']
    | BotModels['InlineQueryResultVoice'];
  InlineQueryResultArticle: {
    type: 'article';
    input_message_content: BotModels['InputMessageContent'];
    url?: string;
    description?: string;
  } & SharedFields['Fields27'];
  InlineQueryResultPhoto: {
    photo_url: string;
    thumbnail_url: string;
  } & SharedFields['Fields4'] &
    SharedFields['Fields107'];
  InlineQueryResultGif: {
    type: 'gif';
    gif_url: string;
    gif_width?: number;
    gif_height?: number;
    gif_duration?: number;
  } & SharedFields['Fields5'];
  InlineQueryResultMpeg4Gif: {
    type: string;
    mpeg4_url: string;
    mpeg4_width?: number;
    mpeg4_height?: number;
    mpeg4_duration?: number;
  } & SharedFields['Fields5'];
  InlineQueryResultVideo: {
    video_url: string;
    mime_type: string;
    thumbnail_url: string;
    video_width?: number;
    video_height?: number;
    video_duration?: number;
  } & SharedFields['Fields6'];
  InlineQueryResultAudio: {
    audio_url: string;
    title: string;
    performer?: string;
    audio_duration?: number;
  } & SharedFields['Fields18'];
  InlineQueryResultVoice: {
    voice_url: string;
    voice_duration?: number;
  } & SharedFields['Fields13'];
  InlineQueryResultDocument: {
    document_url: string;
    mime_type: string;
  } & SharedFields['Fields11'] &
    SharedFields['Fields65'];
  InlineQueryResultLocation: {
    type: 'location';
    input_message_content?: BotModels['InputMessageContent'];
  } & SharedFields['Fields21'] &
    SharedFields['Fields27'];
  InlineQueryResultVenue: SharedFields['Fields10'] & SharedFields['Fields28'];
  InlineQueryResultContact: { type: 'contact' } & SharedFields['Fields28'] &
    SharedFields['Fields36'];
  InlineQueryResultGame: {
    type: 'game';
    game_short_name: string;
  } & SharedFields['Fields108'];
  InlineQueryResultCachedPhoto: {
    photo_file_id: string;
  } & SharedFields['Fields4'];
  InlineQueryResultCachedGif: {
    type: 'gif';
    gif_file_id: string;
  } & SharedFields['Fields14'];
  InlineQueryResultCachedMpeg4Gif: {
    type: string;
    mpeg4_file_id: string;
  } & SharedFields['Fields14'];
  InlineQueryResultCachedSticker: {
    type: 'sticker';
    sticker_file_id: string;
    input_message_content?: BotModels['InputMessageContent'];
  } & SharedFields['Fields108'];
  InlineQueryResultCachedDocument: {
    document_file_id: string;
  } & SharedFields['Fields11'];
  InlineQueryResultCachedVideo: {
    video_file_id: string;
  } & SharedFields['Fields6'];
  InlineQueryResultCachedVoice: {
    voice_file_id: string;
  } & SharedFields['Fields13'];
  InlineQueryResultCachedAudio: {
    audio_file_id: string;
  } & SharedFields['Fields18'];
}
