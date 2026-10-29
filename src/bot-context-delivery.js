import { botRequestOptions } from './bot-operations.js';

// name, positional API target, data argument count, context option fields.
// b: business; t: topic-only thread; T: any thread; d: direct-message topic.
const grammy = [
  ['reply', 'sendMessage', 1, 'btd'],
  ['replyWithRichMessage', 'sendRichMessage', 1, 'btd'],
  ['replyWithLivePhoto', 'sendLivePhoto', 2, 'btd'],
  ['replyWithVideoNote', 'sendVideoNote', 1, 'btd'],
  ['replyWithPaidMedia', 'sendPaidMedia', 2, 'btd'],
  ['replyWithMediaGroup', 'sendMediaGroup', 1, 'btd'],
  ['replyWithLocation', 'sendLocation', 2, 'btd'],
  ['replyWithVenue', 'sendVenue', 4, 'btd'],
  ['replyWithContact', 'sendContact', 2, 'btd'],
  ['replyWithPoll', 'sendPoll', 2, 'bt'],
  ['replyWithChecklist', 'sendChecklist', 1, ''],
  ['replyWithDice', 'sendDice', 1, 'btd'],
  ['replyWithChatAction', 'sendChatAction', 1, 'bT'],
  ['replyWithDraft', 'sendMessageDraft', 1, 't'],
  ['replyWithRichMessageDraft', 'sendRichMessageDraft', 1, 't'],
  ['replyWithInvoice', 'sendInvoice', 5, 'td'],
  ['replyWithGame', 'sendGame', 1, 'bt'],
];
const telegraf = [
  ['sendMessage', 1],
  ['sendMediaGroup', 1],
  ['sendVideoNote', 1],
  ['sendLocation', 2],
  ['sendVenue', 4],
  ['sendContact', 2],
  ['sendPoll', 2],
  ['sendQuiz', 2],
  ['sendDice', 0],
  ['sendChatAction', 1],
  ['sendInvoice', 1],
  ['sendGame', 1],
];
for (const media of [
  'Photo',
  'Audio',
  'Document',
  'Video',
  'Animation',
  'Voice',
  'Sticker',
]) {
  grammy.push([`replyWith${media}`, `send${media}`, 1, 'btd']);
  telegraf.push([`send${media}`, 1]);
}

function required(value, method, ctx) {
  if (value !== undefined) {
    return value;
  }
  if (ctx) {
    throw new TypeError(
      `Telegraf: "${method}" isn't available for "${ctx.updateType}"`
    );
  }
  throw new Error(`Missing information for API call to ${method}`);
}

function scopedOptions(ctx, flags, other) {
  const msg = ctx.msg;
  return {
    ...(flags.includes('b') && {
      business_connection_id: ctx.businessConnectionId,
    }),
    ...((flags.includes('T') ||
      (flags.includes('t') && msg?.is_topic_message)) && {
      message_thread_id: msg?.message_thread_id,
    }),
    ...(flags.includes('d') && {
      direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
    }),
    ...botRequestOptions(other),
  };
}

function prefix(ctx, method) {
  const label = method === 'sendRichMessageDraft' ? 'sendMessageDraft' : method;
  if (method === 'sendChecklist') {
    return [
      required(ctx.businessConnectionId, label),
      required(ctx.chatId, label),
    ];
  }
  const values = [required(ctx.chatId, label)];
  if (method === 'sendMessageDraft' || method === 'sendRichMessageDraft') {
    values.push(ctx.update.update_id);
  }
  return values;
}

function installGrammy(Type) {
  for (const [name, method, count, flags] of grammy) {
    Object.defineProperty(Type.prototype, name, {
      configurable: true,
      writable: true,
      value(...args) {
        return this.api[method](
          ...prefix(this, method),
          ...Array.from({ length: count }, (_, index) => args[index]),
          scopedOptions(this, flags, args[count]),
          args[count + 1]
        );
      },
    });
  }
  alias(Type, 'sendPaidMedia', 'replyWithPaidMedia');
}

function alias(Type, name, target) {
  Object.defineProperty(Type.prototype, name, {
    configurable: true,
    writable: true,
    value(...args) {
      return this[target](...args);
    },
  });
}

function installTelegraf(Type) {
  for (const [method, count] of telegraf) {
    Object.defineProperty(Type.prototype, method, {
      configurable: true,
      writable: true,
      value(...args) {
        const chat = required(this.chat, method, this);
        const msg = this.msg;
        const options = {
          message_thread_id:
            msg?.isAccessible() && msg.is_topic_message
              ? msg.message_thread_id
              : undefined,
          ...botRequestOptions(args[count]),
        };
        return this.telegram[method](
          chat.id,
          ...Array.from({ length: count }, (_, index) => args[index]),
          options,
          ...(args[count + 1] === undefined ? [] : [args[count + 1]])
        );
      },
    });
    alias(
      Type,
      method === 'sendMessage' ? 'reply' : method.replace(/^send/, 'replyWith'),
      method
    );
  }
  for (const parse_mode of ['Markdown', 'MarkdownV2', 'HTML']) {
    Object.defineProperty(Type.prototype, `replyWith${parse_mode}`, {
      configurable: true,
      writable: true,
      value(text, options, signal) {
        return this.reply(
          text,
          { parse_mode, ...botRequestOptions(options) },
          ...(signal === undefined ? [] : [signal])
        );
      },
    });
  }
}

/** Delivery shortcuts derive only their scope; positional APIs own payloads. */
export function installContextDelivery(Type, style = 'grammy') {
  if (style === 'telegraf') {
    installTelegraf(Type);
  } else {
    installGrammy(Type);
  }
}
