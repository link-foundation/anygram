import { Api } from '../src/index.js';
import type { Anygram } from '../src/index.js';

/** Reuse Telegram response media without uploading it again. */
export function reusableMediaRequests(
  photo: InstanceType<typeof Api.Photo>,
  document: InstanceType<typeof Api.Document>,
  file: InstanceType<typeof Api.InputFile>
) {
  return {
    deletePhotos: new Api.photos.DeletePhotos({ id: [photo] }),
    saveGif: new Api.messages.SaveGif({ id: document, unsave: false }),
    editChatPhoto: new Api.messages.EditChatPhoto({ chatId: 7n, photo: file }),
    sendMedia: new Api.messages.SendMedia({
      peer: 'me',
      media: photo,
      message: 'Reusable photo',
    }),
  };
}

export function reuseResponseMedia(
  client: Anygram,
  photo: InstanceType<typeof Api.Photo>
) {
  return client.invoke(
    new Api.messages.SendMedia({
      peer: 'me',
      media: photo,
      message: 'Reusable photo',
    })
  );
}

export function rejectInvalidMedia() {
  new Api.messages.SendMedia({
    peer: 'me',
    message: 'Invalid',
    // @ts-expect-error Raw paths require explicit uploadFile/prepareMedia.
    media: 'file.jpg',
  });
  new Api.photos.DeletePhotos({
    // @ts-expect-error An uploaded file is not a reusable InputPhoto.
    id: [new Api.InputFile({ id: 1n, parts: 1, name: 'x', md5Checksum: '' })],
  });
}
