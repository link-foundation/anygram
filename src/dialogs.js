import { TelegramError } from './errors.js';

function peerKey(peer) {
  const type = peer?._?.replace(/^peer|Forbidden$/g, '').toLowerCase();
  return ['user', 'chat', 'channel'].includes(type)
    ? `${type}:${peer[`${type}_id`] ?? peer.id}`
    : undefined;
}

const boundedInteger = (value, min, max) =>
  Number.isInteger(value) && value >= min && value <= max;

function validateDialogLimits(limit, pageSize, maxPages) {
  if (
    !(limit === Infinity || (Number.isSafeInteger(limit) && limit >= 0)) ||
    !boundedInteger(pageSize, 1, 100) ||
    !boundedInteger(maxPages, 1, 10000)
  ) {
    throw new RangeError('Invalid dialog pagination limits');
  }
}

function validateDialogCursor(offsetDate, offsetId, folderId, excludePinned) {
  if (
    ![offsetDate, offsetId].every((value) =>
      boundedInteger(value, 0, 2147483647)
    ) ||
    (folderId !== undefined && ![0, 1].includes(folderId)) ||
    typeof excludePinned !== 'boolean'
  ) {
    throw new RangeError('Invalid dialog pagination cursor');
  }
}

function dialogOptions({
  limit = Infinity,
  pageSize = 100,
  maxPages = 1000,
  offsetDate = 0,
  offsetId = 0,
  offsetPeer = { _: 'inputPeerEmpty' },
  excludePinned = false,
  folderId,
  ...options
}) {
  validateDialogLimits(limit, pageSize, maxPages);
  validateDialogCursor(offsetDate, offsetId, folderId, excludePinned);
  return {
    limit,
    pageSize,
    maxPages,
    options,
    cursor: {
      offset_date: offsetDate,
      offset_id: offsetId,
      offset_peer: offsetPeer,
      exclude_pinned: excludePinned,
      ...(folderId === undefined ? {} : { folder_id: folderId }),
    },
  };
}

function nextOffset(result, entries, requested) {
  const last = entries.at(-1);
  if (
    !last ||
    result._ !== 'messages.dialogsSlice' ||
    result.dialogs.length < requested
  ) {
    return undefined;
  }
  return {
    exclude_pinned: true,
    offset_id: last.dialog.top_message,
    offset_date: last.message?.date ?? 0,
    offset_peer: last.inputPeer,
  };
}

function dialogEntries(result, operations) {
  if (result?._ === 'messages.dialogsNotModified') {
    return [];
  }
  if (
    !['messages.dialogs', 'messages.dialogsSlice'].includes(result?._) ||
    !['dialogs', 'messages', 'chats', 'users'].every(
      (field) => Array.isArray(result[field]) && result[field].length <= 1000
    )
  ) {
    throw new TelegramError('Invalid dialog response');
  }
  const entities = new Map(
    [...result.users, ...result.chats].map((entry) => [peerKey(entry), entry])
  );
  const messages = new Map(
    result.messages.map((entry) => [
      `${peerKey(entry.peer_id)}:${entry.id}`,
      entry,
    ])
  );
  const entries = [];
  for (const dialog of result.dialogs) {
    if (dialog._ !== 'dialog') {
      continue;
    }
    const key = peerKey(dialog.peer);
    const entity = entities.get(key);
    if (!key || !entity) {
      continue;
    }
    entries.push({
      dialog,
      entity,
      inputPeer: operations.inputPeer(entity),
      message: messages.get(`${key}:${dialog.top_message}`),
    });
  }
  return entries;
}

async function dialogPage(operations, cursor, requested, options, onPage) {
  options.signal?.throwIfAborted();
  const result = await operations.rpc(
    'messages.getDialogs',
    { ...cursor, limit: requested, hash: 0n },
    options
  );
  options.signal?.throwIfAborted();
  const entries = dialogEntries(result, operations);
  onPage?.(result);
  return { result, entries };
}

/** Shared raw-TL pagination. The page budget also bounds retained peer keys. */
export async function* iterateDialogs(operations, input = {}, onPage) {
  const { limit, pageSize, maxPages, options, cursor } = dialogOptions(input);
  const seen = new Set();
  let remaining = limit;
  let lastCursor;
  const countOnly = limit === 0 && Boolean(onPage);
  for (let page = 0; remaining > 0 || (page === 0 && countOnly); page++) {
    if (page === maxPages) {
      throw new TelegramError('Dialog pagination request limit reached', {
        type: 'DIALOG_PAGE_LIMIT',
      });
    }
    const requested = countOnly ? 1 : Math.min(pageSize, remaining);
    const { result, entries } = await dialogPage(
      operations,
      cursor,
      requested,
      options,
      onPage
    );
    if (countOnly) {
      return;
    }
    for (const entry of entries) {
      options.signal?.throwIfAborted();
      const key = peerKey(entry.dialog.peer);
      if (!seen.has(key)) {
        seen.add(key);
        yield globalThis.structuredClone(entry);
        if (--remaining === 0) {
          return;
        }
      }
    }
    const next = nextOffset(result, entries, requested);
    if (!next) {
      return;
    }
    const nextCursor = JSON.stringify(next, (_, value) =>
      typeof value === 'bigint' ? String(value) : value
    );
    if (nextCursor === lastCursor) {
      return;
    }
    lastCursor = nextCursor;
    Object.assign(cursor, next);
  }
}
