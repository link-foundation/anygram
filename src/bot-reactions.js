function indexed(value) {
  return new Proxy(value, {
    get(target, key, receiver) {
      if (typeof key === 'string' && !Number.isNaN(Number(key))) {
        return target.list[Number(key)];
      }
      return Reflect.get(target, key, receiver);
    },
  });
}

/** Telegraf-compatible views retain the update's reaction object identities. */
export class ReactionList {
  constructor(list) {
    this.list = list;
  }
  static fromArray(list = []) {
    return indexed(new ReactionList(list));
  }
  static has(reactions, reaction) {
    if (typeof reaction === 'string') {
      const field = /^[0-9]/.test(reaction) ? 'custom_emoji_id' : 'emoji';
      return reactions.some((item) => item[field] === reaction);
    }
    return reactions.some((item) => {
      const field = { emoji: 'emoji', custom_emoji: 'custom_emoji_id' }[
        item.type
      ];
      return field !== undefined && item[field] === reaction[field];
    });
  }
  toArray() {
    return [...this.list];
  }
  filter(predicate) {
    return ReactionList.fromArray(this.list.filter(predicate));
  }
  has(reaction) {
    return ReactionList.has(this.list, reaction);
  }
  get count() {
    return this.list.length;
  }
  [Symbol.iterator]() {
    return this.list[Symbol.iterator]();
  }
  [Symbol.for('nodejs.util.inspect.custom')]() {
    const values = this.list.map((item) =>
      item.type === 'custom_emoji'
        ? `Custom(${item.custom_emoji_id})`
        : item.emoji
    );
    return `ReactionList { ${values.join(', ')} }`;
  }
}

export class MessageReactions extends ReactionList {
  constructor(ctx) {
    super(ctx.update.message_reaction?.new_reaction ?? []);
    this.ctx = ctx;
  }
  static from(ctx) {
    return indexed(new MessageReactions(ctx));
  }
  get old() {
    return ReactionList.fromArray(
      this.ctx.update.message_reaction?.old_reaction
    );
  }
  get new() {
    return ReactionList.fromArray(
      this.ctx.update.message_reaction?.new_reaction
    );
  }
  get added() {
    return this.new.filter((item) => !this.old.has(item));
  }
  get removed() {
    return this.old.filter((item) => !this.new.has(item));
  }
  get kept() {
    return this.new.filter((item) => this.old.has(item));
  }
}
