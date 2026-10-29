import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api, Anygram, createAdapter } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as TeleUtils from 'teleproto/Utils.js';
import * as GramUtils from 'telegram/Utils.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { mediaValues, mediaRequest } from './fixtures/account-media-casts.js';

const noLookup = {
  getInputEntity: () => assert.fail('Unexpected peer lookup'),
};
const codec = new TlCodec();

for (const [name, Vendor, utils] of [
  ['gramjs', GramApi, GramUtils],
  ['teleproto', TeleApi, TeleUtils],
]) {
  for (const filename of [
    '',
    'dir\\track.MP3',
    'dir/clip.mp4',
    'image.png',
    'document.pdf',
    'notes.txt',
    'sound.ogg',
    'song.opus',
    'record.m4a',
    'file.unknown-extension',
  ]) {
    it(`preserves actual ${name} uploaded-document metadata for ${filename || 'unnamed'}`, async () => {
      const args = { id: 7n, parts: 1, name: filename, md5Checksum: '' };
      const request = mediaRequest(Api, 'InputMedia', new Api.InputFile(args));
      await request.resolve(noLookup);
      const expected = utils.getInputMedia(new Vendor.InputFile(args));
      assert.deepEqual(
        request.media.getBytes().subarray(4),
        expected.getBytes().subarray(4)
      );
    });
  }
}

for (const Vendor of [Api, GramApi, TeleApi]) {
  it(`casts ${Vendor.Photo.className} response data from ${Vendor === Api ? 'owned' : Vendor === GramApi ? 'GramJS' : 'teleproto'} constructors and canonical objects`, async () => {
    const source = mediaValues(Vendor).photoMessage;
    const snapshot = objectRequest({
      method: 'value',
      params: { source },
    }).source;
    for (const input of [source, snapshot]) {
      const request = mediaRequest(Api, 'InputMedia', input);
      await request.resolve(noLookup);
      const media = codec.decode(request.getBytes()).media;
      assert.equal(media._, 'inputMediaPhoto');
      assert.deepEqual(media.id, {
        _: 'inputPhoto',
        id: 7n,
        access_hash: -17n,
        file_reference: new Uint8Array([1, 2]),
      });
      assert.equal(media.ttl_seconds, 9);
    }
    assert.deepEqual(
      objectRequest({ method: 'value', params: { source } }).source,
      snapshot
    );
  });
}

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`routes response media through only the selected ${backend} adapter`, async () => {
    const calls = [];
    const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
    const check = (request) => {
      const canonical = objectRequest(requestOf(request));
      assert.equal(canonical._, 'messages.sendMedia');
      assert.equal(canonical.media._, 'inputMediaDocument');
      assert.equal(canonical.media.id.id, 7n);
      calls.push(canonical);
      return { _: 'updatesTooLong' };
    };
    const client = new Anygram({
      backend,
      adapters: [
        createAdapter(
          'unused',
          { call: () => assert.fail('Wrong backend') },
          { kind: 'mtproto' }
        ),
        createAdapter(
          backend,
          {
            invoke: async (request) => {
              assert(request instanceof Vendor.messages.SendMedia);
              assert(request.media.id instanceof Vendor.InputDocument);
              return check(request);
            },
            call: async (method, params) =>
              check(
                typeof method === 'string' ? { _: method, ...params } : method
              ),
          },
          { Api: Vendor, kind: backend === 'native' ? 'mtproto' : backend }
        ),
      ],
    });
    await client.invoke(
      mediaRequest(Api, 'InputMedia', mediaValues(Api).documentMessage)
    );
    assert.equal(calls.length, 1);
  });
}

it('resolves reusable media inside albums and generic requests while preserving specified input identities', async () => {
  const input = new Api.InputMediaPhoto({ id: mediaValues(Api).photo });
  const request = new Api.InvokeWithoutUpdates({
    query: new Api.messages.SendMultiMedia({
      peer: new Api.InputPeerSelf(),
      multiMedia: [
        new Api.InputSingleMedia({
          media: input,
          randomId: 1n,
          message: 'nested',
        }),
      ],
    }),
  });
  await request.resolve(noLookup);
  assert.equal(request.query.multiMedia[0].media, input);
  assert(input.id instanceof Api.InputPhoto);
  assert.equal(
    codec.decode(request.getBytes()).query.multi_media[0].media.id.id,
    7n
  );
});

it('sends converted document media over independent encrypted native TCP without upload RPCs', async () => {
  let calls = 0;
  const peer = await secretRpcPeer((request) => {
    calls++;
    assert.equal(request._, 'messages.sendMedia');
    assert.equal(request.media._, 'inputMediaDocument');
    assert.equal(request.media.id._, 'inputDocument');
    assert.equal(request.media.id.id, 7n);
    assert.equal(request.media.ttl_seconds, 11);
    return { _: 'updatesTooLong' };
  });
  const client = new Anygram({
    adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
  });
  try {
    await client.invoke(
      mediaRequest(Api, 'InputMedia', mediaValues(Api).documentMessage)
    );
    assert.equal(calls, 1);
  } finally {
    await client.disconnect();
    await peer.close();
  }
});

it('rejects incompatible, incomplete, cyclic and oversized media before invoking a backend', async () => {
  let calls = 0;
  const client = new Anygram({
    adapters: [
      createAdapter('native', { call: () => calls++ }, { kind: 'mtproto' }),
    ],
  });
  for (const value of [
    3,
    'file.jpg',
    { _: 'photo', id: 7n },
    { _: 'messageMediaPhoto' },
    { _: 'inputPeerSelf' },
    { _: 'constructor' },
    { _: '__proto__' },
    { _: 'toString' },
  ]) {
    await assert.rejects(
      client.invoke(mediaRequest(Api, 'InputMedia', value)),
      /resolve|method name/i
    );
  }
  const cycle = { _: 'message' };
  cycle.media = cycle;
  await assert.rejects(
    client.invoke(mediaRequest(Api, 'InputMedia', cycle)),
    /depth/i
  );
  await assert.rejects(
    client.invoke(
      new Api.photos.DeletePhotos({
        id: Array(100001).fill(mediaValues(Api).photo),
      })
    ),
    /vector/i
  );
  assert.equal(calls, 0);
});

it('rejects wrong photo/document families and pre-aborted requests before conversion', async () => {
  await assert.rejects(
    mediaRequest(Api, 'InputDocument', mediaValues(Api).photo).resolve(
      noLookup
    ),
    /InputDocument/
  );
  await assert.rejects(
    mediaRequest(Api, 'InputPhoto', mediaValues(Api).document).resolve(
      noLookup
    ),
    /InputPhoto/
  );
  const controller = new globalThis.AbortController();
  const error = new Error('media cancelled');
  controller.abort(error);
  const source = mediaValues(Api).photo;
  const request = mediaRequest(Api, 'InputMedia', source);
  await assert.rejects(
    request.resolve(noLookup, { signal: controller.signal }),
    (reason) => reason === error
  );
  assert.equal(request.media, source);
});

function quiz(Vendor = Api) {
  const text = (value) =>
    new Vendor.TextWithEntities({ text: value, entities: [] });
  const photo = mediaValues(Vendor).photoMedia;
  return new Vendor.MessageMediaPoll({
    poll: new Vendor.Poll({
      id: 7n,
      hash: 9n,
      quiz: true,
      question: text('Question'),
      answers: [
        new Vendor.PollAnswer({
          text: text('A'),
          option: Buffer.from('a'),
          media: photo,
        }),
        new Vendor.PollAnswer({ text: text('B'), option: Buffer.from('b') }),
      ],
    }),
    attachedMedia: photo,
    results: new Vendor.PollResults({
      results: [
        new Vendor.PollAnswerVoters({
          option: Buffer.from('b'),
          correct: true,
        }),
        new Vendor.PollAnswerVoters({ option: Buffer.from('a') }),
      ],
      solution: 'B',
      solutionEntities: [],
      solutionMedia: photo,
    }),
  });
}

it('uses layer-232 quiz answer indices and preserves response answer media while casting poll attachments', async () => {
  const source = quiz();
  const request = mediaRequest(Api, 'InputMedia', source);
  await request.resolve(noLookup);
  const result = codec.decode(request.getBytes()).media;
  assert.deepEqual(result.correct_answers, [1]);
  assert.equal(result.poll.answers[0].media._, 'messageMediaPhoto');
  assert.equal(result.attached_media._, 'inputMediaPhoto');
  assert.equal(result.solution_media._, 'inputMediaPhoto');
  assert.equal(result.solution, 'B');
  assert.deepEqual(result.solution_entities, []);
  assert.equal(source.poll.answers[0].media.className, 'MessageMediaPhoto');
  const vendor = TeleUtils.getInputMedia(quiz(TeleApi));
  assert.deepEqual(vendor.correctAnswers, [Buffer.from('b')]);
  assert.equal(vendor.poll.answers[0].media.className, 'InputMediaPhoto');
  assert.throws(
    () => codec.decode(vendor.getBytes()),
    /type|int|MessageMedia/i
  );
});

it('rejects unanswered quizzes, duplicate options and unknown correct options', async () => {
  for (const mode of ['unanswered', 'duplicate', 'unknown']) {
    const value = quiz();
    if (mode === 'unanswered') {
      value.results.results = undefined;
    }
    if (mode === 'duplicate') {
      value.poll.answers[0].option = Buffer.from('b');
    }
    if (mode === 'unknown') {
      value.results.results[0].option = Buffer.from('missing');
    }
    await assert.rejects(
      mediaRequest(Api, 'InputMedia', value).resolve(noLookup),
      /quiz|option/i
    );
  }
});

it('demonstrates the pinned teleproto quiz option/index difference independently of answer media', async () => {
  const vendorSource = quiz(TeleApi);
  vendorSource.poll.answers[0].media = undefined;
  const vendor = codec.decode(TeleUtils.getInputMedia(vendorSource).getBytes());
  assert.deepEqual(vendor.correct_answers, [0]);
  const source = quiz();
  source.poll.answers[0].media = undefined;
  const request = mediaRequest(Api, 'InputMedia', source);
  await request.resolve(noLookup);
  assert.deepEqual(codec.decode(request.getBytes()).media.correct_answers, [1]);
});

it('preserves ordinary poll bytes against the current SDK and casts standalone polls', async () => {
  const source = quiz();
  source.poll.quiz = false;
  source.poll.answers[0].media = undefined;
  const vendor = quiz(TeleApi);
  vendor.poll.quiz = false;
  vendor.poll.answers[0].media = undefined;
  const request = mediaRequest(Api, 'InputMedia', source);
  await request.resolve(noLookup);
  assert.deepEqual(
    request.media.getBytes(),
    TeleUtils.getInputMedia(vendor).getBytes()
  );
  const standalone = mediaRequest(Api, 'InputMedia', source.poll);
  await standalone.resolve(noLookup);
  assert.deepEqual(
    codec.decode(standalone.getBytes()).media.poll,
    codec.decode(source.poll.getBytes())
  );
});

it('bounds media shape changes made during an awaited peer lookup before the final send', async () => {
  const request = mediaRequest(Api, 'InputMedia', mediaValues(Api).photo);
  request.peer = '@alice';
  let calls = 0;
  const value = { _: 'message' };
  value.media = value;
  await assert.rejects(
    request.resolve({
      async getInputEntity() {
        calls++;
        request.media = value;
        return new Api.InputPeerSelf();
      },
    }),
    /depth/i
  );
  assert.equal(calls, 1);
});
