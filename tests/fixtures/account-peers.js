import { messagePage } from './account-message-models.js';

export function peerPage(type = 'User') {
  const page = messagePage();
  const family = type.toLowerCase();
  const peer = { _: `peer${type}`, [`${family}_id`]: 21n };
  page.messages[0].from_id = peer;
  page.messages[0].fwd_from = { _: 'messageFwdHeader', from_id: peer, date: 1 };
  page[type === 'User' ? 'users' : 'chats'].push(peerEntity(type, true));
  return page;
}

export const peerEntity = (type, min = false) => ({
  _: type.toLowerCase(),
  id: 21n,
  access_hash: min ? 999n : 23n,
  min,
  ...(type === 'User'
    ? { first_name: min ? 'Minimal' : 'Complete' }
    : {
        title: min ? 'Minimal' : 'Complete',
        photo: { _: 'chatPhotoEmpty' },
        date: 1,
      }),
});

export const peerReply = (type) =>
  type === 'User'
    ? [peerEntity(type)]
    : { _: 'messages.chats', chats: [peerEntity(type)] };
