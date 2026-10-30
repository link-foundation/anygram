import { schemaDefinition } from './requests.js';

// Telegram's min constructors have field-specific cache update rules.
const userProtected = new Set([
  'contact',
  'mutual_contact',
  'attach_menu_enabled',
  'bot_can_edit',
  'close_friend',
  'stories_hidden',
  'stories_max_id',
]);
const userIdentity = new Set([
  'first_name',
  'last_name',
  'username',
  'phone',
  'usernames',
]);
const channelMutable = new Set([
  'title',
  'megagroup',
  'color',
  'photo',
  'username',
  'usernames',
  'has_geo',
  'noforwards',
  'emoji_status',
  'has_link',
  'slowmode_enabled',
  'scam',
  'fake',
  'gigagroup',
  'forum',
  'level',
  'restricted',
  'restriction_reason',
  'join_to_send',
  'join_request',
  'verified',
  'default_banned_rights',
  'signature_profiles',
  'autotranslation',
  'broadcast_messages_allowed',
  'monoforum',
  'forum_tabs',
  'linked_monoforum_id',
  'send_paid_messages_stars',
  'bot_verification_icon',
]);

export function hasMinAccessHash(entity) {
  return entity?._ === 'user'
    ? (entity.min_access_hash ?? Boolean(entity.min && entity.phone !== ''))
    : Boolean(entity?.min);
}

function userFieldChanges(field, cached, incoming) {
  if (userProtected.has(field)) {
    return false;
  }
  if (userIdentity.has(field)) {
    return !cached || Boolean(cached.min);
  }
  if (field === 'photo') {
    return !cached || cached.min || incoming.apply_min_photo;
  }
  if (field === 'status') {
    return !cached || cached.min || cached.status?._ === 'userStatusEmpty';
  }
  return field !== 'access_hash' && field !== 'min';
}

function updateHash(merged, cached, incoming) {
  if (
    incoming.access_hash !== undefined &&
    (!hasMinAccessHash(incoming) ||
      !cached ||
      cached.access_hash === undefined ||
      hasMinAccessHash(cached))
  ) {
    merged.access_hash = incoming.access_hash;
    if (incoming._ === 'user') {
      merged.min_access_hash = hasMinAccessHash(incoming);
    }
  }
}

export function mergePeer(cached, incoming) {
  if (!incoming.min) {
    return { ...incoming };
  }
  const merged = { ...cached, _: incoming._, id: incoming.id };
  for (const { name } of schemaDefinition(incoming._)?.params ?? []) {
    const changes =
      incoming._ === 'user'
        ? userFieldChanges(name, cached, incoming)
        : channelMutable.has(name);
    if (changes) {
      delete merged[name];
      if (incoming[name] !== undefined) {
        merged[name] = incoming[name];
      }
    }
  }
  if (!cached || cached.min) {
    merged.min = true;
  }
  updateHash(merged, cached, incoming);
  return merged;
}

export function rememberPeer(peers, entity, maxPeers) {
  const type = entity?._?.replace(/Forbidden$/, '');
  if (!['user', 'chat', 'channel'].includes(type)) {
    return;
  }
  const key = `${type}:${entity.id}`;
  const cached = peers.get(key);
  const merged = mergePeer(cached, entity);
  if (cached?.username) {
    const alias = `@${cached.username.toLowerCase()}`;
    if (peers.get(alias) === cached) {
      peers.delete(alias);
    }
  }
  peers.set(key, merged);
  if (merged.username) {
    peers.set(`@${merged.username.toLowerCase()}`, merged);
  }
  while (peers.size > maxPeers) {
    peers.delete(peers.keys().next().value);
  }
}

export function messagePeers(message) {
  return [
    message.from_id,
    message.fwd_from?.from_id,
    message.fwd_from?.saved_from_peer,
    message.fwd_from?.saved_from_id,
    ...(message.entities ?? [])
      .filter((entity) => entity._ === 'messageEntityMentionName')
      .map((entity) => ({ _: 'peerUser', user_id: entity.user_id })),
  ];
}

export function resultMessages(result) {
  const messages = Array.isArray(result)
    ? result
    : [
        ...(result.messages ?? []),
        result.message,
        result.update?.message,
        ...(result.updates ?? []).map((update) => update.message),
      ];
  return messages.filter((message) =>
    ['message', 'messageService'].includes(message?._)
  );
}

export function peerFamily(input) {
  return input?._?.replace(/^inputPeer/, '')
    .replace(/FromMessage$/, '')
    .toLowerCase();
}

export function inputEntity(input) {
  return { ...input, _: input._.replace('inputPeer', 'input') };
}
