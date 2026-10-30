import type { Message, Update } from './bot-message-types.js';

type Edited<T> = (T & Update.Edited) | true;
export type BotTextEditResult = Edited<Message.TextMessage>;
export interface BotMessageResults {
  sendMessage: Message.TextMessage;
  sendRichMessage: Message.RichMessageMessage;
  sendPhoto: Message.PhotoMessage;
  sendLivePhoto: Message.LivePhotoMessage;
  sendAudio: Message.AudioMessage;
  sendDocument: Message.DocumentMessage;
  sendVideo: Message.VideoMessage;
  sendAnimation: Message.AnimationMessage;
  sendVoice: Message.VoiceMessage;
  sendVideoNote: Message.VideoNoteMessage;
  sendPaidMedia: Message.PaidMediaMessage;
  sendSticker: Message.StickerMessage;
  sendLocation: Message.LocationMessage;
  sendVenue: Message.VenueMessage;
  sendContact: Message.ContactMessage;
  sendPoll: Message.PollMessage;
  sendChecklist: Message.ChecklistMessage;
  editMessageChecklist: Message.ChecklistMessage;
  sendDice: Message.DiceMessage;
  sendInvoice: Message.InvoiceMessage;
  sendGame: Message.GameMessage;
  sendMediaGroup: (
    | Message.PhotoMessage
    | Message.LivePhotoMessage
    | Message.AudioMessage
    | Message.DocumentMessage
    | Message.VideoMessage
  )[];
  editMessageText: Edited<Message.TextMessage | Message.RichMessageMessage>;
  editMessageCaption: Edited<Message.CaptionableMessage>;
  editMessageMedia: Edited<Message>;
  editMessageReplyMarkup: Edited<Message>;
  editMessageLiveLocation: Edited<Message.LocationMessage>;
  stopMessageLiveLocation: Edited<Message.LocationMessage>;
  setGameScore: Edited<Message.GameMessage>;
}
