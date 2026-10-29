const messageTypes = new Set(['message', 'messageService']);

function peerKey(value) {
  const type = value?._?.replace(/^(?:inputPeer|peer)/, '').toLowerCase();
  const id = value?.[`${type}Id`];
  return id === undefined ? undefined : `${type}:${id}`;
}

function shortMessage(context, result, { peer, text, replyTo, entities }) {
  const type = peer?._?.replace('inputPeer', '');
  if (!['User', 'Chat', 'Channel'].includes(type)) {
    return undefined;
  }
  return context.wrap(
    {
      _: 'message',
      id: result.id,
      date: result.date,
      out: result.out,
      peerId: {
        _: `peer${type}`,
        [`${type.toLowerCase()}Id`]: peer[`${type.toLowerCase()}Id`],
      },
      message: typeof text === 'string' ? text : (text?.text ?? ''),
      replyTo:
        replyTo === undefined
          ? undefined
          : { _: 'messageReplyHeader', replyToMsgId: replyTo },
      media: result.media,
      entities:
        result.entities ?? mtprotoEntities(entities ?? text?.entities ?? []),
    },
    peer
  );
}

function updatedMessages(result, { peer, id, randomId }) {
  const updates =
    result?._ === 'updateShort' ? [result.update] : (result?.updates ?? []);
  const mapped = updates.find(
    (update) => update._ === 'updateMessageID' && update.randomId === randomId
  )?.id;
  if (randomId !== undefined && mapped === undefined) {
    return [];
  }
  const expected = peerKey(peer);
  return updates
    .filter((update) =>
      [
        'updateNewMessage',
        'updateNewChannelMessage',
        'updateEditMessage',
        'updateEditChannelMessage',
        'updateNewScheduledMessage',
      ].includes(update?._)
    )
    .map((update) => update.message)
    .filter(
      (message) =>
        messageTypes.has(message?._) &&
        (expected === undefined || peerKey(message.peerId) === expected) &&
        ((mapped ?? id) === undefined || message.id === (mapped ?? id))
    );
}

export function responseMessage(context, raw, options = {}) {
  const result = context.wrap(raw, options.peer);
  if (messageTypes.has(result?._)) {
    return options.all ? [result] : result;
  }
  if (result?._ === 'updateShortSentMessage') {
    const message = shortMessage(context, result, options);
    return options.all ? (message ? [message] : []) : message;
  }
  const messages = updatedMessages(result, options);
  return options.all
    ? messages
    : messages.length === 1
      ? messages[0]
      : undefined;
}
import { mtprotoEntities } from './formatting.js';
