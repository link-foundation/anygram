// Run without credentials: demonstrate restoring bot state after reconstruction.
import assert from 'node:assert/strict';
import { Bot, MemorySessionStore, session } from '../src/index.js';

// For process restarts, supply a persistent read/write/delete database adapter.
const storage = new MemorySessionStore();
const makeBot = () => {
  const bot = new Bot('123:offline-example', {
    botInfo: { id: 123 },
    fetch: () => assert.fail('This example makes no network requests'),
  });
  bot.use(session({ storage, initial: () => ({ count: 0 }) }));
  bot.on('message', (ctx) => {
    ctx.session.count++;
  });
  return bot;
};

const update = (id) => ({
  update_id: id,
  message: { message_id: id, chat: { id: 7 }, from: { id: 8 }, text: 'count' },
});
await makeBot().handleUpdate(update(1));
await makeBot().handleUpdate(update(2));
assert.equal(storage.read('7').count, 2);
console.log('Both reconstructed bots persisted their increments: 2');
