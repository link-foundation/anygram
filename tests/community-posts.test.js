import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  communityFixture,
  communityStore,
} from './fixtures/community-harness.js';
import { CommunityState } from '../examples/community-posts-state.js';
import { findCommunityPost } from '../examples/community-posts-search.js';

it('keeps concurrent community prompts scoped to the requesting user and chat', async () => {
  const fixture = await communityFixture();
  await fixture.callback(1);
  await fixture.callback(2);
  await fixture.text(3, 'unrelated message');
  assert.equal(fixture.posts().length, 0);
  await fixture.text(1, 'wrong chat', 9999);
  assert.equal(fixture.posts().length, 0);
  await fixture.text(2, 'second post');
  await fixture.text(1, 'first post');
  assert.deepEqual(
    fixture.posts().map((c) => c.params.text),
    ['second post\n\n@user_2', 'first post\n\n@user_1']
  );
});

it('retains the daily post limit across separate callbacks', async () => {
  const fixture = await communityFixture();
  await fixture.callback(1);
  await fixture.text(1, 'first post');
  await fixture.callback(1);
  await fixture.text(1, 'second post');
  assert.equal(fixture.posts().length, 1);
  fixture.advance(24 * 60 * 60 * 1000);
  await fixture.callback(1);
  await fixture.text(1, 'next day');
  assert.equal(fixture.posts().length, 2);
});

it('acknowledges community callback queries including unknown actions', async () => {
  const fixture = await communityFixture();
  await fixture.callback(1);
  await fixture.callback(1, 'unknown');
  assert.equal(
    fixture.calls.filter((c) => c.method === 'answerCallbackQuery').length,
    2
  );
});

it('preserves the original community post until its replacement is published', async () => {
  const fixture = await communityFixture();
  await fixture.callback(1, 'lift_message');
  assert.equal(
    fixture.calls.filter((c) => c.method === 'deleteMessage').length,
    0
  );
  await fixture.text(1, 'updated post');
  const actions = fixture.calls.filter(
    (c) => c.params.chat_id === '@community_posts'
  );
  assert.deepEqual(
    actions.map((c) => c.method),
    ['sendMessage', 'deleteMessage']
  );
  assert.equal(fixture.searches.length, 1);
});

it('retains executable evidence of the four original community failures', async () => {
  const fixture = await communityFixture({ migrated: false });
  await fixture.callback(1);
  await fixture.callback(2);
  await fixture.text(3, 'wrong author');
  assert.equal(fixture.posts().length, 2);
  await fixture.callback(1);
  await fixture.text(1, 'repeated within the day');
  assert.equal(fixture.posts().length, 3);
  assert.equal(
    fixture.calls.filter((c) => c.method === 'answerCallbackQuery').length,
    0
  );
  await fixture.callback(1, 'lift_message');
  assert.equal(
    fixture.calls.filter((c) => c.method === 'deleteMessage').length,
    1
  );
});

it('verifies channel permission and retains the original inline menu', async () => {
  const fixture = await communityFixture();
  await fixture.text(1, '/start');
  const menu = fixture.calls.find((c) => c.params.reply_markup)?.params
    .reply_markup;
  assert.deepEqual(
    menu.inline_keyboard.map((row) => row[0].callback_data),
    ['post_message', 'lift_message']
  );
  assert.equal(
    fixture.calls.filter((c) => c.method === 'getChatMember').length,
    1
  );
  await fixture.app.close();
  const denied = await communityFixture({
    onCall: (method) =>
      method === 'getChatMember' ? { status: 'member' } : undefined,
  });
  await assert.rejects(denied.text(1, '/start'), /permission/);
  assert(!denied.calls.some((c) => c.params.reply_markup));
  assert(denied.calls.some((c) => c.params.text?.includes('администратором')));
  await denied.app.close();
});

it('persists community prompts, publications and post limits across restarts', async () => {
  const store = communityStore();
  const first = await communityFixture({ store });
  await first.callback(1);
  await first.app.close();
  const resumed = await communityFixture({ store });
  await resumed.text(1, 'after restart');
  assert.equal(resumed.posts().length, 1);
  await resumed.app.close();
  const final = await communityFixture({ store });
  await final.callback(1);
  await final.text(1, 'limited after restart');
  assert.equal(final.posts().length, 0);
  assert.equal(JSON.parse(store.value).users['1'].postAt, first.now());
  await final.app.close();
});

it('expires and cancels community prompts without publishing or consuming limits', async () => {
  const fixture = await communityFixture({ promptLifetime: 100 });
  await fixture.callback(1);
  fixture.advance(100);
  await fixture.text(1, 'expired');
  assert.equal(fixture.posts().length, 0);
  await fixture.callback(1);
  await fixture.text(1, '/cancel');
  await fixture.text(1, 'cancelled');
  assert.equal(fixture.posts().length, 0);
  await fixture.callback(1);
  await fixture.text(1, 'accepted');
  assert.equal(fixture.posts().length, 1);
  await fixture.app.close();
});

it('keeps a community prompt active after nontext, empty and oversized replies', async () => {
  const fixture = await communityFixture();
  await fixture.callback(1);
  for (const text of [undefined, ' ', 'x'.repeat(4096), '/other']) {
    await fixture.text(1, text);
  }
  assert.equal(fixture.posts().length, 0);
  await fixture.text(1, 'valid');
  assert.equal(fixture.posts().length, 1);
  await fixture.app.close();
});

it('rejects missing usernames and ignores inherited callback action names', async () => {
  const fixture = await communityFixture();
  await fixture.update({
    callback_query: {
      id: 'missing',
      from: { id: 1 },
      message: { chat: { id: 1001 } },
      data: 'post_message',
    },
  });
  await fixture.callback(1, 'toString');
  assert.equal(fixture.searches.length, 0);
  assert.equal(fixture.store.value, '');
  await fixture.app.close();
});

it('uses finite account search pages and only an exact author signature', async () => {
  const pages = [];
  const fixture = await communityFixture({
    search: async (channel, query, options) => {
      pages.push({
        channel,
        query,
        offset: options.offset_id,
        limit: options.limit,
      });
      if (!options.offset_id) {
        return Array.from({ length: 100 }, (_, index) => ({
          id: 200 - index,
          message: 'not the author @user_1',
        }));
      }
      return [{ id: 100, message: 'old\n\n@user_1' }];
    },
  });
  await fixture.callback(1, 'lift_message');
  assert.deepEqual(pages, [
    { channel: '@community_posts', query: '@user_1', offset: 0, limit: 100 },
    { channel: '@community_posts', query: '@user_1', offset: 101, limit: 100 },
  ]);
  await fixture.text(1, 'lifted');
  assert.equal(
    fixture.calls.find((c) => c.method === 'deleteMessage').params.message_id,
    100
  );
  await fixture.app.close();
});

it('bounds nonprogressing and overlong account search without creating prompts', async () => {
  let calls = 0;
  const account = {
    async searchMessages() {
      calls++;
      return Array.from({ length: 100 }, (_, index) => ({
        id: 200 - index,
        message: 'other',
      }));
    },
  };
  assert.equal(
    await findCommunityPost(account, '@channel', 'user_1'),
    undefined
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    findCommunityPost(
      {
        async searchMessages() {
          calls++;
          return Array.from({ length: 100 }, (_, index) => ({
            id: 10000 - calls * 100 - index,
            message: 'other',
          }));
        },
      },
      '@channel',
      'user_1',
      { maxPages: 2 }
    ),
    /page limit/
  );
  assert.equal(calls, 2);
});

it('leaves the original and an uncertain journal entry after a failed replacement', async () => {
  const reason = new Error('ambiguous send failure');
  const fixture = await communityFixture({
    onCall(method, params) {
      if (method === 'sendMessage' && params.chat_id === '@community_posts') {
        throw reason;
      }
    },
  });
  await fixture.callback(1, 'lift_message');
  await assert.rejects(
    fixture.text(1, 'replacement'),
    (error) => error === reason
  );
  assert.equal(
    fixture.calls.filter((c) => c.method === 'deleteMessage').length,
    0
  );
  assert.equal(
    JSON.parse(fixture.store.value).users['1'].pending.phase,
    'publishing'
  );
  await fixture.text(1, 'do not resend');
  await fixture.callback(1, 'lift_message');
  assert.equal(fixture.posts().length, 1);
  await fixture.app.close();
});

it('recovers a lost publication acknowledgement by account search without resending', async () => {
  let body;
  const fixture = await communityFixture({
    onCall(method, params) {
      if (method === 'sendMessage' && params.chat_id === '@community_posts') {
        body = params.text;
        throw new Error('lost acknowledgement');
      }
    },
    search: async () =>
      body
        ? [{ id: 120, message: body, date: 1000000 }]
        : [{ id: 5, message: 'old\n\n@user_1' }],
  });
  await fixture.callback(1, 'lift_message');
  await assert.rejects(fixture.text(1, 'replacement'), /lost acknowledgement/);
  await fixture.text(1, '/status');
  assert.equal(
    fixture.posts().filter((c) => c.method === 'sendMessage').length,
    1
  );
  assert.equal(
    fixture.calls.filter((c) => c.method === 'deleteMessage').length,
    1
  );
  assert.equal(JSON.parse(fixture.store.value).users['1'].postId, 120);
  assert.equal(JSON.parse(fixture.store.value).users['1'].pending, undefined);
  await fixture.app.close();
});

it('retries durable deletion after restart without publishing a second replacement', async () => {
  const store = communityStore();
  const first = await communityFixture({
    store,
    onCall(method) {
      if (method === 'deleteMessage') {
        throw new Error('delete denied');
      }
    },
  });
  await first.callback(1, 'lift_message');
  await assert.rejects(first.text(1, 'replacement'), /delete denied/);
  assert.equal(JSON.parse(store.value).users['1'].pending.phase, 'cleanup');
  await first.app.close();
  const resumed = await communityFixture({ store });
  await resumed.text(1, '/status');
  assert.deepEqual(
    resumed.posts().map((c) => c.method),
    ['deleteMessage']
  );
  await resumed.callback(1, 'lift_message');
  await resumed.text(1, 'limited');
  assert.deepEqual(
    resumed.posts().map((c) => c.method),
    ['deleteMessage']
  );
  await resumed.app.close();
});

it('does not publish before the durable community intent succeeds', async () => {
  const store = communityStore();
  const save = store.save.bind(store);
  store.save = async (value) => {
    if (store.writes.length === 1) {
      throw new Error('journal write failed');
    }
    return save(value);
  };
  const fixture = await communityFixture({ store });
  await fixture.callback(1);
  await assert.rejects(fixture.text(1, 'blocked'), /journal write failed/);
  assert.equal(fixture.posts().length, 0);
  assert.equal(JSON.parse(store.value).users['1'].pending.phase, 'prompt');
  await fixture.app.close();
});

it('validates bounded journals before registering community listeners', async () => {
  const store = communityStore();
  for (const value of [
    'not json',
    '{"version":2,"users":{}}',
    '{"version":1,"users":{"__proto__":{}}}',
    JSON.stringify({
      version: 1,
      users: {
        1: {
          pending: {
            action: 'post',
            phase: 'prompt',
            chatId: '1001',
            createdAt: 1,
          },
        },
      },
    }),
  ]) {
    store.value = value;
    await assert.rejects(communityFixture({ store }));
  }
  const state = new CommunityState(communityStore(), {
    maxUsers: 1,
    maxBytes: 256,
  });
  await state.load();
  await state.write('1', { postAt: 0 });
  await assert.rejects(state.write('2', {}), /user limit/);
  await assert.rejects(
    state.write('1', { huge: 'x'.repeat(300) }),
    /byte limit/
  );
});

it('cancels and drains a blocked community delivery before removing its listeners', async () => {
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const fixture = await communityFixture({
    timeout: 30,
    onCall(method, params) {
      if (method === 'sendMessage' && params.chat_id === '@community_posts') {
        entered();
        return blocked;
      }
    },
  });
  const unrelated = () => {};
  fixture.bot.on('message', unrelated);
  await fixture.callback(1);
  const pending = fixture.text(1, 'cancelled');
  const rejected = assert.rejects(pending, /abort|cancel|timed out/i);
  rejected.catch(() => {});
  let watchdog;
  try {
    await ready;
    await Promise.race([
      fixture.app.close(),
      new Promise((resolve, reject) => {
        watchdog = globalThis.setTimeout(
          () => reject(new Error('Community close did not drain')),
          150
        );
      }),
    ]);
    await rejected;
    assert.equal(fixture.bot.listeners.length, 1);
    assert.equal(fixture.bot.listeners[0].callback, unrelated);
    assert.equal(
      JSON.parse(fixture.store.value).users['1'].pending.phase,
      'publishing'
    );
  } finally {
    release({ message_id: 200 });
    globalThis.clearTimeout(watchdog);
    await pending.catch(() => {});
    await rejected.catch(() => {});
    await fixture.app.close();
  }
});
