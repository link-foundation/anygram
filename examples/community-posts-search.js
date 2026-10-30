import { messageId } from './community-posts-state.js';

function searchPage(messages) {
  if (!Array.isArray(messages) || messages.length > 100) {
    throw new RangeError('Invalid community search page');
  }
  return messages
    .map((message) => ({
      id: message.id ?? message.message_id,
      text: message.message ?? message.text,
      date: message.date,
    }))
    .filter((message) => messageId(message.id));
}

/** Finite account search; the Bot API has no public channel search method. */
export async function findCommunityPost(
  account,
  channel,
  username,
  options = {}
) {
  const { maxPages = 10, matches = () => true, ...request } = options;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 100) {
    throw new RangeError('Invalid community search page limit');
  }
  let offset = 0;
  const suffix = `\n\n@${username}`;
  for (let page = 0; page < maxPages; page++) {
    request.signal?.throwIfAborted();
    const messages = await account.searchMessages(channel, `@${username}`, {
      ...request,
      limit: 100,
      offset_id: offset,
    });
    const valid = searchPage(messages);
    const matching = valid
      .filter(
        (message) =>
          typeof message.text === 'string' &&
          message.text.endsWith(suffix) &&
          matches(message)
      )
      .sort((a, b) => b.id - a.id);
    if (matching.length) {
      return matching[0];
    }
    const next = Math.min(...valid.map((message) => message.id));
    if (
      messages.length < 100 ||
      !Number.isFinite(next) ||
      next >= (offset || Infinity)
    ) {
      return;
    }
    offset = next;
  }
  throw new RangeError('Community search page limit exceeded');
}
