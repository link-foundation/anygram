import { contextMethod } from './bot-context-scope.js';

function content(ctx) {
  const msg = ctx.msg;
  if (!msg) {
    return [ctx.poll?.explanation, ctx.poll?.explanation_entities];
  }
  for (const [text, entities] of [
    ['text', 'entities'],
    ['caption', 'caption_entities'],
  ]) {
    if (text in msg) {
      return [msg[text], msg[entities]];
    }
  }
  return 'game' in msg ? [msg.game.text, msg.game.text_entities] : [];
}

function entities(ctx, style, types) {
  if (style === 'telegraf') {
    const [text = '', items = []] = content(ctx);
    return items
      .filter((item) => types.length === 0 || types.includes(item.type))
      .map((item) => ({
        ...item,
        fragment: text.slice(item.offset, item.offset + item.length),
      }));
  }
  const msg = ctx.msg;
  const text = msg?.text ?? msg?.caption;
  const items = msg?.entities ?? msg?.caption_entities;
  if (text === undefined || items === undefined) {
    return [];
  }
  const wanted =
    types[0] === undefined
      ? undefined
      : new Set(Array.isArray(types[0]) ? types[0] : [types[0]]);
  return items
    .filter((item) => !wanted || wanted.has(item.type))
    .map((item) => ({
      ...item,
      text: text.substring(item.offset, item.offset + item.length),
    }));
}

function summarize(ctx) {
  const old = ctx.messageReaction?.old_reaction ?? [];
  const current = ctx.messageReaction?.new_reaction ?? [];
  const result = {};
  for (const [type, key, field] of [
    ['emoji', 'emoji', 'emoji'],
    ['custom_emoji', 'customEmoji', 'custom_emoji_id'],
  ]) {
    const before = old
      .filter((item) => item.type === type)
      .map((item) => item[field]);
    const after = current
      .filter((item) => item.type === type)
      .map((item) => item[field]);
    const added = [...after],
      kept = [],
      removed = [];
    for (const item of before) {
      const index = added.indexOf(item);
      if (index < 0) {
        removed.push(item);
      } else {
        added.splice(index, 1);
        kept.push(item);
      }
    }
    Object.assign(result, {
      [key]: after,
      [`${key}Added`]: added,
      [`${key}Kept`]: kept,
      [`${key}Removed`]: removed,
    });
  }
  result.paid = current.some((item) => item.type === 'paid');
  result.paidAdded = result.paid && !old.some((item) => item.type === 'paid');
  return result;
}

export function installContextContent(Type, style = 'grammy') {
  contextMethod(Type, 'entities', function (...types) {
    return entities(this, style, types);
  });
  if (style === 'telegraf') {
    Object.defineProperty(Type.prototype, 'text', {
      configurable: true,
      get() {
        return content(this)[0];
      },
    });
  } else {
    contextMethod(Type, 'reactions', function () {
      return summarize(this);
    });
  }
}
