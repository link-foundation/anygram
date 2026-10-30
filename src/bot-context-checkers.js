import { matchFilter } from './bot-filter-query.js';
import { contextMethod } from './bot-context-scope.js';

function list(value) {
  if (Array.isArray(value) && value.length > 1000) {
    throw new RangeError('Context checker registration limit exceeded');
  }
  return Array.isArray(value) ? [...value] : [value];
}

function triggerCheck(query, select, trigger) {
  const accepts = checkers.filterQuery(query);
  const triggers = list(trigger);
  return (ctx) => {
    if (!accepts(ctx)) {
      return false;
    }
    const content = select(ctx);
    for (const entry of triggers) {
      const result =
        typeof entry === 'string'
          ? content === entry && entry
          : content.match(entry);
      if (result) {
        ctx.match = result;
        return true;
      }
    }
    return false;
  };
}

function commandCheck(commands) {
  const accepts = checkers.filterQuery(':entities:bot_command');
  const names = new Set(list(commands));
  for (const name of names) {
    if (name.startsWith('/')) {
      throw new Error(
        `Do not include '/' when registering command handlers (use '${name.substring(1)}' not '${name}')`
      );
    }
  }
  return (ctx) => {
    if (!accepts(ctx)) {
      return false;
    }
    const msg = ctx.message ?? ctx.channelPost;
    const text = msg.text ?? msg.caption;
    return msg.entities.some((entity) => {
      if (entity.type !== 'bot_command' || entity.offset !== 0) {
        return false;
      }
      const command = text.substring(1, entity.length);
      const at = command.indexOf('@');
      if (
        names.has(command) ||
        (at >= 0 &&
          command.substring(at + 1).toLowerCase() ===
            ctx.me.username.toLowerCase() &&
          names.has(command.substring(0, at)))
      ) {
        ctx.match = text.substring(command.length + 1).trimStart();
        return true;
      }
      return false;
    });
  };
}

const reactionField = { emoji: 'emoji', custom_emoji: 'custom_emoji_id' };
function reactionKey(value) {
  return `${value.type}:${value.type === 'paid' ? '' : value[reactionField[value.type]]}`;
}
function reactionCheck(reactions) {
  const accepts = checkers.filterQuery('message_reaction');
  const wanted = new Set(
    list(reactions).map((value) =>
      reactionKey(
        typeof value === 'string' ? { type: 'emoji', emoji: value } : value
      )
    )
  );
  return (ctx) => {
    if (!accepts(ctx)) {
      return false;
    }
    const value = ctx.messageReaction;
    return value.new_reaction.some((item) => {
      const known =
        Object.hasOwn(reactionField, item.type) || item.type === 'paid';
      const key = reactionKey(item);
      return (
        !known ||
        (!value.old_reaction.some((old) => reactionKey(old) === key) &&
          wanted.has(key))
      );
    });
  };
}

const checkers = {
  filterQuery: matchFilter,
  text: (trigger) =>
    triggerCheck(
      [':text', ':caption'],
      (ctx) => {
        const msg = ctx.message ?? ctx.channelPost;
        return msg.text ?? msg.caption;
      },
      trigger
    ),
  command: commandCheck,
  reaction: reactionCheck,
  chatType(types) {
    const values = new Set(list(types));
    return (ctx) => ctx.chat?.type !== undefined && values.has(ctx.chat.type);
  },
};
for (const signature of [
  'callbackQuery callback_query:data callbackQuery data',
  'gameQuery callback_query:game_short_name callbackQuery game_short_name',
  'inlineQuery inline_query inlineQuery query',
  'chosenInlineResult chosen_inline_result chosenInlineResult result_id',
  'preCheckoutQuery pre_checkout_query preCheckoutQuery invoice_payload',
  'shippingQuery shipping_query shippingQuery invoice_payload',
]) {
  const [name, query, alias, field] = signature.split(' ');
  checkers[name] = (trigger) =>
    triggerCheck(query, (ctx) => ctx[alias][field], trigger);
}

export function installContextCheckers(Type, style = 'grammy') {
  if (style === 'telegraf') {
    contextMethod(Type, 'has', function (filters) {
      return list(filters).some((filter) =>
        typeof filter === 'string' ? filter in this.update : filter(this.update)
      );
    });
    return;
  }
  Type.has = checkers;
  for (const name of Object.keys(checkers)) {
    const method =
      name === 'filterQuery'
        ? 'has'
        : `has${name[0].toUpperCase()}${name.substring(1)}`;
    contextMethod(Type, method, function (argument) {
      return Type.has[name](argument)(this);
    });
  }
}
