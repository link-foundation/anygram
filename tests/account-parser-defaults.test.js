import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  Anygram,
  createAdapter,
  createClient,
  MarkdownParser,
  bold,
  InputFile,
  TelegramError,
} from '../src/index.js';
import {
  ownedMessage,
  messagePage,
  canonical,
} from './fixtures/account-message-models.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { buttonPage } from './fixtures/account-buttons.js';

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
const entity = { _: 'messageEntityBold', offset: 0, length: 3 };
const actions = {
  send: ({ client, style }, options) =>
    client[style].sendMessage(peer, { message: '**Ada**', ...options }),
  file: ({ client, style }, options) =>
    client[style].sendFile(peer, { file, caption: '**Ada**', ...options }),
  album: ({ client, style }, options) =>
    client[style].sendAlbum(peer, [file, file], {
      caption: ['**Ada**', '**Ada**'],
      ...options,
    }),
  reply: ({ message }, options) =>
    message.reply({ message: '**Ada**', ...options }),
  edit: ({ message }, options) => message.edit({ text: '**Ada**', ...options }),
  fileReply: ({ message }, options) =>
    message.reply({ file, message: '**Ada**', ...options }),
  fileEdit: ({ message }, options) =>
    message.edit({ file, text: '**Ada**', ...options }),
};

function captions(calls) {
  return calls.flatMap(([, params]) => params.multi_media ?? [params]);
}

for (const style of ['gramjs', 'teleproto']) {
  it(`defaults ${style} to Markdown while canonical operations remain plain`, async () => {
    const { client, calls } = await ownedMessage(style);
    assert.equal(client.parseMode, undefined);
    assert.equal(client[style].parseMode, MarkdownParser);
    await client.sendMessage(peer, '**Ada**');
    await client.sendFile(peer, { file, caption: '**Ada**' });
    await client.sendAlbum(peer, [file, file], {
      caption: ['**Ada**', '**Ada**'],
    });
    assert.equal(calls.length, 3);
    assert(captions(calls).every((entry) => entry.message === '**Ada**'));
  });

  for (const [action, run] of Object.entries(actions)) {
    it(`disables ${style} default Markdown for ${action} with per-call false`, async () => {
      const fixture = { ...(await ownedMessage(style)), style };
      await run(fixture, { parseMode: false });
      assert.equal(fixture.calls.length, 1);
      for (const caption of captions(fixture.calls)) {
        assert.equal(caption.message, '**Ada**');
        assert.deepEqual(caption.entities, []);
      }
      assert.equal(fixture.client[style].parseMode, MarkdownParser);
    });

    for (const parseMode of [undefined, null]) {
      it(`inherits ${style} default Markdown for ${action} with ${parseMode}`, async () => {
        const fixture = { ...(await ownedMessage(style)), style };
        await run(fixture, { parseMode });
        assert.equal(fixture.calls.length, 1);
        for (const caption of captions(fixture.calls)) {
          assert.equal(caption.message, 'Ada');
          assert.deepEqual(caption.entities, [entity]);
          assert.equal(fixture.calls[0][1].peer.access_hash, 17n);
        }
      });
    }
  }

  it(`uses ${style} default Markdown for detached text reads and atomic writes`, async () => {
    const page = messagePage();
    page.messages[0].message = 'Ada';
    page.messages[0].entities = [entity];
    const { client, message } = await ownedMessage(style, page);
    assert.equal(message.text, '**Ada**');
    message.text = '**Bob**';
    assert.equal(message.rawText, 'Bob');
    assert.deepEqual(canonical(message.entities), [entity]);
    assert.equal(page.messages[0].message, 'Ada');
    client.setParseMode(false);
    assert.equal(message.text, 'Bob');
    message.text = '**Literal**';
    assert.equal(message.rawText, '**Literal**');
    assert.deepEqual(message.entities, []);
  });

  for (const mode of [false, null, undefined]) {
    it(`retains explicit ${style} global disable ${mode} across operations and scopes`, async () => {
      const fixture = { ...(await ownedMessage(style)), style };
      fixture.client[style].setParseMode(mode);
      const scoped = fixture.client.withBackend('native');
      assert.equal(scoped[style].parseMode, undefined);
      for (const run of Object.values(actions)) {
        await run({ ...fixture, client: scoped });
      }
      assert.equal(fixture.calls.length, 7);
      assert(
        captions(fixture.calls).every((entry) => entry.message === '**Ada**')
      );
      scoped.setParseMode('html');
      assert.equal(fixture.client[style].parseMode, undefined);
    });
  }

  it(`copies unconfigured ${style} defaults into independently selected scopes`, async () => {
    const { client } = await ownedMessage(style);
    const scoped = client.withBackend('native');
    assert.equal(scoped.parseMode, undefined);
    assert.equal(scoped[style].parseMode, MarkdownParser);
    scoped.setParseMode(false);
    assert.equal(scoped[style].parseMode, undefined);
    assert.equal(client[style].parseMode, MarkdownParser);
  });

  it(`preserves the ${style} default after invalid configuration`, async () => {
    const { client } = await ownedMessage(style);
    assert.throws(() => client.setParseMode('invalid'), TypeError);
    assert.equal(client[style].parseMode, MarkdownParser);
    client.setParseMode(false);
    assert.throws(() => {
      client.parseMode = {};
    }, TypeError);
    assert.equal(client[style].parseMode, undefined);
  });

  it(`resolves exact ${style} default Markdown mentions from loaded peers`, async () => {
    const page = messagePage();
    page.users.push({
      _: 'user',
      id: 9007199254740993n,
      access_hash: 9007199254740995n,
    });
    const { client, calls, message } = await ownedMessage(style, page);
    await client[style].sendMessage(peer, {
      message: '[Ada](tg://user?id=9007199254740993)',
    });
    await message.reply({ message: '[Ada](tg://user?id=9007199254740993)' });
    for (const [, params] of calls) {
      assert.equal(params.message, 'Ada');
      assert.deepEqual(params.entities, [
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
    assert.equal(calls.length, 2);
  });

  for (const action of [
    'send',
    'file',
    'album',
    'reply',
    'edit',
    'fileReply',
    'fileEdit',
  ]) {
    it(`keeps ${style} default ${action} cancellation before source consumption`, async () => {
      const fixture = { ...(await ownedMessage(style)), style };
      let consumed = false;
      const source = new InputFile(() => {
        consumed = true;
        return new Uint8Array([1]);
      });
      const reason = new Error('stop default formatting');
      await assert.rejects(
        actions[action](fixture, {
          signal: globalThis.AbortSignal.abort(reason),
          ...(action.toLowerCase().includes('file') ? { file: source } : {}),
        }),
        (error) => error === reason || error.cause === reason
      );
      assert.equal(consumed, false);
      assert.deepEqual(fixture.calls, []);
    });
  }

  for (const parseMode of [undefined, false, null]) {
    it(`retains factory ${style} parsing state ${parseMode}`, async () => {
      const client = await createClient({
        parseMode,
        apiId: 12345,
        apiHash: 'example',
        transport: {
          request: () => assert.fail('Factory opened a connection'),
        },
      });
      assert.equal(
        client[style].parseMode,
        parseMode === undefined ? MarkdownParser : undefined
      );
      assert.equal(
        client.withBackend('native')[style].parseMode,
        client[style].parseMode
      );
    });
  }

  for (const mode of [false, null]) {
    it(`retains constructor ${style} disable ${mode}`, async () => {
      const client = new Anygram({ parseMode: mode });
      assert.equal(client[style].parseMode, undefined);
      assert.equal(client.parseMode, undefined);
    });
  }

  it(`keeps ${style} explicit entities and FormattedText above default parsing`, async () => {
    const fixture = { ...(await ownedMessage(style)), style };
    await actions.send(fixture, { entities: [] });
    await actions.file(fixture, { formattingEntities: [] });
    await fixture.client[style].sendMessage(peer, { message: bold('Ada') });
    assert.deepEqual(
      captions(fixture.calls).map((entry) => entry.message),
      ['**Ada**', '**Ada**', 'Ada']
    );
    assert.deepEqual(
      captions(fixture.calls).map((entry) => entry.entities),
      [[], [], [entity]]
    );
  });

  for (const configured of [false, true]) {
    it(`keeps ${style} keyboard labels literal with ${configured ? 'custom' : 'default'} parsing`, async () => {
      const page = buttonPage(style, ['text']);
      page.messages[0].reply_markup.rows[0].buttons[0].text = '**Ada**';
      const { client, message, calls } = await ownedMessage(style, page);
      if (configured) {
        client.setParseMode({
          parse: () => assert.fail('Keyboard label reached a parser'),
          unparse: (text) => text,
        });
      }
      await message.click({});
      assert.equal(calls.length, 1);
      assert.equal(calls[0][1].message, '**Ada**');
      assert.deepEqual(calls[0][1].entities ?? [], []);
    });
  }

  for (const parseMode of [undefined, null]) {
    it(`inherits configured ${style} album modes for an empty per-item override ${parseMode}`, async () => {
      const { client, calls } = await ownedMessage(style);
      client.setParseMode('html');
      await client[style].sendAlbum(peer, [
        { file, caption: '<b>Ada</b>', parseMode },
        { file, caption: '<b>Ada</b>', parseMode: false },
      ]);
      const [first, second] = calls[0][1].multi_media;
      assert.equal(first.message, 'Ada');
      assert.deepEqual(first.entities, [entity]);
      assert.equal(second.message, '<b>Ada</b>');
      assert.deepEqual(second.entities, []);
    });
  }
}

for (const kind of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  for (const style of ['gramjs', 'teleproto']) {
    it(`retains selected ${kind} default ${style} errors without replay`, async () => {
      const failure = Object.assign(new Error('FLOOD_WAIT_7'), { code: 420 });
      let submitted = 0;
      const client = new Anygram({
        backend: kind,
        adapters: [
          createAdapter(
            'unused',
            { call: () => assert.fail('Replayed failed send') },
            { kind: 'mtproto' }
          ),
          createAdapter(
            kind,
            {
              invoke: async () => {
                submitted++;
                throw failure;
              },
              call: async () => {
                submitted++;
                throw failure;
              },
            },
            {
              kind: kind === 'native' ? 'mtproto' : kind,
              Api: kind === 'gramjs' ? GramApi : TeleApi,
            }
          ),
        ],
      });
      await assert.rejects(
        client[style].sendMessage(peer, { message: '**Ada**' }),
        (error) =>
          error instanceof TelegramError &&
          error.cause === failure &&
          error.backend === kind &&
          error.retryAfter === 7
      );
      assert.equal(submitted, 1);
    });

    it(`uses default ${style} Markdown solely through selected ${kind}`, async () => {
      const calls = [];
      const invoke = (request) => {
        calls.push(objectRequest(requestOf(request)));
        return { _: 'updatesTooLong' };
      };
      const client = new Anygram({
        backend: kind,
        adapters: [
          createAdapter(
            'unused',
            { call: () => assert.fail('Unselected backend') },
            { kind: 'mtproto' }
          ),
          createAdapter(
            kind,
            {
              sendMessage: () =>
                assert.fail('Vendor helper bypassed owned default'),
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
      await client[style].sendMessage(peer, { message: '**Ada**' });
      assert.equal(calls[0].message, 'Ada');
      assert.deepEqual(calls[0].entities, [entity]);
      client.setParseMode(false);
      await client.sendMessage(peer, '**Ada**');
      assert.equal(calls[1].message, '**Ada**');
    });
  }
}

for (const kind of ['gramjs', 'teleproto']) {
  it(`retains canonical plain text over ${kind} with an implicit vendor parser`, async () => {
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          kind,
          {
            sendMessage: () =>
              assert.fail(
                'Implicit vendor Markdown leaked into canonical send'
              ),
            invoke: async (request) => {
              calls.push(objectRequest(requestOf(request)));
              return { _: 'updatesTooLong' };
            },
          },
          { kind, Api: kind === 'gramjs' ? GramApi : TeleApi }
        ),
      ],
    });
    await client.sendMessage(peer, '**Ada**');
    assert.equal(calls[0].message, '**Ada**');
  });
}

for (const kind of ['gramjs', 'teleproto']) {
  it(`keeps canonical plain and facade Markdown on high-level-only ${kind}`, async () => {
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          kind,
          {
            async sendMessage(
              destination,
              { message, parseMode = MarkdownParser }
            ) {
              calls.push(destination);
              const [text] =
                parseMode === false ? [message] : parseMode.parse(message);
              return {
                _: 'message',
                id: calls.length,
                peer_id: { _: 'peerUser', user_id: 9n },
                message: text,
              };
            },
          },
          { kind }
        ),
      ],
    });
    assert.equal(
      (await client.sendMessage(peer, '**Ada**')).message,
      '**Ada**'
    );
    assert.equal(
      (await client.sendMessage(peer, '**Ada**', { parseMode: null })).message,
      '**Ada**'
    );
    assert.equal(
      (await client[kind].sendMessage(peer, { message: '**Ada**' })).message,
      'Ada'
    );
    client.setParseMode(undefined);
    assert.equal(
      (await client[kind].sendMessage(peer, { message: '**Ada**' })).message,
      '**Ada**'
    );
    assert.equal(calls.length, 4);
  });
}
