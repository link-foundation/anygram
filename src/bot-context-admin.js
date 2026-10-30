import {
  contextRequired as required,
  contextMethod,
  contextAlias,
  contextOptions,
  contextApiCall,
} from './bot-context-scope.js';

const chatMethods = [
  'banChatMember',
  'unbanChatMember',
  'restrictChatMember',
  'promoteChatMember',
  'setChatAdministratorCustomTitle',
  'banChatSenderChat',
  'unbanChatSenderChat',
  'setChatPermissions',
  'exportChatInviteLink',
  'createChatInviteLink',
  'editChatInviteLink',
  'revokeChatInviteLink',
  'approveChatJoinRequest',
  'declineChatJoinRequest',
  'setChatPhoto',
  'deleteChatPhoto',
  'setChatTitle',
  'setChatDescription',
  'pinChatMessage',
  'unpinChatMessage',
  'unpinAllChatMessages',
  'leaveChat',
  'getChat',
  'getChatAdministrators',
  'getChatMembersCount',
  'getChatMember',
  'setChatStickerSet',
  'deleteChatStickerSet',
  'createForumTopic',
  'editGeneralForumTopic',
  'closeGeneralForumTopic',
  'reopenGeneralForumTopic',
  'hideGeneralForumTopic',
  'unhideGeneralForumTopic',
  'unpinAllGeneralForumTopicMessages',
];
const grammyChatMethods = [
  'setChatMemberTag',
  'createChatSubscriptionInviteLink',
  'editChatSubscriptionInviteLink',
  'getChatGifts',
  'getChatMemberCount',
  'verifyChat',
  'removeChatVerification',
];
const authorMethods = [
  ['banAuthor', 'banChatMember'],
  ['restrictAuthor', 'restrictChatMember'],
  ['promoteAuthor', 'promoteChatMember'],
  ['setChatAdministratorAuthorCustomTitle', 'setChatAdministratorCustomTitle'],
  ['setAuthorTag', 'setChatMemberTag'],
  ['getAuthor', 'getChatMember'],
];
const forumMethods = [
  'editForumTopic',
  'closeForumTopic',
  'reopenForumTopic',
  'deleteForumTopic',
  'unpinAllForumTopicMessages',
];

function grammyChat(ctx, name) {
  const label = name === 'revokeChatInviteLink' ? 'editChatInviteLink' : name;
  return required(ctx.chatId, label);
}

function installChat(Type, style) {
  const names =
    style === 'grammy' ? [...chatMethods, ...grammyChatMethods] : chatMethods;
  for (const name of names) {
    contextMethod(Type, name, function (...args) {
      if (style === 'telegraf') {
        this.assert(this.chat, name);
        return this.telegram[name](this.chat.id, ...args);
      }
      const chat = grammyChat(this, name);
      if (name === 'pinChatMessage' || name === 'unpinChatMessage') {
        return this.api[name](
          chat,
          args[0],
          contextOptions(this, 'b', args[1]),
          args[2]
        );
      }
      return contextApiCall(this, name, [chat], args);
    });
  }
}

function installAuthors(Type) {
  for (const [name, method] of authorMethods) {
    contextMethod(Type, name, function (...args) {
      const label = name === 'setAuthorTag' ? method : name;
      const prefix = [
        required(this.chatId, label),
        required(this.from, label).id,
      ];
      return contextApiCall(this, method, prefix, args);
    });
  }
  contextAlias(Type, 'kickAuthor', 'banAuthor');
  contextAlias(Type, 'kickChatMember', 'banChatMember');
  contextAlias(Type, 'getChatMembersCount', 'getChatMemberCount');
}

function installForums(Type, style) {
  for (const name of forumMethods) {
    contextMethod(Type, name, function (...args) {
      if (style === 'telegraf') {
        this.assert(this.chat, name);
        this.assert(this.message?.message_thread_id, name);
        return this.telegram[name](
          this.chat.id,
          this.message.message_thread_id,
          ...args
        );
      }
      const msg = required(this.msg, name);
      const thread = required(msg.message_thread_id, name);
      return contextApiCall(this, name, [msg.chat.id, thread], args);
    });
  }
}

/** Chat/author/forum bindings leave all payload translation to positional APIs. */
export function installContextAdministration(Type, style = 'grammy') {
  installChat(Type, style);
  installForums(Type, style);
  if (style === 'grammy') {
    installAuthors(Type);
  }
}
