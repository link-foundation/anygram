import { session as grammy } from 'grammy';
import { session as telegraf } from 'telegraf';
import { grammySession, telegrafSession } from '../src/index.js';

// Two finite nested contexts, with no network, shell, or bot credentials.
for (const [label, factory, options] of [
  ['grammy', grammy, { initial: () => ({ count: 0 }) }],
  ['anygram/grammy', grammySession, { initial: () => ({ count: 0 }) }],
  ['telegraf', telegraf, { defaultSession: () => ({ count: 0 }) }],
  [
    'anygram/telegraf',
    telegrafSession,
    { defaultSession: () => ({ count: 0 }) },
  ],
]) {
  const values = new Map();
  const trace = [];
  const storage = {
    read(key) {
      trace.push(['read', key]);
      return values.get(key);
    },
    write(key, value) {
      trace.push(['write', key, value.count]);
      values.set(key, value);
    },
    delete(key) {
      trace.push(['delete', key]);
      values.delete(key);
    },
  };
  const middleware = factory({
    ...options,
    storage,
    store: { get: storage.read, set: storage.write, delete: storage.delete },
  });
  const make = (id) => ({
    update: { update_id: id },
    chatId: 7,
    chat: { id: 7 },
    from: { id: 8 },
  });
  const outer = make(1),
    inner = make(2);
  await middleware(outer, async () => {
    outer.session.count++;
    await middleware(inner, () => {
      trace.push(['inner-initial', inner.session.count]);
      inner.session = { count: 5 };
    });
    trace.push(['outer-after', outer.session.count]);
  });
  console.log(label, JSON.stringify(trace));
}
