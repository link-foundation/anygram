import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, Api, InputFile, bold, createAdapter } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import {
  ownedMessage,
  messagePage,
} from './fixtures/account-message-models.js';
import { objectRequest, requestOf } from '../src/requests.js';

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
const actions = {
  file: (client, options) =>
    client.sendFile(peer, { file, caption: '**Ada**', ...options }),
  album: (client, options) =>
    client.sendAlbum(peer, [options?.file ?? file, file], {
      caption: ['**Ada**', '**Bob**'],
      ...options,
    }),
  edit: (client, options) =>
    client.editMessage(peer, { file, id: 7, text: '**Ada**', ...options }),
};

for (const [action, send] of Object.entries(actions)) {
  it(`resolves exact ${action} caption mention IDs with source access hashes`, async () => {
    const page = messagePage();
    page.users.push({
      _: 'user',
      id: 9007199254740993n,
      access_hash: 9007199254740995n,
      first_name: 'Exact',
    });
    const { client, calls } = await ownedMessage('teleproto', page);
    await client.getMessages(peer);
    client.setParseMode('md');
    const source = '[Ada](tg://user?id=9007199254740993)';
    await send(client, { caption: [source, source], text: source });
    for (const item of calls[0][1].multi_media ?? [calls[0][1]]) {
      assert.equal(item.message, 'Ada');
      assert.deepEqual(item.entities, [
        {
          _: 'inputMessageEntityMentionName',
          offset: 0,
          length: 3,
          user_id: {
            _: 'inputUser',
            user_id: 9007199254740993n,
            access_hash: 9007199254740995n,
          },
        },
      ]);
    }
  });

  for (const kind of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
    it(`keeps selected ${kind} ${action} failures without replay`, async () => {
      const calls = [];
      const fail = (method) => {
        calls.push(method);
        throw Object.assign(new Error('CHAT_WRITE_FORBIDDEN'), { code: 403 });
      };
      const client = new Anygram({
        backend: kind,
        parseMode: 'md',
        adapters: [
          createAdapter(
            'unused',
            { call: () => assert.fail('Failure replayed') },
            { kind: 'mtproto' }
          ),
          createAdapter(
            kind,
            {
              sendFile: () =>
                assert.fail('Vendor helper bypassed shared parsing'),
              sendAlbum: () =>
                assert.fail('Vendor helper bypassed shared parsing'),
              editMessage: () =>
                assert.fail('Vendor helper bypassed shared parsing'),
              invoke: async (request) =>
                fail(objectRequest(requestOf(request))._),
              call: async (method) =>
                fail(typeof method === 'string' ? method : method._),
            },
            {
              kind: kind === 'native' ? 'mtproto' : kind,
              Api: kind === 'gramjs' ? GramApi : TeleApi,
            }
          ),
        ],
      });
      await assert.rejects(send(client), {
        type: 'CHAT_WRITE_FORBIDDEN',
        code: 403,
        backend: kind,
      });
      assert.deepEqual(calls, [
        `messages.${action === 'album' ? 'sendMultiMedia' : action === 'edit' ? 'editMessage' : 'sendMedia'}`,
      ]);
    });
  }

  it(`stops ${action} after a parser aborts before upload`, async () => {
    const controller = new globalThis.AbortController();
    let consumed = false;
    const source = new InputFile(() => {
      consumed = true;
      return new Uint8Array([1]);
    });
    const { client, calls } = await ownedMessage('teleproto');
    const parseMode = {
      parse: () => {
        controller.abort();
        return ['Ada', []];
      },
      unparse: (text) => text,
    };
    await assert.rejects(
      send(client, { file: source, parseMode, signal: controller.signal }),
      (error) => error.cause?.name === 'AbortError'
    );
    assert.equal(consumed, false);
    assert.deepEqual(calls, []);
  });

  it(`preserves ${action} caption lookup failures before upload`, async () => {
    let consumed = false;
    const source = new InputFile(() => {
      consumed = true;
      return new Uint8Array([1]);
    });
    const calls = [];
    const client = new Anygram({
      parseMode: 'md',
      adapters: [
        createAdapter(
          'selected',
          {
            async call(method) {
              calls.push(method);
              throw Object.assign(new Error('USERNAME_NOT_OCCUPIED'), {
                code: 400,
              });
            },
          },
          { kind: 'mtproto' }
        ),
      ],
    });
    const caption = '[Ada](@missing)';
    await assert.rejects(
      action === 'album'
        ? client.sendAlbum(peer, [
            { file: source, caption: 'valid' },
            { file: source, caption },
          ])
        : send(client, { file: source, caption, text: caption }),
      { backend: 'selected', type: 'USERNAME_NOT_OCCUPIED', code: 400 }
    );
    assert.equal(consumed, false);
    assert.deepEqual(calls, ['contacts.resolveUsername']);
  });

  for (const invalid of [
    { caption: 'x'.repeat(4194305), text: 'x'.repeat(4194305) },
    {
      entities: Array.from({ length: 1001 }, () => ({
        _: 'messageEntityBold',
        offset: 0,
        length: 1,
      })),
    },
    { entities: [{ _: 'messageEntityBold', offset: -1, length: 1 }] },
  ]) {
    it(`rejects bounded ${action} caption overflow before upload`, async () => {
      let consumed = false;
      const source = new InputFile(() => {
        consumed = true;
        return new Uint8Array([1]);
      });
      const { client, calls } = await ownedMessage('teleproto');
      const entries = [{ file: source }, { file: source, ...invalid }];
      await assert.rejects(
        action === 'album'
          ? client.sendAlbum(peer, entries)
          : send(client, { file: source, ...invalid }),
        /limit|bounds/
      );
      assert.equal(consumed, false);
      assert.deepEqual(calls, []);
    });
  }
}

it('keeps file/album caller captions, entities and media independently owned', async () => {
  const { client, calls } = await ownedMessage('teleproto');
  const entities = [new Api.MessageEntityBold({ offset: 0, length: 3 })];
  const options = Object.freeze({
    file,
    caption: 'Ada',
    entities: Object.freeze(entities),
  });
  const album = Object.freeze([
    options,
    Object.freeze({ file, caption: bold('Bob') }),
  ]);
  const prior = globalThis.structuredClone({ file, entities, album });
  await client.sendFile(peer, options);
  await client.sendAlbum(peer, album);
  calls[0][1].entities[0].offset = 2;
  calls[0][1].media.id.file_reference[0] = 7;
  calls[1][1].multi_media[0].entities[0].length = 1;
  assert.deepEqual(
    globalThis.structuredClone({ file, entities, album }),
    prior
  );
});

for (const kind of ['gramjs', 'teleproto']) {
  it(`routes FormattedText caption arrays through selected ${kind} shared parsing`, async () => {
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          kind,
          {
            sendAlbum: () => assert.fail('FormattedText reached vendor helper'),
            invoke: async (request) => {
              calls.push(objectRequest(requestOf(request)));
              return { _: 'updatesTooLong' };
            },
          },
          { kind, Api: kind === 'gramjs' ? GramApi : TeleApi }
        ),
      ],
    });
    await client.sendAlbum(peer, [file, file], {
      caption: [bold('Ada'), bold('Bob')],
    });
    assert.deepEqual(
      calls[0].multi_media.map((item) => item.message),
      ['Ada', 'Bob']
    );
    assert.deepEqual(
      calls[0].multi_media.map((item) => item.entities[0]._),
      ['messageEntityBold', 'messageEntityBold']
    );
  });
}

for (const style of ['gramjs', 'teleproto']) {
  it(`retains ${style} loaded mention peers for file and album captions`, async () => {
    const { client, calls } = await ownedMessage(style);
    client.setParseMode('md');
    const caption = '[Ada](tg://user?id=9)';
    await client[style].sendFile(peer, { file, caption });
    await client[style].sendAlbum(peer, [file, file], {
      caption: [caption, caption],
    });
    for (const request of calls.map(([, params]) => params)) {
      for (const item of request.multi_media ?? [request]) {
        assert.deepEqual(item.entities[0].user_id, {
          _: 'inputUser',
          user_id: 9n,
          access_hash: 17n,
        });
      }
    }
  });
}
