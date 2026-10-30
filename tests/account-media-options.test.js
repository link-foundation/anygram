import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter, InputFile } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as GramUploads from 'telegram/client/uploads.js';
import * as TeleUploads from 'teleproto/client/methods/uploads.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { ownedMessage } from './fixtures/account-message-models.js';

const codec = new TlCodec();
const peer = { _: 'inputPeerSelf' };
const uploaded = (name = 'photo.jpg') => ({
  _: 'inputFile',
  id: 7n,
  parts: 1,
  name,
  md5_checksum: '',
});
const photo = {
  _: 'inputPhoto',
  id: 9007199254740993n,
  access_hash: -9007199254740995n,
  file_reference: new Uint8Array([3, 4]),
};

function fixture() {
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          call: async (method, params) => {
            calls.push([method, params]);
            if (method.startsWith('upload.save')) {
              return true;
            }
            if (method === 'messages.uploadMedia') {
              const isPhoto = params.media._.includes('Photo');
              const value = { ...photo, _: isPhoto ? 'photo' : 'document' };
              return { [isPhoto ? 'photo' : 'document']: value };
            }
            return { _: 'updatesTooLong' };
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  return { client, calls };
}

const cases = [
  ['photo.jpg', {}],
  ['photo.PNG', {}],
  ['photo.jpeg', { forceDocument: true }],
  ['notes.txt', {}],
  ['file.unknown-extension', {}],
  ['movie.mp4', {}],
  ['movie.mp4', { forceDocument: true }],
  ['movie.mp4', { supportsStreaming: true }],
  ['song.mp3', { voiceNote: true }],
  ['song.mp3', { forceDocument: true }],
  ['image.webp', {}],
  ['image.png', { asImage: false }],
  ['binary.dat', { asImage: true }],
  ['notes.txt', { mimeType: 'application/x-anygram' }],
  ['dir/clip.MP4', { supportsStreaming: true }],
  [
    'song.ogg',
    {
      attributes: [
        {
          _: 'documentAttributeAudio',
          duration: 17,
          title: 'Ada',
          voice: true,
        },
        { _: 'documentAttributeFilename', file_name: 'renamed.ogg' },
      ],
    },
  ],
];

for (const [style, Vendor, uploads] of [
  ['gramjs', GramApi, GramUploads],
  ['teleproto', TeleApi, TeleUploads],
]) {
  for (const [name, options] of cases) {
    it(`matches actual ${style} file-helper media bytes for ${name} ${JSON.stringify(options)}`, async () => {
      const file = uploaded(name);
      const sdkOptions = Object.fromEntries(
        Object.entries(options).map(([key, value]) => [
          key,
          key === 'attributes'
            ? value.map((item) => gramRequest(Vendor, requestOf(item)))
            : value,
        ])
      );
      const expected = await uploads._fileToMedia(
        {},
        {
          file: gramRequest(Vendor, requestOf(file)),
          ...sdkOptions,
        }
      );
      const { client, calls } = fixture();
      await client[style].sendFile(peer, { file, ...options });
      assert.equal(calls.length, 1);
      const media = calls[0][1].media;
      assert.deepEqual(
        new Uint8Array(gramRequest(Vendor, requestOf(media)).getBytes()),
        new Uint8Array(expected.media.getBytes())
      );
      if (style === 'teleproto') {
        assert.deepEqual(
          codec.encode(media),
          codec.encode(objectRequest(requestOf(expected.media)))
        );
      }
      assert.equal(file.name, name);
    });
  }
}

for (const style of ['canonical', 'gramjs', 'teleproto']) {
  const target = (client) => (style === 'canonical' ? client : client[style]);
  it(`infers ${style} image sources without consuming remote URLs`, async () => {
    const { client, calls } = fixture();
    await target(client).sendFile(peer, {
      file: 'https://example.test/image.JPG',
      spoiler: true,
      ttlSeconds: 0,
    });
    assert.deepEqual(calls[0][1].media, {
      _: 'inputMediaPhotoExternal',
      url: 'https://example.test/image.JPG',
      spoiler: true,
      ttl_seconds: 0,
    });
    await target(client).sendFile(peer, {
      file: { data: new Uint8Array([1]), filename: 'photo.jpg' },
    });
    assert.equal(calls.at(-1)[1].media._, 'inputMediaUploadedPhoto');
  });

  it(`preserves ${style} media flags and detached cover references`, async () => {
    const { client, calls } = fixture();
    await target(client).sendFile(peer, {
      file: uploaded('clip.mp4'),
      spoiler: true,
      ttlSeconds: 2147483647,
      nosoundVideo: true,
      videoCover: photo,
      videoTimestamp: 3,
      supportsStreaming: true,
    });
    const media = calls[0][1].media;
    assert.equal(media.spoiler, true);
    assert.equal(media.ttl_seconds, 2147483647);
    assert.equal(media.nosound_video, true);
    assert.equal(media.video_timestamp, 3);
    assert.deepEqual(media.video_cover, photo);
    assert.notEqual(media.video_cover.file_reference, photo.file_reference);
    assert(
      media.attributes.some(
        (item) => item._ === 'documentAttributeVideo' && item.supports_streaming
      )
    );
    assert.equal(codec.decode(codec.encode(media)).video_cover.id, photo.id);
  });

  it(`retains ${style} per-item album flags after uploadMedia`, async () => {
    const { client, calls } = fixture();
    await target(client).sendAlbum(peer, [
      { file: uploaded('photo.jpg'), spoiler: true, ttlSeconds: 9 },
      { file: uploaded('notes.txt'), spoiler: false, ttlSeconds: 0 },
    ]);
    const items = calls.at(-1)[1].multi_media;
    assert.equal(items[0].media._, 'inputMediaPhoto');
    assert.equal(items[0].media.spoiler, true);
    assert.equal(items[0].media.ttl_seconds, 9);
    assert.equal(items[1].media._, 'inputMediaDocument');
    assert.equal(items[1].media.spoiler, false);
    assert.equal(items[1].media.ttl_seconds, 0);
  });

  it(`uploads ${style} thumbnails once and retains caller handles`, async () => {
    const { client, calls } = fixture();
    let consumed = 0;
    const thumb = new InputFile(() => {
      consumed++;
      return new Uint8Array([9, 8]);
    }, 'thumb.jpg');
    await target(client).sendFile(peer, { file: uploaded('notes.txt'), thumb });
    assert.equal(consumed, 1);
    assert.deepEqual(
      calls.map(([method]) => method),
      ['upload.saveFilePart', 'messages.sendMedia']
    );
    assert.equal(calls[1][1].media.thumb.name, 'thumb.jpg');
    const handle = uploaded('reuse.jpg');
    await target(client).sendFile(peer, {
      file: uploaded('notes.txt'),
      thumb: handle,
    });
    assert.deepEqual(calls.at(-1)[1].media.thumb, handle);
    assert.equal(
      calls.filter(([method]) => method.startsWith('upload.save')).length,
      1
    );
  });

  for (const options of [
    { forceDocument: 'yes' },
    { asImage: 1 },
    { spoiler: 'yes' },
    { voiceNote: 'yes' },
    { supportsStreaming: 1 },
    { videoNote: 'yes' },
    { nosoundVideo: 1 },
    { ttlSeconds: -1 },
    { ttlSeconds: 2147483648 },
    { ttlSeconds: 0.5 },
    { videoTimestamp: -1 },
    { mimeType: 17 },
    { attributes: [{}] },
    { attributes: [{ _: 'documentAttributeAudio', duration: 'bad' }] },
    { thumb: {} },
    { thumb: { _: 'inputPhotoEmpty' } },
    { stickers: [{ _: 'inputPhotoEmpty' }] },
    { workers: 17 },
    { progressCallback: 'bad' },
    { filename: 17 },
    { videoCover: { _: 'inputPeerSelf' } },
  ]) {
    it(`validates later ${style} album media options ${JSON.stringify(options)} before any source consumption`, async () => {
      const { client, calls } = fixture();
      let consumed = 0;
      const file = new InputFile(() => {
        consumed++;
        return new Uint8Array([1]);
      }, 'one.txt');
      await assert.rejects(
        target(client).sendAlbum(peer, [
          { file },
          { file: uploaded('two.txt'), ...options },
        ]),
        /media|attribute|MIME|boolean|integer|InputPhoto|InputDocument|Upload/i
      );
      assert.equal(consumed, 0);
      assert.equal(calls.length, 0);
    });
  }
}

it('retains reused media flags and explicitly overrides them without aliasing caller references', async () => {
  const { client, calls } = fixture();
  const file = {
    _: 'inputMediaPhoto',
    id: photo,
    spoiler: true,
    ttl_seconds: 9,
  };
  await client.sendFile(peer, { file });
  assert.deepEqual(calls[0][1].media, file);
  assert.notEqual(calls[0][1].media.id.file_reference, photo.file_reference);
  await client.sendFile(peer, { file, spoiler: false, ttlSeconds: 0 });
  assert.equal(calls[1][1].media.spoiler, false);
  assert.equal(calls[1][1].media.ttl_seconds, 0);
  assert.equal(file.spoiler, true);
  assert.equal(file.ttl_seconds, 9);
});

it('supports canonical media field spellings beside account SDK aliases', async () => {
  const { client, calls } = fixture();
  await client.sendFile(peer, {
    file: uploaded('clip.mp4'),
    nosound_video: true,
    ttl_seconds: 0,
    video_cover: photo,
    video_timestamp: 7,
  });
  assert.equal(calls[0][1].media.nosound_video, true);
  assert.equal(calls[0][1].media.ttl_seconds, 0);
  assert.equal(calls[0][1].media.video_timestamp, 7);
  assert.deepEqual(calls[0][1].media.video_cover, photo);
});

it('creates round video notes without copying the SDK accidental voice-audio attribute', async () => {
  const { client, calls } = fixture();
  await client.sendFile(peer, { file: uploaded('clip.mp4'), videoNote: true });
  const attributes = calls[0][1].media.attributes;
  assert.equal(
    attributes.find((value) => value._ === 'documentAttributeVideo')
      .round_message,
    true
  );
  assert(!attributes.some((value) => value._ === 'documentAttributeAudio'));
});

it('preserves stickers and live-photo video references with exact detached IDs', async () => {
  const { client, calls } = fixture();
  const document = { ...photo, _: 'inputDocument' };
  await client.sendFile(peer, {
    file: uploaded('photo.jpg'),
    stickers: [document],
    livePhoto: true,
    video: document,
  });
  const media = codec.decode(codec.encode(calls[0][1].media));
  assert.equal(media.live_photo, true);
  assert.equal(media.video.id, document.id);
  assert.equal(media.stickers[0].access_hash, document.access_hash);
  assert.notEqual(
    calls[0][1].media.video.file_reference,
    document.file_reference
  );
});

for (const settings of [
  { livePhoto: true },
  { livePhoto: false, video: { _: 'inputDocumentEmpty' } },
]) {
  it(`rejects inconsistent live-photo flags ${JSON.stringify(settings)} before consumption`, async () => {
    const { client, calls } = fixture();
    let consumed = false;
    const file = new InputFile(() => {
      consumed = true;
      return new Uint8Array([1]);
    }, 'photo.jpg');
    await assert.rejects(
      client.sendFile(peer, { file, ...settings }),
      /live.photo/i
    );
    assert.equal(consumed, false);
    assert.equal(calls.length, 0);
  });
}

it('retains live-photo video references while converting album uploads to reusable media', async () => {
  const { client, calls } = fixture();
  const video = { ...photo, _: 'inputDocument' };
  await client.sendAlbum(peer, [
    { file: uploaded('photo.jpg'), livePhoto: true, video },
    { file: uploaded('photo2.jpg') },
  ]);
  const media = codec.decode(
    codec.encode(calls.at(-1)[1].multi_media[0].media)
  );
  assert.equal(media.live_photo, true);
  assert.deepEqual(media.video, video);
});

for (const style of ['gramjs', 'teleproto']) {
  for (const action of ['reply', 'edit']) {
    it(`infers ${style} bound-message ${action} replacement media`, async () => {
      const { message, calls } = await ownedMessage(style);
      await message[action]({
        file: uploaded(),
        message: 'caption',
        text: 'caption',
        spoiler: true,
      });
      assert.equal(calls.at(-1)[1].media._, 'inputMediaUploadedPhoto');
      assert.equal(calls.at(-1)[1].media.spoiler, true);
    });
  }
}
