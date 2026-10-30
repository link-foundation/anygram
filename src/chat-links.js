const hosts = new Set(['t.me', 'telegram.me', 'telegram.dog']);
const reserved = new Set(
  'addemoji addlist addstickers addstyle addtheme auction auth boost call confirmphone contact giftcode invoice joinchat login m nft proxy setlanguage share socks web a k z www c s msg iv apps'.split(
    ' '
  )
);
const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
const hashPattern = /^[a-zA-Z0-9_-]+$/;
const invalid = () =>
  new TypeError('Unsupported or invalid Telegram chat link');

function positiveId(value, max = 2147483647n) {
  if (!/^[1-9]\d{0,18}$/.test(value ?? '') || BigInt(value) > max) {
    throw invalid();
  }
  return BigInt(value);
}

function messageIds(parts, query) {
  if (parts.length > 2) {
    throw invalid();
  }
  const messageId = parts.length ? Number(positiveId(parts.at(-1))) : undefined;
  const thread = parts.length === 2 ? parts[0] : query.get('thread');
  if (
    (thread !== null && thread !== undefined && messageId === undefined) ||
    (parts.length === 2 &&
      query.has('thread') &&
      query.get('thread') !== thread)
  ) {
    throw invalid();
  }
  return {
    ...(messageId === undefined ? {} : { messageId }),
    ...(thread === null || thread === undefined
      ? {}
      : { threadId: Number(positiveId(thread)) }),
  };
}

function publicLink(username, parts, query) {
  if (!usernamePattern.test(username ?? '') || query.has('direct')) {
    throw invalid();
  }
  return {
    type: 'public',
    username: username.toLowerCase(),
    ...messageIds(parts, query),
  };
}

function privateLink(channel, parts, query) {
  const ids = messageIds(parts, query);
  if (ids.messageId === undefined) {
    throw invalid();
  }
  return {
    type: 'privateMessage',
    channelId: positiveId(channel, 9223372036854775807n),
    ...ids,
  };
}

function inviteLink(hash) {
  if (!hashPattern.test(hash ?? '')) {
    throw invalid();
  }
  return { type: 'invite', hash };
}

function phoneLink(number) {
  const phone = number?.replace(/^\+/, '');
  if (!/^[1-9]\d{0,14}$/.test(phone ?? '')) {
    throw invalid();
  }
  return { type: 'phone', phone };
}

function validateUrl(url) {
  if (url.username || url.password || url.port) {
    throw invalid();
  }
  for (const key of [
    'domain',
    'phone',
    'invite',
    'channel',
    'post',
    'thread',
  ]) {
    if (url.searchParams.getAll(key).length > 1) {
      throw invalid();
    }
  }
}

function deepLink(url) {
  const query = url.searchParams;
  if (!['', '/'].includes(url.pathname)) {
    throw invalid();
  }
  const parts = query.has('post') ? [query.get('post')] : [];
  const command = url.hostname.toLowerCase();
  validateDeepQuery(command, query);
  switch (command) {
    case 'join':
      return inviteLink(query.get('invite'));
    case 'privatepost':
      return privateLink(query.get('channel'), parts, query);
    case 'resolve':
      if (query.has('phone') === query.has('domain')) {
        throw invalid();
      }
      return query.has('phone')
        ? phoneLink(query.get('phone'))
        : publicLink(query.get('domain'), parts, query);
    default:
      throw invalid();
  }
}

function validateDeepQuery(command, query) {
  const allowed = {
    join: ['invite'],
    resolve: ['domain', 'phone', 'post', 'thread'],
    privatepost: ['channel', 'post', 'thread'],
  }[command];
  if (!allowed) {
    throw invalid();
  }
  for (const key of [
    'invite',
    'domain',
    'phone',
    'channel',
    'post',
    'thread',
  ]) {
    if (query.has(key) && !allowed.includes(key)) {
      throw invalid();
    }
  }
}

function httpPath(url, domains) {
  const parts = url.pathname.slice(1).split('/').map(decodeURIComponent);
  if (parts.at(-1) === '') {
    parts.pop();
  }
  if (hosts.has(url.hostname) || domains.includes(url.hostname)) {
    return parts;
  }
  const username = url.hostname.endsWith('.t.me')
    ? url.hostname.slice(0, -5)
    : '';
  if (username.length < 2 || reserved.has(username)) {
    throw invalid();
  }
  return [username, ...parts];
}

function httpLink(url, domains) {
  const parts = httpPath(url, domains);
  const first = parts.shift();
  if (first === 'joinchat' && parts.length === 1) {
    return inviteLink(parts[0]);
  }
  if (first?.startsWith('+') && parts.length === 0) {
    const value = first.slice(1);
    return /^\d+$/.test(value) ? phoneLink(value) : inviteLink(value);
  }
  if (first === 'c') {
    return privateLink(parts.shift(), parts, url.searchParams);
  }
  if (reserved.has(first?.toLowerCase())) {
    throw invalid();
  }
  return publicLink(first, parts, url.searchParams);
}

function linkUrl(text) {
  const source = /^tg:/i.test(text)
    ? text.replace(/^tg:(?:\/\/)?/i, 'tg://')
    : /^[a-z]+:/i.test(text)
      ? text
      : `https://${text}`;
  try {
    return new globalThis.URL(source);
  } catch {
    throw invalid();
  }
}

function linkText(input, domains) {
  const text = typeof input === 'string' ? input.split('#', 1)[0] : '';
  if (
    typeof input !== 'string' ||
    input.length > 4096 ||
    /[\s\\]/.test(text) ||
    !Array.isArray(domains) ||
    domains.length > 16 ||
    domains.some(
      (host) => typeof host !== 'string' || !/^[a-z0-9.-]{1,253}$/.test(host)
    )
  ) {
    throw invalid();
  }
  return text;
}

/** Chat destinations only: parsing never imports an invite or grants access. */
export function parseTelegramLink(input, { domains = [] } = {}) {
  const text = linkText(input, domains);
  if (usernamePattern.test(text.replace(/^@/, ''))) {
    return publicLink(
      text.replace(/^@/, ''),
      [],
      new globalThis.URLSearchParams()
    );
  }
  if (text.startsWith('+')) {
    const value = text.slice(1);
    return /^\d+$/.test(value) ? phoneLink(value) : inviteLink(value);
  }
  const url = linkUrl(text);
  validateUrl(url);
  if (url.protocol === 'tg:') {
    return deepLink(url);
  }
  if (!['https:', 'http:'].includes(url.protocol)) {
    throw invalid();
  }
  try {
    return httpLink(url, domains);
  } catch {
    throw invalid();
  }
}
