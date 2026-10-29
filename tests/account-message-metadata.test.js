import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Api } from '../src/index.js';
import {
  messagePage,
  sdkMessage,
  ownedMessage,
  wireValue,
} from './fixtures/account-message-models.js';

const attributes = [
  { _: 'documentAttributeFilename', file_name: 'record.ogg' },
  {
    _: 'documentAttributeAudio',
    voice: true,
    duration: 7,
    title: 'Song',
    performer: 'Ada',
  },
  {
    _: 'documentAttributeVideo',
    round_message: true,
    duration: 7,
    w: 80,
    h: 60,
  },
  {
    _: 'documentAttributeSticker',
    alt: '🙂',
    stickerset: { _: 'inputStickerSetEmpty' },
  },
  { _: 'documentAttributeAnimated' },
];
const document = {
  _: 'document',
  id: 19n,
  access_hash: 23n,
  file_reference: new Uint8Array([1]),
  date: 1,
  mime_type: 'audio/ogg',
  size: 9007199254740993n,
  dc_id: 2,
  attributes,
};
const media = [
  { _: 'messageMediaDocument', document },
  {
    _: 'messageMediaWebPage',
    webpage: {
      _: 'webPage',
      id: 3n,
      url: 'https://example.com',
      display_url: 'example.com',
      hash: 0,
      photo: messagePage().messages[0].media.photo,
      document,
    },
  },
  {
    _: 'messageMediaContact',
    phone_number: '123',
    first_name: 'Ada',
    last_name: '',
    vcard: '',
    user_id: 9n,
  },
  {
    _: 'messageMediaGeo',
    geo: { _: 'geoPoint', long: 1, lat: 2, access_hash: 0n },
  },
  {
    _: 'messageMediaGeoLive',
    geo: { _: 'geoPoint', long: 1, lat: 2, access_hash: 0n },
    period: 60,
  },
  {
    _: 'messageMediaVenue',
    geo: { _: 'geoPoint', long: 1, lat: 2, access_hash: 0n },
    title: 'Hall',
    address: 'Main',
    provider: '',
    venue_id: '',
    venue_type: '',
  },
  { _: 'messageMediaDice', value: 4, emoticon: '🎲' },
  { _: 'messageMediaEmpty' },
  { _: 'messageMediaPhoto', photo: { _: 'photoEmpty', id: 1n } },
  { _: 'messageMediaDocument', document: { _: 'documentEmpty', id: 1n } },
];

for (const [style, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  for (const value of media) {
    it(`matches ${style} metadata getters for ${value._}${value.document?._ ?? value.photo?._ ?? ''}`, async () => {
      const page = messagePage();
      page.messages[0].media = value;
      const expected = sdkMessage(Vendor, page).message;
      const { message } = await ownedMessage(style, page);
      for (const field of [
        'photo',
        'document',
        'webPreview',
        'audio',
        'voice',
        'video',
        'videoNote',
        'gif',
        'sticker',
        'contact',
        'game',
        'geo',
        'invoice',
        'poll',
        'venue',
        'dice',
      ]) {
        assert.equal(Boolean(message[field]), Boolean(expected[field]), field);
        if (message[field]) {
          assert.deepEqual(
            wireValue(message[field]),
            wireValue(expected[field]),
            field
          );
        }
      }
      if (expected.file) {
        assert.equal(message.file, message.file);
        for (const field of [
          'name',
          'mimeType',
          'width',
          'height',
          'duration',
          'title',
          'performer',
          'emoji',
        ]) {
          if (
            message.file.media._ === 'document' &&
            ['width', 'height', 'duration'].includes(field)
          ) {
            assert.throws(() => expected.file[field], /instanceof/);
            assert.equal(
              message.file[field],
              { width: 80, height: 60, duration: 7 }[field]
            );
          } else {
            assert.equal(message.file[field], expected.file[field], field);
          }
        }
        const size = expected.file.size;
        assert.equal(
          message.file.size === undefined
            ? undefined
            : BigInt(message.file.size),
          size === undefined ? undefined : BigInt(size.toString())
        );
      } else {
        assert.equal(message.file, undefined);
      }
    });
  }
  for (const [peer, post, broadcast] of [
    [{ _: 'peerUser', user_id: 9n }, false, undefined],
    [{ _: 'peerChat', chat_id: 9007199254740993n }, false, undefined],
    [{ _: 'peerChannel', channel_id: 9007199254740993n }, false, undefined],
    [{ _: 'peerChannel', channel_id: 9007199254740993n }, true, true],
    [{ _: 'peerChannel', channel_id: 9007199254740993n }, false, false],
    [{ _: 'peerChannel', channel_id: 9007199254740993n }, true, false],
  ]) {
    it(`matches ${style} exact identities and group classification for ${peer._} post=${post} broadcast=${broadcast}`, async () => {
      const page = messagePage();
      Object.assign(page.messages[0], { peer_id: peer, post });
      page.chats =
        peer._ === 'peerChannel'
          ? [
              {
                _: 'channel',
                id: peer.channel_id,
                title: 'Group',
                photo: { _: 'chatPhotoEmpty' },
                date: 1,
                access_hash: 31n,
                broadcast,
              },
            ]
          : [];
      const expected = sdkMessage(Vendor, page).message;
      const { message } = await ownedMessage(style, page);
      assert.equal(message.chatId, BigInt(expected.chatId.toString()));
      for (const field of ['isPrivate', 'isChannel', 'isGroup']) {
        assert.equal(message[field], expected[field], field);
      }
    });
  }
}

it('extracts UTF-16 entity text and clears entities on raw text edits without changing source data', async () => {
  const page = messagePage();
  page.messages[0].message = '🙂Ada';
  page.messages[0].entities = [
    { _: 'messageEntityBold', offset: 2, length: 3 },
    { _: 'messageEntityItalic', offset: 0, length: 2 },
  ];
  const { message } = await ownedMessage('gramjs', page);
  assert.deepEqual(
    message.getEntitiesText(Api.MessageEntityBold).map(([, text]) => text),
    ['Ada']
  );
  assert.deepEqual(
    message.getEntitiesText().map(([, text]) => text),
    ['Ada', '🙂']
  );
  message.rawText = 'Changed';
  assert.equal(message.text, 'Changed');
  assert.equal(message.getEntitiesText(), undefined);
  assert.equal(page.messages[0].message, '🙂Ada');
  assert.equal(page.messages[0].entities.length, 2);
});
