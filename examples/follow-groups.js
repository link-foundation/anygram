import { parseTelegramLink, TelegramError } from '../src/index.js';

const groupKey = (entity) =>
  `${entity._.replace(/Forbidden$/, '')}:${entity.id}`;
const isGroup = (entity) =>
  ['channel', 'chat'].includes(entity?._?.replace(/Forbidden$/, ''));
const notificationMuted = (settings, now) =>
  settings.mute_until === -1 || settings.mute_until > now;

/** Full dialog scan; iterator request limits fail explicitly instead of truncating membership. */
export async function listGroups(client, options) {
  const groups = [];
  for await (const entry of client.iterDialogs(options)) {
    if (isGroup(entry.entity)) {
      groups.push(entry);
    }
  }
  return groups;
}

function addGroup(index, entry, username) {
  index.set(groupKey(entry.entity), entry);
  for (const name of [
    username,
    entry.entity.username,
    ...(entry.entity.usernames ?? [])
      .filter((item) => item.active)
      .map((item) => item.username),
  ]) {
    if (name) {
      index.set(`@${name.toLowerCase()}`, entry);
    }
  }
  return entry;
}

function validateBatch(links, options) {
  if (!Array.isArray(links) || links.length > 1000) {
    throw new RangeError('A follow batch accepts at most 1000 links');
  }
  for (const key of ['mute', 'archive', 'continueOnFloodWait']) {
    if (options[key] !== undefined && typeof options[key] !== 'boolean') {
      throw new TypeError(`Invalid ${key} option`);
    }
  }
  const now = (options.now ?? (() => Math.floor(Date.now() / 1000)))();
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new TypeError('Invalid follow clock');
  }
  return now;
}

function acceptJoin(result, outcome) {
  if (result?._ === 'messages.chatInviteJoinResultWebView') {
    outcome.status = 'verificationRequired';
    outcome.verification = result;
    return false;
  }
  if (
    ![
      'messages.chatInviteJoinResultOk',
      'updates',
      'updatesCombined',
      'updatesTooLong',
    ].includes(result?._)
  ) {
    throw new TypeError('Invalid join result');
  }
  outcome.joinAccepted = true;
  return true;
}

async function joinOnce(client, peer, outcome, options) {
  try {
    return acceptJoin(await client.joinChat(peer, options), outcome);
  } catch (error) {
    if (TelegramError.from(error).type !== 'USER_ALREADY_PARTICIPANT') {
      throw error;
    }
    outcome.status = 'alreadyMember';
    return true;
  }
}

async function confirmedInvite(client, hash, options) {
  const info = await client.checkChatInvite(hash, options);
  if (info._ !== 'chatInviteAlready' || !isGroup(info.chat)) {
    throw new TelegramError('Joined invite membership could not be confirmed', {
      type: 'JOIN_MEMBERSHIP_UNCONFIRMED',
    });
  }
  return info.chat;
}

async function inviteEntry(client, target, outcome, options, index) {
  const info = await client.checkChatInvite(target.hash, options);
  if (
    !['chatInviteAlready', 'chatInvitePeek', 'chatInvite'].includes(info?._)
  ) {
    throw new TypeError('Invalid invite preflight result');
  }
  let entity;
  if (info._ === 'chatInviteAlready') {
    entity = info.chat;
    outcome.status = 'alreadyMember';
  } else {
    outcome.phase = 'join';
    if (
      !(await joinOnce(
        client,
        `tg://join?invite=${target.hash}`,
        outcome,
        options
      ))
    ) {
      return undefined;
    }
    outcome.phase = 'confirmInvite';
    entity = await confirmedInvite(client, target.hash, options);
    if (outcome.status !== 'alreadyMember') {
      outcome.status = 'joined';
    }
  }
  if (!isGroup(entity)) {
    throw new TypeError('Invite does not identify a group');
  }
  const existing = index.get(groupKey(entity));
  if (existing) {
    return existing;
  }
  return addGroup(index, {
    entity,
    inputPeer: await client.resolvePeer(entity, options),
    dialog: {},
  });
}

async function publicEntry(client, target, outcome, options, index) {
  const existing = index.get(`@${target.username}`);
  if (existing) {
    outcome.status = 'alreadyMember';
    return existing;
  }
  const inputPeer = await client.resolvePeer(`@${target.username}`, options);
  if (inputPeer._ !== 'inputPeerChannel') {
    throw new TypeError('Public destination is not a channel or supergroup');
  }
  const known = index.get(`channel:${inputPeer.channel_id}`);
  if (known) {
    outcome.status = 'alreadyMember';
    return addGroup(index, known, target.username);
  }
  outcome.phase = 'join';
  if (!(await joinOnce(client, inputPeer, outcome, options))) {
    return undefined;
  }
  if (outcome.status !== 'alreadyMember') {
    outcome.status = 'joined';
  }
  return addGroup(
    index,
    {
      entity: {
        _: 'channel',
        id: inputPeer.channel_id,
        username: target.username,
      },
      inputPeer,
      dialog: {},
    },
    target.username
  );
}

function membership(client, target, outcome, options, index) {
  outcome.phase = 'membership';
  if (target.type === 'invite') {
    return inviteEntry(client, target, outcome, options, index);
  }
  if (target.type === 'public') {
    return publicEntry(client, target, outcome, options, index);
  }
  if (target.type === 'privateMessage') {
    const entry = index.get(`channel:${target.channelId}`);
    outcome.status = entry ? 'alreadyMember' : 'inviteRequired';
    return entry;
  }
  outcome.status = 'invalid';
  return undefined;
}

async function applySettings(client, entry, outcome, options, now) {
  if (options.mute) {
    outcome.phase = 'getNotifySettings';
    const current = await client.getNotifySettings(entry.inputPeer, options);
    outcome.settings.mute = notificationMuted(current, now)
      ? 'unchanged'
      : 'pending';
    if (outcome.settings.mute === 'pending') {
      outcome.phase = 'mute';
      outcome.settings.mute = 'failed';
      await client.muteChat(entry.inputPeer, {
        signal: options.signal,
        showPreviews: false,
        silent: true,
      });
      outcome.settings.mute = 'applied';
    }
  }
  if (options.archive) {
    outcome.settings.archive =
      entry.dialog.folder_id === 1 ? 'unchanged' : 'failed';
    if (outcome.settings.archive === 'failed') {
      outcome.phase = 'archive';
      await client.archiveChat(entry.inputPeer, { signal: options.signal });
      outcome.settings.archive = 'applied';
      entry.dialog.folder_id = 1;
    }
  }
  delete outcome.phase;
}

function recordFailure(outcome, error, options) {
  options.signal?.throwIfAborted();
  outcome.error = TelegramError.from(error);
  if (
    outcome.phase === 'join' &&
    outcome.error.type === 'INVITE_REQUEST_SENT'
  ) {
    outcome.status = 'requestSent';
  }
  if (
    outcome.error.type === 'CHANNELS_TOO_MUCH' ||
    (/^FLOOD(?:_PREMIUM)?_WAIT_/.test(outcome.error.type) &&
      !options.continueOnFloodWait)
  ) {
    return { type: outcome.error.type, retryAfter: outcome.error.retryAfter };
  }
  return undefined;
}

/** One attempt per side effect; callers own any durable resumption or later retries. */
export async function followGroups(client, links, input = {}) {
  const options = { ...input };
  const now = validateBatch(links, options);
  links = [...links];
  options.signal?.throwIfAborted();
  const index = new Map();
  const outcomes = [];
  if (links.length === 0) {
    return { outcomes };
  }
  for (const entry of await listGroups(client, {
    ...options.dialogOptions,
    signal: options.signal,
  })) {
    addGroup(index, entry);
  }
  for (const link of links) {
    options.signal?.throwIfAborted();
    const outcome = {
      link,
      status: 'failed',
      settings: { mute: 'notRequested', archive: 'notRequested' },
    };
    outcomes.push(outcome);
    let target;
    try {
      target = parseTelegramLink(link);
    } catch (error) {
      outcome.status = 'invalid';
      outcome.error = error;
      continue;
    }
    try {
      const entry = await membership(client, target, outcome, options, index);
      options.signal?.throwIfAborted();
      if (entry) {
        await applySettings(client, entry, outcome, options, now);
      }
    } catch (error) {
      const stop = recordFailure(outcome, error, options);
      if (stop) {
        return { outcomes, stop: { ...stop, index: outcomes.length - 1 } };
      }
    }
  }
  return { outcomes };
}

/** Read existing history; a private message link does not authorize membership. */
export async function readGroup(
  client,
  identifier,
  { limit = 10, ...options } = {}
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new RangeError('Recent group history limit must be from 1 to 100');
  }
  return await client.getMessages(identifier, { ...options, limit });
}

export async function leaveGroup(client, identifier, options) {
  let peer = identifier;
  if (typeof identifier === 'string' && !/^-?\d+$/.test(identifier)) {
    const target = parseTelegramLink(identifier);
    if (target.type === 'invite') {
      peer = await confirmedInvite(client, target.hash, options);
    }
  }
  return client.leaveChat(peer, options);
}
