// Independent argument fixtures for actual public SDK contexts.
const options = Object.freeze({ disable_notification: true });
export const adminCommon = [
  ['banChatMember', [42, { until_date: 100 }]],
  ['unbanChatMember', [42, { only_if_banned: true }]],
  [
    'restrictChatMember',
    [42, { can_send_messages: false }, { until_date: 100 }],
  ],
  ['promoteChatMember', [42, { can_manage_chat: true }]],
  ['setChatAdministratorCustomTitle', [42, 'Moderator']],
  ['banChatSenderChat', [-1009]],
  ['unbanChatSenderChat', [-1009]],
  [
    'setChatPermissions',
    [{ can_send_messages: true }, { use_independent_chat_permissions: true }],
  ],
  ['exportChatInviteLink', []],
  ['createChatInviteLink', [{ name: 'Invite' }]],
  ['editChatInviteLink', ['https://t.me/+fixture', { name: 'Edited' }]],
  ['revokeChatInviteLink', ['https://t.me/+fixture']],
  ['approveChatJoinRequest', [42]],
  ['declineChatJoinRequest', [42]],
  ['setChatPhoto', ['photo:file']],
  ['deleteChatPhoto', []],
  ['setChatTitle', ['Title']],
  ['setChatDescription', ['Description']],
  ['pinChatMessage', [11, options]],
  ['unpinChatMessage', [11]],
  ['unpinAllChatMessages', []],
  ['leaveChat', []],
  ['getChat', []],
  ['getChatAdministrators', []],
  ['getChatMembersCount', []],
  ['getChatMember', [42]],
  ['setChatStickerSet', ['stickers']],
  ['deleteChatStickerSet', []],
  ['createForumTopic', ['Topic', { icon_color: 0 }]],
  ['editForumTopic', [{ name: 'Edited topic' }]],
  ['closeForumTopic', []],
  ['reopenForumTopic', []],
  ['deleteForumTopic', []],
  ['unpinAllForumTopicMessages', []],
  ['editGeneralForumTopic', ['General']],
  ['closeGeneralForumTopic', []],
  ['reopenGeneralForumTopic', []],
  ['hideGeneralForumTopic', []],
  ['unhideGeneralForumTopic', []],
  ['unpinAllGeneralForumTopicMessages', []],
];
export const grammyAdminCases = [
  ...adminCommon,
  ['kickChatMember', [42, { until_date: 100 }]],
  ['kickAuthor', [{ until_date: 100 }]],
  ['banAuthor', [{ until_date: 100 }]],
  ['restrictAuthor', [{ can_send_messages: false }, { until_date: 100 }]],
  ['promoteAuthor', [{ can_manage_chat: true }]],
  ['setChatAdministratorAuthorCustomTitle', ['Moderator']],
  ['setAuthorTag', ['Member']],
  ['getAuthor', []],
  ['setChatMemberTag', [42, 'Member']],
  ['createChatSubscriptionInviteLink', [2592000, 1, { name: 'Subscription' }]],
  [
    'editChatSubscriptionInviteLink',
    ['https://t.me/+fixture', { name: 'Subscription' }],
  ],
  ['getChatGifts', [{ limit: 1 }]],
  ['getChatMemberCount', []],
  ['verifyChat', [{ custom_description: 'Verified' }]],
  ['removeChatVerification', []],
];
export const telegrafAdminCases = adminCommon.map(([name, args]) => {
  if (name === 'banChatMember') {
    args = [42, 100, { revoke_messages: true }];
  } else if (name === 'restrictChatMember') {
    args = [42, { permissions: { can_send_messages: false }, until_date: 100 }];
  }
  return [name, args];
});

export const adminUpdates = {
  message: {
    update_id: 1,
    message: {
      message_id: 11,
      date: 1,
      chat: { id: -1007 },
      from: { id: 8 },
      message_thread_id: 19,
      business_connection_id: 'business:1',
    },
  },
  callback: {
    update_id: 2,
    callback_query: {
      id: 'callback:1',
      from: { id: 9 },
      message: {
        message_id: 12,
        date: 0,
        chat: { id: -1008 },
        message_thread_id: 23,
        business_connection_id: 'business:2',
      },
    },
  },
  reaction: {
    update_id: 3,
    message_reaction: { chat: { id: -1009 }, user: { id: 10 }, message_id: 13 },
  },
  business: {
    update_id: 4,
    business_connection: {
      id: 'business:3',
      user_chat_id: 14,
      user: { id: 14 },
    },
  },
  zeros: {
    update_id: 0,
    message: {
      message_id: 0,
      date: 1,
      chat: { id: 0 },
      from: { id: 0 },
      message_thread_id: 0,
    },
  },
};
