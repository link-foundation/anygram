// Official Bot API field facts, independently generated.
// Regenerate: node experiments/generate-bot-models.mjs
import type { BotModels } from './index.js';
import type { SharedFields } from './shared.js';
export interface Models5 {
  RichTextStrikethrough: { type: 'strikethrough'; text: BotModels['RichText'] };
  RichTextSpoiler: { type: 'spoiler'; text: BotModels['RichText'] };
  RichTextDateTime: {
    type: 'date_time';
    text: BotModels['RichText'];
    unix_time: number;
    date_time_format: string;
  };
  RichTextTextMention: {
    type: 'text_mention';
    text: BotModels['RichText'];
    user: BotModels['User'];
  };
  RichTextSubscript: { type: 'subscript'; text: BotModels['RichText'] };
  RichTextSuperscript: { type: 'superscript'; text: BotModels['RichText'] };
  RichTextMarked: { type: 'marked'; text: BotModels['RichText'] };
  RichTextCode: { type: 'code'; text: BotModels['RichText'] };
  RichTextCustomEmoji: { alternative_text: string } & SharedFields['Fields85'];
  RichTextMathematicalExpression: SharedFields['Fields92'];
  RichTextUrl: { type: 'url'; text: BotModels['RichText']; url: string };
  RichTextEmailAddress: {
    type: 'email_address';
    text: BotModels['RichText'];
    email_address: string;
  };
  RichTextPhoneNumber: {
    type: 'phone_number';
    text: BotModels['RichText'];
    phone_number: string;
  };
  RichTextBankCardNumber: {
    type: 'bank_card_number';
    text: BotModels['RichText'];
    bank_card_number: string;
  };
  RichTextMention: {
    type: 'mention';
    text: BotModels['RichText'];
    username: string;
  };
  RichTextHashtag: {
    type: 'hashtag';
    text: BotModels['RichText'];
    hashtag: string;
  };
  RichTextCashtag: {
    type: 'cashtag';
    text: BotModels['RichText'];
    cashtag: string;
  };
  RichTextBotCommand: {
    type: 'bot_command';
    text: BotModels['RichText'];
    bot_command: string;
  };
  RichTextButton: { type: 'button'; button: BotModels['RichMessageButton'] };
  RichTextAnchor: SharedFields['Fields93'];
  RichTextAnchorLink: {
    type: 'anchor_link';
    text: BotModels['RichText'];
    anchor_name: string;
  };
  RichTextReference: {
    type: 'reference';
    text: BotModels['RichText'];
    name: string;
  };
  RichTextReferenceLink: {
    type: 'reference_link';
    text: BotModels['RichText'];
    reference_name: string;
  };
  RichBlockCaption: SharedFields['Fields94'];
  RichBlockTableCell: {
    text?: BotModels['RichText'];
    is_header?: true;
    colspan?: number;
    rowspan?: number;
    align: 'left' | 'center' | 'right';
    valign: 'top' | 'middle' | 'bottom';
  };
  RichBlockListItem: {
    label: string;
    blocks: Array<BotModels['RichBlock']>;
  } & SharedFields['Fields43'];
  RichBlock:
    | BotModels['RichBlockParagraph']
    | BotModels['RichBlockSectionHeading']
    | BotModels['RichBlockPreformatted']
    | BotModels['RichBlockFooter']
    | BotModels['RichBlockDivider']
    | BotModels['RichBlockMathematicalExpression']
    | BotModels['RichBlockAnchor']
    | BotModels['RichBlockList']
    | BotModels['RichBlockBlockQuotation']
    | BotModels['RichBlockExpandableBlockQuotation']
    | BotModels['RichBlockPullQuotation']
    | BotModels['RichBlockCollage']
    | BotModels['RichBlockSlideshow']
    | BotModels['RichBlockTable']
    | BotModels['RichBlockDetails']
    | BotModels['RichBlockMap']
    | BotModels['RichBlockButtons']
    | BotModels['RichBlockAnimation']
    | BotModels['RichBlockAudio']
    | BotModels['RichBlockDocument']
    | BotModels['RichBlockPhoto']
    | BotModels['RichBlockVideo']
    | BotModels['RichBlockVoiceNote']
    | BotModels['RichBlockThinking'];
  RichBlockParagraph: SharedFields['Fields95'];
  RichBlockSectionHeading: SharedFields['Fields57'];
  RichBlockPreformatted: SharedFields['Fields58'];
  RichBlockFooter: SharedFields['Fields96'];
  RichBlockDivider: { type: 'divider' };
  RichBlockMathematicalExpression: SharedFields['Fields92'];
  RichBlockAnchor: SharedFields['Fields93'];
  RichBlockList: { type: 'list'; items: Array<BotModels['RichBlockListItem']> };
  RichBlockBlockQuotation: {
    blocks: Array<BotModels['RichBlock']>;
  } & SharedFields['Fields97'];
  RichBlockExpandableBlockQuotation: SharedFields['Fields59'];
  RichBlockPullQuotation: SharedFields['Fields60'];
  RichBlockCollage: { type: 'collage' } & SharedFields['Fields98'];
  RichBlockSlideshow: { type: 'slideshow' } & SharedFields['Fields98'];
  RichBlockTable: SharedFields['Fields26'];
  RichBlockDetails: {
    blocks: Array<BotModels['RichBlock']>;
  } & SharedFields['Fields61'];
  RichBlockMap: { zoom: number } & SharedFields['Fields62'] &
    SharedFields['Fields99'];
  RichBlockButtons: SharedFields['Fields63'];
  RichBlockAnimation: {
    type: 'animation';
    animation: BotModels['Animation'];
  } & SharedFields['Fields100'];
  RichBlockAudio: { audio: BotModels['Audio'] } & SharedFields['Fields101'];
  RichBlockDocument: {
    document: BotModels['Document'];
  } & SharedFields['Fields102'];
  RichBlockPhoto: SharedFields['Fields71'] & SharedFields['Fields100'];
  RichBlockVideo: SharedFields['Fields72'] & SharedFields['Fields100'];
  RichBlockVoiceNote: {
    voice_note: BotModels['Voice'];
  } & SharedFields['Fields103'];
}
