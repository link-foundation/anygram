import { Api as Gram } from 'telegram/tl/api.js';
import { Api as Tele } from 'teleproto/tl/api.js';
import * as GramUtils from 'telegram/Utils.js';
import * as TeleUtils from 'teleproto/Utils.js';

// Runtime request autocasts accept these values; pinned declarations require
// explicit helper conversion. Keep both facts visible during migration.
declare const gramPhoto: Gram.Photo;
declare const gramDocument: Gram.Document;
declare const gramFile: Gram.InputFile;
// @ts-expect-error Pinned SDK declarations omit response-media autocasts.
new Gram.messages.SendMedia({ media: gramPhoto });
new Gram.photos.DeletePhotos({
  // @ts-expect-error Pinned SDK declarations omit response-photo autocasts.
  id: [gramPhoto],
});
new Gram.messages.SaveGif({
  // @ts-expect-error Pinned SDK declarations omit response-document autocasts.
  id: gramDocument,
});
new Gram.messages.EditChatPhoto({
  // @ts-expect-error Pinned SDK declarations omit uploaded-file autocasts.
  photo: gramFile,
});
new Gram.messages.SendMedia({ media: GramUtils.getInputMedia(gramPhoto) });
new Gram.photos.DeletePhotos({ id: [GramUtils.getInputPhoto(gramPhoto)] });
new Gram.messages.SaveGif({ id: GramUtils.getInputDocument(gramDocument) });
new Gram.messages.EditChatPhoto({
  photo: GramUtils.getInputChatPhoto(gramFile),
});

declare const telePhoto: Tele.Photo;
declare const teleDocument: Tele.Document;
declare const teleFile: Tele.InputFile;
// @ts-expect-error Pinned SDK declarations omit response-media autocasts.
new Tele.messages.SendMedia({ media: telePhoto });
new Tele.photos.DeletePhotos({
  // @ts-expect-error Pinned SDK declarations omit response-photo autocasts.
  id: [telePhoto],
});
new Tele.messages.SaveGif({
  // @ts-expect-error Pinned SDK declarations omit response-document autocasts.
  id: teleDocument,
});
new Tele.messages.EditChatPhoto({
  // @ts-expect-error Pinned SDK declarations omit uploaded-file autocasts.
  photo: teleFile,
});
new Tele.messages.SendMedia({ media: TeleUtils.getInputMedia(telePhoto) });
new Tele.photos.DeletePhotos({ id: [TeleUtils.getInputPhoto(telePhoto)] });
new Tele.messages.SaveGif({ id: TeleUtils.getInputDocument(teleDocument) });
new Tele.messages.EditChatPhoto({
  photo: TeleUtils.getInputChatPhoto(teleFile),
});
