import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  communityFixture,
  communityStore,
} from './fixtures/community-harness.js';

it('allows corrected community input after a definite Bot API rejection', async () => {
  let reject = true;
  const fixture = await communityFixture({
    onCall(method, params) {
      if (
        reject &&
        method === 'sendMessage' &&
        params.chat_id === '@community_posts'
      ) {
        throw Object.assign(new Error('Bad Request: invalid text'), {
          error_code: 400,
        });
      }
    },
  });
  try {
    await fixture.callback(1);
    await assert.rejects(fixture.text(1, 'rejected'), /invalid text/);
    assert.equal(
      JSON.parse(fixture.store.value).users['1'].pending.phase,
      'prompt'
    );
    reject = false;
    await fixture.text(1, 'corrected');
    assert.equal(fixture.posts().length, 2);
    assert.equal(JSON.parse(fixture.store.value).users['1'].pending, undefined);
  } finally {
    await fixture.app.close();
  }
});

it('retains community ownership across a public username change', async () => {
  let renamed = false;
  const fixture = await communityFixture({
    search: async (channel, query) => {
      assert.equal(query, '@user_1');
      return [
        { id: 110, message: 'other user\n\n@user_1' },
        { id: 102, message: 'owned\n\n@user_1' },
      ];
    },
    onCall(method, params) {
      if (method === 'sendMessage' && params.chat_id === '@community_posts') {
        return { message_id: renamed ? 120 : 102 };
      }
    },
  });
  try {
    await fixture.callback(1);
    await fixture.text(1, 'owned');
    renamed = true;
    await fixture.update({
      callback_query: {
        id: 'renamed',
        from: { id: 1, username: 'new_name' },
        message: { chat: { id: 1001 } },
        data: 'lift_message',
      },
    });
    await fixture.text(1, 'updated');
    assert.equal(fixture.posts().at(-2).params.text, 'updated\n\n@new_name');
    assert.equal(fixture.posts().at(-1).params.message_id, 102);
    assert.equal(
      JSON.parse(fixture.store.value).users['1'].postUsername,
      'new_name'
    );
  } finally {
    await fixture.app.close();
  }
});

it('retires expired community history at capacity without losing active limits', async () => {
  const fixture = await communityFixture({ maxUsers: 1 });
  try {
    await fixture.callback(1);
    await fixture.text(1, 'first');
    await assert.rejects(fixture.callback(2), /user limit/);
    fixture.advance(24 * 60 * 60 * 1000);
    await fixture.callback(2);
    await fixture.text(2, 'next day');
    assert.equal(fixture.posts().length, 2);
    assert.deepEqual(Object.keys(JSON.parse(fixture.store.value).users), ['2']);
  } finally {
    await fixture.app.close();
  }
});

it('never retires an unresolved community delivery to make room', async () => {
  const fixture = await communityFixture({
    maxUsers: 1,
    onCall(method, params) {
      if (method === 'sendMessage' && params.chat_id === '@community_posts') {
        throw new Error('lost acknowledgement');
      }
    },
  });
  try {
    await fixture.callback(1);
    await assert.rejects(fixture.text(1, 'unknown'), /lost/);
    fixture.advance(48 * 60 * 60 * 1000);
    await assert.rejects(fixture.callback(2), /user limit/);
    assert.equal(
      JSON.parse(fixture.store.value).users['1'].pending.phase,
      'publishing'
    );
  } finally {
    await fixture.app.close();
  }
});

it('prevents duplicate initialization and initialization after close', async () => {
  const fixture = await communityFixture();
  try {
    await assert.rejects(fixture.app.init(), /initialized/);
    assert.equal(fixture.bot.listeners.length, 2);
  } finally {
    await fixture.app.close();
  }
  await assert.rejects(fixture.app.init(), /closed|abort/i);
  assert.equal(fixture.bot.listeners.length, 0);
});

it('compares community Date objects in milliseconds when reconciling delivery', async () => {
  let date = new Date(500000000);
  const fixture = await communityFixture({
    onCall(method, params) {
      if (method === 'sendMessage' && params.chat_id === '@community_posts') {
        throw new Error('lost acknowledgement');
      }
    },
    search: async () => [{ id: 120, message: 'same\n\n@user_1', date }],
  });
  try {
    await fixture.callback(1);
    await assert.rejects(fixture.text(1, 'same'), /lost/);
    await fixture.text(1, '/status');
    assert.equal(
      JSON.parse(fixture.store.value).users['1'].pending.phase,
      'publishing'
    );
    date = new Date(fixture.now());
    await fixture.text(1, '/status');
    assert.equal(JSON.parse(fixture.store.value).users['1'].postId, 120);
    assert.equal(fixture.posts().length, 1);
  } finally {
    await fixture.app.close();
  }
});

it('rejects malformed community cleanup state and nonstring channel names', async () => {
  for (const channelUsername of [null, { toString: () => 'community_posts' }]) {
    await assert.rejects(communityFixture({ channelUsername }), /username/);
  }
  for (const pending of [
    { action: 'post', phase: 'cleanup', newId: 6, text: 'text' },
    { action: 'post', phase: 'prompt', chatId: 1001 },
  ]) {
    const store = communityStore();
    store.value = JSON.stringify({
      version: 1,
      users: {
        1: {
          pending: {
            chatId: '1001',
            username: 'user_1',
            createdAt: 1,
            ...pending,
          },
        },
      },
    });
    await assert.rejects(communityFixture({ store }), /journal/);
  }
});

it('recovers publication after a journal failure without sending again', async () => {
  const store = communityStore();
  const save = store.save.bind(store);
  store.save = async (value) => {
    if (store.writes.length === 2) {
      throw new Error('completion write failed');
    }
    await save(value);
  };
  let fixture = await communityFixture({ store });
  try {
    await fixture.callback(1);
    await assert.rejects(fixture.text(1, 'durable intent'), /completion write/);
    assert.equal(fixture.posts().length, 1);
    assert.equal(
      JSON.parse(store.value).users['1'].pending.phase,
      'publishing'
    );
    await fixture.app.close();
    store.save = save;
    fixture = await communityFixture({
      store,
      search: async () => [
        {
          id: 101,
          message: 'durable intent\n\n@user_1',
          date: 1000000,
        },
      ],
    });
    await fixture.text(1, '/status');
    assert.equal(fixture.posts().length, 0);
    assert.equal(JSON.parse(store.value).users['1'].postId, 101);
  } finally {
    await fixture.app.close();
  }
});

it('finishes cleanup after an already deleted original without resending', async () => {
  const store = communityStore();
  store.value = JSON.stringify({
    version: 1,
    users: {
      1: {
        postId: 120,
        liftAt: 1000000000,
        pending: {
          action: 'lift',
          phase: 'cleanup',
          username: 'user_1',
          chatId: '1001',
          createdAt: 1000000000,
          oldId: 5,
          newId: 120,
          text: 'replacement\n\n@user_1',
        },
      },
    },
  });
  const fixture = await communityFixture({
    store,
    onCall(method) {
      if (method === 'deleteMessage') {
        throw new Error('Bad Request: message to delete not found');
      }
    },
  });
  try {
    await fixture.text(1, '/status');
    assert.equal(JSON.parse(store.value).users['1'].pending, undefined);
    assert.deepEqual(
      fixture.posts().map((c) => c.method),
      ['deleteMessage']
    );
  } finally {
    await fixture.app.close();
  }
});
