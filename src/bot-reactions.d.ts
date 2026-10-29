import type { BotUpdate } from './index.js';

export interface Reaction {
  type: string;
  emoji?: string;
  custom_emoji_id?: string;
}
export type ReactionArgument = string | Reaction;
type ReactionContext = { update: Pick<BotUpdate, 'message_reaction'> };
export declare class ReactionList implements Iterable<Reaction> {
  protected constructor(list: Reaction[]);
  protected list: Reaction[];
  readonly [index: number]: Reaction;
  static fromArray(list?: Reaction[]): ReactionList;
  static has(reactions: Reaction[], reaction: ReactionArgument): boolean;
  toArray(): Reaction[];
  filter(
    predicate: (value: Reaction, index: number, array: Reaction[]) => unknown
  ): ReactionList;
  has(reaction: ReactionArgument): boolean;
  readonly count: number;
  [Symbol.iterator](): IterableIterator<Reaction>;
}
export declare class MessageReactions extends ReactionList {
  private constructor(ctx: ReactionContext);
  ctx: ReactionContext;
  static from(ctx: ReactionContext): MessageReactions;
  readonly old: ReactionList;
  readonly new: ReactionList;
  readonly added: ReactionList;
  readonly removed: ReactionList;
  readonly kept: ReactionList;
}
