import { TelegramError } from './errors.js';

/** Counts refer to the server collection, even when only a subset is returned. */
export function collectionCount(result, field) {
  const count = 'count' in result ? result.count : (result[field]?.length ?? 0);
  if (!Number.isInteger(count) || count < 0 || count > 0x7fffffff) {
    throw new TelegramError('Invalid account collection count');
  }
  return count;
}

export function accountCollection(values, total) {
  return Object.assign(values, { total });
}
