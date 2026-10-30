import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter, bold, InputFile, Api } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { gramRequest, requestOf, objectRequest } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { ownedMessage } from './fixtures/account-message-models.js';
import * as GramUtils from 'telegram/Utils.js';
import * as TeleUtils from 'teleproto/Utils.js';
import { mediaValues, mediaCastCases } from './fixtures/account-media-casts.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const file = {
  _: 'inputMediaPhoto',
  id: {
    _: 'inputPhoto',
    id: 11n,
    access_hash: 13n,
    file_reference: new Uint8Array([1]),
  },
};
const strong = [{ _: 'messageEntityBold', offset: 3, length: 3 }];
const parser = {
  parse: (source) => [source.replace('<b>', '').replace('</b>', ''), strong],
  unparse: (text) => text,
};

function setup(parseMode) {
  const calls = [];
  const client = new Anygram({
    parseMode,
    adapters: [
      createAdapter(
        'native',
        {
          async call(method, params) {
            calls.push([method, params]);
            return { _: 'updatesTooLong' };
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  return { client, calls };
}

for (const [mode, source] of [
  ['html', '🚀 <b>Ada</b>'],
  ['md', '🚀 **Ada**'],
  ['md2', '🚀 *Ada*'],
  [parser, '🚀 <b>Ada</b>'],
]) {
  for (const style of ['canonical', 'gramjs', 'teleproto']) {
    it(`shares ${typeof mode === 'string' ? mode : 'callback'} ${style} file and album captions`, async () => {
      const { client, calls } = setup(mode);
      const target = style === 'canonical' ? client : client[style];
      await target.sendFile(peer, {
        file,
        caption: source,
        randomId: 31n,
        parseMode: undefined,
      });
      await target.sendAlbum(peer, [file, file], {
        caption: [source, source],
        parseMode: undefined,
      });
      assert.equal(calls[0][0], 'messages.sendMedia');
      assert.equal(calls[0][1].message, '🚀 Ada');
      assert.deepEqual(calls[0][1].entities, strong);
      assert.equal(calls[0][1].random_id, 31n);
      const album = calls[1][1];
      assert.equal(calls[1][0], 'messages.sendMultiMedia');
      for (const item of album.multi_media) {
        assert.equal(item.message, '🚀 Ada');
        assert.deepEqual(item.entities, strong);
      }
      assert.equal(album.peer.access_hash, 17n);
    });
  }
}

it('accepts first-caption arrays for single files and scalar first-only album captions', async () => {
  const { client, calls } = setup('md');
  await client.sendFile(peer, { file, caption: ['**Ada**', 'unused'] });
  await client.sendFile(peer, { file: [file, file], caption: '**Ada**' });
  assert.equal(calls[0][1].message, 'Ada');
  assert.equal(calls[1][1].multi_media[0].message, 'Ada');
  assert.equal(calls[1][1].multi_media[1].message, '');
  assert.deepEqual(calls[1][1].multi_media[1].entities, []);
});

it('preserves explicit first-caption and per-item entities over parsing', async () => {
  const { client, calls } = setup({
    parse: () => assert.fail('Explicit entities reached the parser'),
    unparse: (text) => text,
  });
  await client.sendFile(peer, {
    file,
    caption: '**Ada**',
    formattingEntities: [],
  });
  await client.sendAlbum(
    peer,
    [file, { file, caption: '*second*', entities: [] }],
    {
      caption: '**first**',
      formattingEntities: [],
    }
  );
  assert.equal(calls[0][1].message, '**Ada**');
  assert.deepEqual(calls[0][1].entities, []);
  assert.deepEqual(
    calls[1][1].multi_media.map((item) => item.message),
    ['**first**', '*second*']
  );
  assert.deepEqual(
    calls[1][1].multi_media.map((item) => item.entities),
    [[], []]
  );
});

it('uses per-item caption modes and detached formatted text', async () => {
  const { client, calls } = setup('md');
  await client.sendAlbum(peer, [
    { file, caption: '<b>Ada</b>', parseMode: 'html' },
    { file, caption: bold('Bob') },
    { file, caption: '**literal**', parseMode: false },
  ]);
  const items = calls[0][1].multi_media;
  assert.deepEqual(
    items.map((item) => item.message),
    ['Ada', 'Bob', '**literal**']
  );
  assert.deepEqual(
    items.map((item) => item.entities),
    [
      [{ _: 'messageEntityBold', offset: 0, length: 3 }],
      [{ _: 'messageEntityBold', offset: 0, length: 3 }],
      [],
    ]
  );
});

it('does not spread first-caption formatting onto later album entries', async () => {
  const { client, calls } = setup('md');
  await client.sendAlbum(peer, [file, file], {
    caption: ['**literal**', '**Ada**'],
    formattingEntities: [],
  });
  const [first, second] = calls[0][1].multi_media;
  assert.equal(first.message, '**literal**');
  assert.deepEqual(first.entities, []);
  assert.equal(second.message, 'Ada');
  assert.deepEqual(second.entities, [
    { _: 'messageEntityBold', offset: 0, length: 3 },
  ]);
});

for (const action of ['file', 'album']) {
  it(`validates all ${action} captions before consuming an upload`, async () => {
    let consumed = false;
    const source = new InputFile(() => {
      consumed = true;
      return new Uint8Array([1]);
    });
    const { client, calls } = setup('md2');
    const invalid = '![x](tg://emoji?id=0)';
    await assert.rejects(
      action === 'file'
        ? client.sendFile(peer, { file: source, caption: invalid })
        : client.sendAlbum(peer, [
            { file: source, caption: 'valid' },
            { file: source, caption: invalid },
          ]),
      /identifier/
    );
    assert.equal(consumed, false);
    assert.deepEqual(calls, []);
  });
}

it('keeps album random IDs independent of top-level options', async () => {
  const { client, calls } = setup('md');
  await client.sendAlbum(peer, [file, file, { file, randomId: 71n }], {
    randomId: 31n,
  });
  const ids = calls[0][1].multi_media.map((item) => item.random_id);
  assert.equal(new Set(ids).size, 3);
  assert.equal(ids[2], 71n);
  assert(!ids.includes(31n));
});

it('lets per-item entities override first-caption inherited formatting', async () => {
  const { client, calls } = setup('md');
  const entities = [{ _: 'messageEntityItalic', offset: 0, length: 3 }];
  await client.sendAlbum(peer, [{ file, caption: 'Ada', entities }, file], {
    formattingEntities: [],
  });
  assert.deepEqual(calls[0][1].multi_media[0].entities, entities);
});

for (const Vendor of [Api, GramApi, TeleApi]) {
  it(`accepts real ${Vendor === Api ? 'owned' : Vendor === GramApi ? 'GramJS' : 'teleproto'} file constructors`, async () => {
    const { client, calls } = setup('md');
    const media = gramRequest(Vendor, requestOf(file));
    await client.sendFile(peer, { file: media, caption: '**Ada**' });
    await client.sendAlbum(peer, [media, media], {
      caption: ['**Ada**', 'Bob'],
    });
    assert.deepEqual(
      calls.map(([method]) => method),
      ['messages.sendMedia', 'messages.sendMultiMedia']
    );
    const codec = new TlCodec();
    assert.deepEqual(codec.encode(calls[0][1].media), codec.encode(file));
  });
}

for (const [name, Vendor, utils] of [
  ['owned', Api, TeleUtils],
  ['GramJS', GramApi, GramUtils],
  ['teleproto', TeleApi, TeleUtils],
]) {
  for (const type of mediaCastCases.InputMedia) {
    it(`accepts reusable ${name} ${type} in caption sends`, async () => {
      const { client, calls } = setup('md');
      await client.sendFile(peer, {
        file: mediaValues(Vendor)[type],
        caption: '**Ada**',
      });
      const Reference = Vendor === GramApi ? GramApi : TeleApi;
      const expected = utils.getInputMedia(mediaValues(Reference)[type]);
      const actual = gramRequest(Reference, requestOf(calls[0][1].media));
      assert.deepEqual(
        new Uint8Array(actual.getBytes()),
        new Uint8Array(expected.getBytes())
      );
      assert.equal(calls[0][1].message, 'Ada');
    });
  }
}

for (const kind of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`routes formatted media solely through selected ${kind}`, async () => {
    const calls = [];
    const invoke = (request) => {
      calls.push(objectRequest(requestOf(request)));
      return { _: 'updatesTooLong' };
    };
    const client = new Anygram({
      backend: kind,
      parseMode: 'md',
      adapters: [
        createAdapter(
          'unused',
          { call: () => assert.fail('Unselected backend') },
          { kind: 'mtproto' }
        ),
        createAdapter(
          kind,
          {
            sendFile: () =>
              assert.fail('Vendor media helper bypassed shared parsing'),
            sendAlbum: () =>
              assert.fail('Vendor album helper bypassed shared parsing'),
            invoke: async (request) => invoke(request),
            call: async (method, params) =>
              invoke(
                typeof method === 'string' ? { _: method, ...params } : method
              ),
          },
          {
            kind: kind === 'native' ? 'mtproto' : kind,
            Api: kind === 'gramjs' ? GramApi : TeleApi,
          }
        ),
      ],
    });
    await client.sendFile(peer, { file, caption: '**Ada**' });
    await client.sendAlbum(peer, [file, file], {
      caption: ['**Ada**', '**Bob**'],
    });
    assert.equal(calls[0].message, 'Ada');
    assert.deepEqual(
      calls[1].multi_media.map((item) => item.message),
      ['Ada', 'Bob']
    );
  });
}

for (const style of ['canonical', 'gramjs', 'teleproto', 'bound']) {
  it(`routes ${style} message files through caption parsing and preserves replies`, async () => {
    const { client, message, calls } = await ownedMessage('teleproto');
    client.setParseMode('md');
    if (style === 'bound') {
      await message.reply({ file, message: '**Ada**' });
    } else if (style === 'canonical') {
      await client.sendMessage(peer, { file, message: '**Ada**' });
    } else {
      await client[style].sendMessage(peer, { file, message: '**Ada**' });
    }
    assert.equal(calls[0][0], 'messages.sendMedia');
    assert.equal(calls[0][1].message, 'Ada');
    assert.equal(calls[0][1].peer.access_hash, 17n);
    if (style === 'bound') {
      assert.deepEqual(calls[0][1].reply_to, {
        _: 'inputReplyToMessage',
        reply_to_msg_id: 7,
      });
    }
  });
}

it('resolves a single-file destination before consuming an upload', async () => {
  let consumed = false;
  const source = new InputFile(() => {
    consumed = true;
    return new Uint8Array([1]);
  });
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          async call(method) {
            calls.push(method);
            if (method === 'contacts.resolveUsername') {
              throw Object.assign(new Error('USERNAME_NOT_OCCUPIED'), {
                code: 400,
              });
            }
            return true;
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  await assert.rejects(
    client.sendFile('@missing', { file: source, caption: 'Ada' }),
    { type: 'USERNAME_NOT_OCCUPIED', backend: 'native' }
  );
  assert.equal(consumed, false);
  assert.deepEqual(calls, ['contacts.resolveUsername']);
});

for (const style of ['canonical', 'bound']) {
  it(`formats ${style} media edits and includes the replacement file`, async () => {
    const { client, message, calls } = await ownedMessage('teleproto');
    client.setParseMode('md');
    if (style === 'bound') {
      await message.edit({ file, text: '**Ada**' });
    } else {
      await client.editMessage(peer, { file, id: 7, text: '**Ada**' });
    }
    assert.equal(calls[0][0], 'messages.editMessage');
    assert.equal(calls[0][1].message, 'Ada');
    assert.deepEqual(calls[0][1].entities, [
      { _: 'messageEntityBold', offset: 0, length: 3 },
    ]);
    assert.deepEqual(calls[0][1].media, file);
  });
}

it('rejects invalid replacement-file captions before consuming the source', async () => {
  let consumed = false;
  const source = new InputFile(() => {
    consumed = true;
    return new Uint8Array([1]);
  });
  const { client, calls } = setup();
  await assert.rejects(
    client.editMessage(peer, {
      id: 7,
      file: source,
      text: 'Ada',
      entities: [{ _: 'messageEntityBold', offset: 2, length: 3 }],
    }),
    /bounds/
  );
  assert.equal(consumed, false);
  assert.deepEqual(calls, []);
});

for (const action of ['file', 'album']) {
  it(`keeps ${action} pre-abort before parsing or upload`, async () => {
    const { client, calls } = setup({
      parse: () => assert.fail('Aborted caption reached parser'),
      unparse: (text) => text,
    });
    const options = { signal: globalThis.AbortSignal.abort(), caption: 'Ada' };
    await assert.rejects(
      action === 'file'
        ? client.sendFile(peer, { ...options, file })
        : client.sendAlbum(peer, [file, file], options),
      (error) => error.cause?.name === 'AbortError'
    );
    assert.deepEqual(calls, []);
  });
}
