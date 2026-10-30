export function mediaValues(Api) {
  const reference = {
    id: 7n,
    accessHash: -17n,
    fileReference: Buffer.from([1, 2]),
  };
  const photo = () =>
    new Api.Photo({ ...reference, date: 1, sizes: [], dcId: 2 });
  const document = () =>
    new Api.Document({
      ...reference,
      date: 1,
      mimeType: 'application/octet-stream',
      size: 4n,
      dcId: 2,
      attributes: [],
    });
  const photoMedia = () =>
    new Api.MessageMediaPhoto({ photo: photo(), ttlSeconds: 9 });
  const documentMedia = () =>
    new Api.MessageMediaDocument({ document: document(), ttlSeconds: 11 });
  const file = () =>
    new Api.InputFile({ id: 7n, parts: 1, name: 'file.bin', md5Checksum: '' });
  const geo = () => new Api.GeoPoint({ lat: 1.5, long: -2.5, accessHash: 0n });
  return {
    photo: photo(),
    photoEmpty: new Api.PhotoEmpty({ id: 7n }),
    inputPhoto: new Api.InputPhoto(reference),
    inputPhotoEmpty: new Api.InputPhotoEmpty(),
    photoMedia: photoMedia(),
    photoMessage: new Api.Message({ id: 3, media: photoMedia() }),
    photosPhoto: new Api.photos.Photo({ photo: photo(), users: [] }),
    channelFull: new Api.ChannelFull({ chatPhoto: photo() }),
    userFull: new Api.UserFull({ profilePhoto: photo() }),
    userEmpty: new Api.UserEmpty({ id: 7n }),
    chatEmpty: new Api.ChatEmpty({ id: 7n }),
    document: document(),
    documentEmpty: new Api.DocumentEmpty({ id: 7n }),
    inputDocument: new Api.InputDocument(reference),
    inputDocumentEmpty: new Api.InputDocumentEmpty(),
    documentMedia: documentMedia(),
    documentMessage: new Api.Message({ id: 3, media: documentMedia() }),
    file: file(),
    fileBig: new Api.InputFileBig({ id: 7n, parts: 1, name: 'large.bin' }),
    inputChatPhoto: new Api.InputChatPhoto({
      id: new Api.InputPhoto(reference),
    }),
    inputChatPhotoEmpty: new Api.InputChatPhotoEmpty(),
    inputMedia: new Api.InputMediaPhoto({
      id: new Api.InputPhoto(reference),
      ttlSeconds: 15,
    }),
    contact: new Api.MessageMediaContact({
      phoneNumber: '+123',
      firstName: 'A',
      lastName: 'B',
      vcard: 'ignored vendor vcard',
      userId: 7n,
    }),
    geo: new Api.MessageMediaGeo({ geo: geo() }),
    geoEmpty: new Api.MessageMediaGeo({ geo: new Api.GeoPointEmpty() }),
    venue: new Api.MessageMediaVenue({
      geo: geo(),
      title: 'Venue',
      address: 'Street',
      provider: 'provider',
      venueId: 'id',
      venueType: 'ignored vendor type',
    }),
    dice: new Api.MessageMediaDice({ value: 4, emoticon: '🎲' }),
    game: new Api.MessageMediaGame({
      game: new Api.Game({ id: 7n, accessHash: -17n }),
    }),
    mediaEmpty: new Api.MessageMediaEmpty(),
    unsupported: new Api.MessageMediaUnsupported(),
    chatPhotoEmpty: new Api.ChatPhotoEmpty(),
    userProfilePhotoEmpty: new Api.UserProfilePhotoEmpty(),
  };
}

export const mediaCastCases = {
  InputPhoto: [
    'photo',
    'photoEmpty',
    'inputPhoto',
    'inputPhotoEmpty',
    'photoMedia',
    'photoMessage',
    'photosPhoto',
    'channelFull',
    'userFull',
    'userEmpty',
    'chatEmpty',
  ],
  InputDocument: [
    'document',
    'documentEmpty',
    'inputDocument',
    'inputDocumentEmpty',
    'documentMedia',
    'documentMessage',
  ],
  InputChatPhoto: [
    'photo',
    'photoEmpty',
    'photoMedia',
    'photoMessage',
    'inputPhoto',
    'inputPhotoEmpty',
    'inputChatPhoto',
    'inputChatPhotoEmpty',
    'file',
    'fileBig',
  ],
  InputMedia: [
    'photo',
    'photoEmpty',
    'inputPhoto',
    'inputPhotoEmpty',
    'photoMedia',
    'photoMessage',
    'photosPhoto',
    'document',
    'documentEmpty',
    'inputDocument',
    'inputDocumentEmpty',
    'documentMedia',
    'documentMessage',
    'file',
    'fileBig',
    'inputMedia',
    'contact',
    'geo',
    'geoEmpty',
    'venue',
    'dice',
    'game',
    'mediaEmpty',
    'unsupported',
    'chatPhotoEmpty',
    'userProfilePhotoEmpty',
  ],
};

export function mediaRequest(Api, type, value) {
  const cases = {
    InputPhoto: () => new Api.photos.DeletePhotos({ id: [value] }),
    InputDocument: () => new Api.messages.SaveGif({ id: value, unsave: false }),
    InputChatPhoto: () =>
      new Api.messages.EditChatPhoto({ chatId: 7n, photo: value }),
    InputMedia: () =>
      new Api.messages.SendMedia({
        peer: new Api.InputPeerSelf(),
        media: value,
        message: 'media',
        randomId: 1n,
      }),
  };
  return cases[type]();
}

export const mediaField = (request, type) =>
  ({
    InputPhoto: () => request.id[0],
    InputDocument: () => request.id,
    InputChatPhoto: () => request.photo,
    InputMedia: () => request.media,
  })[type]();
