import { objectRequest, requestOf, gramRequest } from '../../src/requests.js';
import { Anygram, createAdapter } from '../../src/index.js';
import { TlCodec } from '../../src/tl.js';

const codec = new TlCodec();

function entityKey(value) {
  return `${value.className.startsWith('Channel') ? '-100' : value.className.startsWith('Chat') ? '-' : ''}${value.id}`;
}

function entityInput(Vendor, entity) {
  if (entity.className === 'User') {
    return new Vendor.InputPeerUser({
      userId: entity.id,
      accessHash: entity.accessHash,
    });
  }
  return entity.className.startsWith('Channel')
    ? new Vendor.InputPeerChannel({
        channelId: entity.id,
        accessHash: entity.accessHash,
      })
    : new Vendor.InputPeerChat({ chatId: entity.id });
}

export function messagePage() {
  return {
    _: 'messages.messages',
    messages: [
      {
        _: 'message',
        id: 7,
        date: 1,
        message: 'Original',
        peer_id: { _: 'peerUser', user_id: 9n },
        from_id: { _: 'peerUser', user_id: 9n },
        reply_to: { _: 'messageReplyHeader', reply_to_msg_id: 3 },
        media: {
          _: 'messageMediaPhoto',
          photo: {
            _: 'photo',
            id: 11n,
            access_hash: 13n,
            file_reference: Buffer.from([1, 2]),
            date: 1,
            sizes: [],
            dc_id: 2,
          },
        },
      },
    ],
    chats: [],
    topics: [],
    users: [{ _: 'user', id: 9n, access_hash: 17n, first_name: 'Ada' }],
  };
}

export function sdkMessage(Vendor, source = messagePage()) {
  const page = gramRequest(Vendor, requestOf(source));
  const message = page.messages[0];
  const entities = new Map(
    [...page.users, ...page.chats].map((value) => [entityKey(value), value])
  );
  const inputs = new Map(
    [...entities].map(([key, value]) => [key, entityInput(Vendor, value)])
  );
  const id =
    message.peerId.userId ?? message.peerId.chatId ?? message.peerId.channelId;
  const key = `${message.peerId.className === 'PeerChannel' ? '-100' : message.peerId.className === 'PeerChat' ? '-' : ''}${id}`;
  const peer =
    inputs.get(key) ??
    (message.peerId.className === 'PeerChat'
      ? new Vendor.InputPeerChat({ chatId: id })
      : undefined);
  const calls = [];
  const client = {
    _entityCache: { get: (id) => inputs.get(String(id)) },
    getInputEntity: async (value) => value,
    sendMessage: async (...args) => calls.push(['sendMessage', ...args]),
    editMessage: async (...args) => calls.push(['editMessage', ...args]),
    deleteMessages: async (...args) => calls.push(['deleteMessages', ...args]),
    forwardMessages: async (...args) =>
      calls.push(['forwardMessages', ...args]),
    downloadMedia: async (...args) => calls.push(['downloadMedia', ...args]),
    pinMessage: async (...args) => calls.push(['pinMessage', ...args]),
    unpinMessage: async (...args) => calls.push(['unpinMessage', ...args]),
    markAsRead: async (...args) => calls.push(['markAsRead', ...args]),
  };
  message._finishInit(client, entities, peer);
  return { message, calls, peer };
}

export const canonical = (value) =>
  objectRequest({ method: 'value', params: { value } }).value;

export const wireValue = (value) => codec.encode(canonical(value));

export async function ownedMessage(style, source = messagePage(), action) {
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          async call(method, params, options) {
            if (method === 'messages.getHistory') {
              return source;
            }
            calls.push([method, params, options]);
            return action
              ? action(method, params, options)
              : { _: 'updatesTooLong' };
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  const [message] = await client[style].getMessages({
    _: 'inputPeerUser',
    user_id: 9n,
    access_hash: 17n,
  });
  return { message, client, calls };
}
