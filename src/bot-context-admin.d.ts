import type { Parameters, RequestOptions } from './index.js';
import type {
  GrammyContextOperation,
  TelegrafContextOperation,
} from './bot-context-scope.js';

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
  [K in ChatMethods | GrammyChatMethods]: GrammyContextOperation<K>;
} & {
  [K in ForumMethods]: GrammyContextOperation<K, [unknown, unknown]>;
} & {
  [K in keyof Authors]: GrammyContextOperation<Authors[K], [unknown, unknown]>;
} & {
  unpinChatMessage(
    messageId?: number,
    other?: Parameters,
    request?: RequestOptions | AbortSignal
  ): Promise<true>;
};
export type TelegrafContextAdministration = {
  [K in ChatMethods]: TelegrafContextOperation<K>;
} & {
  [K in ForumMethods]: TelegrafContextOperation<K, [unknown, unknown]>;
} & {
  unpinChatMessage(
    messageId?: number,
    request?: RequestOptions | AbortSignal
  ): Promise<true>;
};
