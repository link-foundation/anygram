import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Anygram, createAdapter } from '../src/index.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { createCommunityPosts } from '../examples/community-posts.js';
import { createCommunityBot } from '../examples/community-posts-runtime.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import {
  communityFixture,
  communityStore,
} from './fixtures/community-harness.js';
import { uploadServer } from './fixtures/bot-upload-server.js';

const channel = {
  _: 'channel',
  id: 7n,
  access_hash: -7n,
  title: 'Community',
  username: 'community_posts',
  photo: { _: 'chatPhotoEmpty' },
  date: 1,
  broadcast: true,
};
function response(request, calls) {
  calls.push(request);
  if (request._ === 'contacts.resolveUsername') {
    return {
      _: 'contacts.resolvedPeer',
      peer: { _: 'peerChannel', channel_id: 7n },
      chats: [channel],
      users: [],
    };
  }
  assert.equal(request._, 'messages.search');
  assert.equal(request.q, '@user_1');
  assert.equal(request.limit, 100);
  assert.equal(String(request.peer.channel_id), '7');
  return {
    _: 'messages.messages',
    messages: [
      {
        _: 'message',
        id: 5,
        peer_id: { _: 'peerChannel', channel_id: 7n },
        date: 1,
        message: 'old\n\n@user_1',
      },
    ],
    topics: [],
    chats: [],
    users: [],
  };
}

for (const [kind, Api] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`lifts community posts through actual ${kind} request and result serializers`, async () => {
    const calls = [];
    const account = new Anygram({
      adapters: [
        createAdapter(
          kind,
          {
            async invoke(request) {
              assert(request.getBytes().length > 4);
              return gramRequest(
                Api,
                requestOf(response(objectRequest(requestOf(request)), calls))
              );
            },
          },
          { Api }
        ),
      ],
    });
    const fixture = await communityFixture({
      search: (...args) => account.searchMessages(...args),
    });
    try {
      await fixture.callback(1, 'lift_message');
      await fixture.text(1, 'replacement');
      assert.deepEqual(
        calls.map((r) => r._),
        ['contacts.resolveUsername', 'messages.search']
      );
      assert.deepEqual(
        fixture.posts().map((r) => r.method),
        ['sendMessage', 'deleteMessage']
      );
      assert.equal(fixture.posts()[1].params.message_id, 5);
    } finally {
      await fixture.app.close();
    }
  });
}

function fields(request) {
  const body =
    request.headers['content-encoding'] === 'gzip'
      ? gunzipSync(request.body, { maxOutputLength: 64 * 1024 })
      : request.body;
  return request.headers['content-type'].includes('application/json')
    ? JSON.parse(body.toString())
    : Object.fromEntries(new globalThis.URLSearchParams(body.toString()));
}

function botResult(request) {
  const method = request.url.split('/').at(-1);
  if (method === 'getMe') {
    return { id: 99, username: 'fixture_bot', is_bot: true };
  }
  if (method === 'getChat') {
    return { id: -1007, type: 'channel' };
  }
  if (method === 'getChatMember') {
    return { status: 'administrator', can_post_messages: true };
  }
  if (method === 'sendMessage') {
    return {
      message_id: fields(request).chat_id === '@community_posts' ? 102 : 103,
    };
  }
  return true;
}

for (const backend of [
  'native',
  'grammy',
  'telegraf',
  'node-telegram-bot-api',
]) {
  it(`combines actual ${backend} bot HTTP with encrypted native account search`, async () => {
    const calls = [];
    const peer = await secretRpcPeer((request) => response(request, calls));
    const server = await uploadServer({ result: botResult, maxRequests: 16 });
    let app;
    try {
      const clientOptions = {
        grammy: { client: { apiRoot: server.root } },
        telegraf: { telegram: { apiRoot: server.root } },
        'node-telegram-bot-api': { apiRoot: server.root, maxRetries: 0 },
      }[backend];
      const bot = await createCommunityBot({
        token: '12345:abcdefghijklmnopqrstuvwxyz_123456',
        backend,
        baseUrl: server.root,
        clientOptions,
      });
      const account = new Anygram({
        adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
      });
      app = await createCommunityPosts({
        bot,
        account,
        store: communityStore(),
      });
      await bot.processUpdate({
        update_id: 1,
        message: {
          message_id: 1,
          chat: { id: 1001 },
          from: { id: 1, username: 'user_1' },
          text: '/start',
        },
      });
      await bot.processUpdate({
        update_id: 2,
        callback_query: {
          id: 'lift',
          from: { id: 1, username: 'user_1' },
          message: { chat: { id: 1001 } },
          data: 'lift_message',
        },
      });
      await bot.processUpdate({
        update_id: 3,
        message: {
          message_id: 3,
          chat: { id: 1001 },
          from: { id: 1, username: 'user_1' },
          text: 'replacement',
        },
      });
      assert.deepEqual(
        calls.map((r) => r._),
        ['contacts.resolveUsername', 'messages.search']
      );
      const operations = server.requests.map((request) => ({
        method: request.url.split('/').at(-1),
        params: fields(request),
      }));
      assert.equal(operations.length, 9);
      assert.deepEqual(
        operations
          .filter((r) => r.params.chat_id === '@community_posts')
          .map((r) => r.method),
        ['getChat', 'getChatMember', 'sendMessage', 'deleteMessage']
      );
      assert.equal(
        Number(
          operations.find((r) => r.method === 'deleteMessage').params.message_id
        ),
        5
      );
      assert(
        operations.every(
          (r) => !('signal' in r.params) && !('timeout' in r.params)
        )
      );
    } finally {
      await app?.close();
      await peer.close();
      await server.close();
    }
  });
}
