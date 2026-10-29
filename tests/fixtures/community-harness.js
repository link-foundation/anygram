import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { TelegramBot } from '../../src/index.js';

const sourcePath = new globalThis.URL(
  '../../docs/case-studies/issue-1/data/community-posts-index.js',
  import.meta.url
);

export function communityStore() {
  return {
    value: '',
    writes: [],
    async load() {
      return this.value;
    },
    async save(value) {
      this.writes.push(value);
      this.value = value;
    },
  };
}

export async function communityFixture({
  migrated = true,
  store = communityStore(),
  search = async () => [{ id: 5, message: 'old\n\n@user_1' }],
  onCall,
  ...options
} = {}) {
  const calls = [],
    searches = [];
  let clock = 1000000000,
    update = 0,
    message = 100;
  const transport = {
    async callApi(method, params = {}, settings) {
      calls.push({
        method,
        params: globalThis.structuredClone(params),
        settings,
      });
      const override = await onCall?.(method, params, settings);
      if (override !== undefined) {
        return override;
      }
      if (method === 'getMe') {
        return { id: 99, username: 'community_fixture_bot', is_bot: true };
      }
      if (method === 'getChat') {
        return { id: -1007, type: 'channel', username: 'community_posts' };
      }
      if (method === 'getChatMember') {
        return { status: 'administrator', can_post_messages: true };
      }
      return method === 'sendMessage' ? { message_id: ++message } : true;
    },
  };
  const account = {
    async searchMessages(...args) {
      searches.push(args);
      return search(...args);
    },
  };
  let bot, app;
  if (migrated) {
    const { createCommunityPosts } =
      await import('../../examples/community-posts.js');
    bot = new TelegramBot('community:fixture', { api: transport });
    app = await createCommunityPosts({
      bot,
      account,
      store,
      now: () => clock,
      ...options,
    });
  } else {
    const source = readFileSync(sourcePath);
    if (
      source.length !== 3898 ||
      createHash('sha256').update(source).digest('hex') !==
        '31f085fd3efdf7007f377c5d246a068e309f1ba02036b15ad5e84ef15b9a6224'
    ) {
      throw new Error('Pinned community source changed');
    }
    const OriginalBot = class extends TelegramBot {
      constructor(token) {
        super(token, { api: transport });
      }
    };
    bot = new Function('require', 'Date', `${source}\nreturn bot;`)(
      (name) =>
        name === 'node-telegram-bot-api'
          ? OriginalBot
          : { readFileSync: () => 'community:fixture' },
      { now: () => clock }
    );
    // Isolate the original deletion ordering after accounting for its absent
    // Bot API search method. The migrated application must use account search.
    bot.searchPublicChatMessages = async () => ({
      messages: [{ message_id: 5, text: 'old\n\n@user_1' }],
    });
  }
  const user = (id) => ({ id, username: `user_${id}` });
  const chat = (id) => ({ id: 1000 + id, type: 'private' });
  return {
    bot,
    app,
    calls,
    searches,
    store,
    options,
    now: () => clock,
    advance: (ms) => (clock += ms),
    posts: () => calls.filter((c) => c.params.chat_id === '@community_posts'),
    update: (value) => bot.processUpdate({ update_id: ++update, ...value }),
    callback: (id, action = 'post_message') =>
      bot.processUpdate({
        update_id: ++update,
        callback_query: {
          id: `callback_${update}`,
          from: user(id),
          message: { message_id: 1, chat: chat(id) },
          data: action,
        },
      }),
    text: (id, text, chatId = 1000 + id) =>
      bot.processUpdate({
        update_id: ++update,
        message: {
          message_id: update,
          from: user(id),
          chat: { id: chatId },
          text,
        },
      }),
  };
}
