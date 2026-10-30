/** IDs in entity markup must remain exact before schema conversion. */
export function markupIdentifier(value) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) {
    throw new RangeError('Markup identifiers require exact integers');
  }
  if (!/^\d+$/.test(value ?? '')) {
    throw new TypeError('Markup identifier must be decimal');
  }
  const number = BigInt(value);
  if (number <= 0n || number > (1n << 63n) - 1n) {
    throw new RangeError('Markup identifier exceeds signed 64-bit bounds');
  }
  return number;
}

const dateFields = {
  r: 'relative',
  w: 'day_of_week',
  d: 'short_date',
  D: 'long_date',
  t: 'short_time',
  T: 'long_time',
};

export function markupDate(timestamp, format = '') {
  if (!/^\d+$/.test(timestamp ?? '') || Number(timestamp) > 2147483647) {
    throw new RangeError('Markup date requires timestamp seconds');
  }
  if (!/^(?:r|w?[dD]?[tT]?)$/.test(format)) {
    throw new TypeError('Invalid markup date format');
  }
  return {
    _: 'messageEntityFormattedDate',
    date: Number(timestamp),
    ...Object.fromEntries([...format].map((char) => [dateFields[char], true])),
  };
}

export function markupDateUrl(entity) {
  const format = Object.entries(dateFields)
    .filter(([, field]) => entity[field])
    .map(([char]) => char)
    .join('');
  markupDate(entity.date, format);
  return `tg://time?unix=${entity.date}${format ? `&format=${format}` : ''}`;
}

export function markupLink(url, body, image = false) {
  const user = /^tg:\/\/user\?id=(.*)$/.exec(url);
  if (user) {
    return {
      _: 'messageEntityMentionName',
      user_id: markupIdentifier(user[1]),
    };
  }
  if (image && url.startsWith('tg://emoji?id=')) {
    return {
      _: 'messageEntityCustomEmoji',
      document_id: markupIdentifier(url.slice(14)),
    };
  }
  if (image && url.startsWith('tg://time?')) {
    const fields = new globalThis.URL(url).searchParams;
    const keys = [...fields.keys()];
    if (
      keys.some((key) => !['unix', 'format'].includes(key)) ||
      new Set(keys).size !== keys.length
    ) {
      throw new TypeError('Invalid markup date fields');
    }
    return markupDate(fields.get('unix'), fields.get('format') ?? '');
  }
  if (url === body || url === `mailto:${body}`) {
    return { _: url === body ? 'messageEntityUrl' : 'messageEntityEmail' };
  }
  return { _: 'messageEntityTextUrl', url };
}
