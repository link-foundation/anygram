import type { Parameters, RequestOptions } from './index.js';
import type { GrammyPositionalArguments } from './bot-positional.js';
import type { TelegrafPositionalArguments } from './telegraf-positional.js';

type ChatMethods =
  | 'banChatMember'
  | 'unbanChatMember'
  | 'restrictChatMember'
  | 'promoteChatMember'
  | 'setChatAdministratorCustomTitle'
  | 'banChatSenderChat'
  | 'unbanChatSenderChat'
  | 'setChatPermissions'
  | 'exportChatInviteLink'
  | 'createChatInviteLink'
  | 'editChatInviteLink'
  | 'revokeChatInviteLink'
  | 'approveChatJoinRequest'
  | 'declineChatJoinRequest'
  | 'setChatPhoto'
  | 'deleteChatPhoto'
  | 'setChatTitle'
  | 'setChatDescription'
  | 'pinChatMessage'
  | 'unpinAllChatMessages'
  | 'leaveChat'
  | 'getChat'
  | 'getChatAdministrators'
  | 'getChatMembersCount'
  | 'getChatMember'
  | 'setChatStickerSet'
  | 'deleteChatStickerSet'
  | 'createForumTopic'
  | 'editGeneralForumTopic'
  | 'closeGeneralForumTopic'
  | 'reopenGeneralForumTopic'
  | 'hideGeneralForumTopic'
  | 'unhideGeneralForumTopic'
  | 'unpinAllGeneralForumTopicMessages';
type ForumMethods =
  | 'editForumTopic'
  | 'closeForumTopic'
  | 'reopenForumTopic'
  | 'deleteForumTopic'
  | 'unpinAllForumTopicMessages';
type GrammyChatMethods =
  | 'kickChatMember'
  | 'setChatMemberTag'
  | 'createChatSubscriptionInviteLink'
  | 'editChatSubscriptionInviteLink'
  | 'getChatGifts'
  | 'getChatMemberCount'
  | 'verifyChat'
  | 'removeChatVerification';
type WithoutChat<A extends unknown[]> = A extends [unknown, ...infer Rest]
  ? Rest
  : never;
type Scoped<A extends unknown[]> = (
  ...args: WithoutChat<A>
) => Promise<unknown>;
interface Authors {
  banAuthor: 'banChatMember';
  kickAuthor: 'banChatMember';
  restrictAuthor: 'restrictChatMember';
  promoteAuthor: 'promoteChatMember';
  setChatAdministratorAuthorCustomTitle: 'setChatAdministratorCustomTitle';
  setAuthorTag: 'setChatMemberTag';
  getAuthor: 'getChatMember';
}
export type GrammyContextAdministration = {
  [K in ChatMethods | GrammyChatMethods]: Scoped<GrammyPositionalArguments<K>>;
} & {
  [K in ForumMethods]: Scoped<WithoutChat<GrammyPositionalArguments<K>>>;
} & {
  [K in keyof Authors]: Scoped<
    WithoutChat<GrammyPositionalArguments<Authors[K]>>
  >;
} & {
  unpinChatMessage(
    messageId?: number,
    other?: Parameters,
    request?: RequestOptions | AbortSignal
  ): Promise<unknown>;
};
export type TelegrafContextAdministration = {
  [K in ChatMethods]: Scoped<TelegrafPositionalArguments<K>>;
} & {
  [K in ForumMethods]: Scoped<WithoutChat<TelegrafPositionalArguments<K>>>;
} & {
  unpinChatMessage(
    messageId?: number,
    request?: RequestOptions | AbortSignal
  ): Promise<unknown>;
};
