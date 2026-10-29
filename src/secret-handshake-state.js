import { hash, validateDhParameters, validateDhPublic } from './crypto.js';
import { TlCodec } from './tl.js';
import { SecretChatKeyExchange } from './secret-key-exchange.js';
import { secretLimit } from './secret-sequence-state.js';

const codec = new TlCodec({ maxBytes: 1024, maxDepth: 8, maxVector: 100 });
export const secretChatId = (value) =>
  secretLimit(value, 1, 0x7fffffff, 'chat ID');

export function secretLong(value, name, positive = false) {
  if (
    !['string', 'bigint'].includes(typeof value) ||
    !/^-?(0|[1-9]\d{0,18})$/.test(String(value))
  ) {
    throw new TypeError(`Invalid secret chat ${name}`);
  }
  const number = BigInt(value);
  if (
    number < (positive ? 1n : -(1n << 63n)) ||
    number >= 1n << 63n ||
    String(number) !== String(value)
  ) {
    throw new RangeError(`Invalid secret chat ${name}`);
  }
  return number;
}

export function secretPublic(value) {
  if (!(value instanceof Uint8Array) || !value.length || value.length > 256) {
    throw new RangeError('Invalid secret chat public value length');
  }
  return Buffer.from(value);
}

export function secretDecodedBytes(value, min, max, name) {
  if (
    typeof value !== 'string' ||
    value.length > Math.ceil(max / 3) * 4 ||
    value.length % 4
  ) {
    throw new TypeError(`Invalid secret chat ${name} encoding`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (
    bytes.length < min ||
    bytes.length > max ||
    bytes.toString('base64') !== value
  ) {
    bytes.fill(0);
    throw new TypeError(`Invalid secret chat ${name} encoding`);
  }
  return bytes;
}

export function secretRequestUser(user, selfId) {
  if (!['inputUser', 'inputUserFromMessage'].includes(user?._)) {
    throw new TypeError('Expected a secret chat InputUser');
  }
  const remoteId = secretLong(user.user_id, 'remote user ID', true);
  if (remoteId === selfId) {
    throw new RangeError('Secret chat participants must be different');
  }
  return {
    remoteId,
    user: Buffer.from(codec.encode(user, 'InputUser')).toString('base64'),
  };
}

export function secretDecodedUser(value) {
  return codec.decode(
    secretDecodedBytes(value, 4, 1024, 'InputUser'),
    'InputUser'
  );
}

export function bindSecretChat(chat, data) {
  if (
    secretLong(chat.admin_id, 'administrator ID', true) !==
      (data.originator ? data.selfId : data.remoteId) ||
    secretLong(chat.participant_id, 'participant ID', true) !==
      (data.originator ? data.remoteId : data.selfId)
  ) {
    throw new RangeError('Secret chat participant binding mismatch');
  }
  const accessHash = secretLong(chat.access_hash, 'access hash');
  if (data.accessHash !== null && data.accessHash !== accessHash) {
    throw new RangeError('Secret chat access hash mismatch');
  }
  return accessHash;
}

function validatePhase(data) {
  const pending = ['requesting', 'waiting'].includes(data.phase);
  const keyed = ['accepting', 'ready'].includes(data.phase);
  if (
    (pending && !data.originator) ||
    (data.phase === 'accepting' && data.originator) ||
    pending !== Boolean(data.exchange) ||
    keyed !== Boolean(data.key) ||
    keyed !== Boolean(data.remotePublic) ||
    keyed !== (data.fingerprint !== null) ||
    (data.phase === 'requesting' && data.accessHash !== null) ||
    (['waiting', 'accepting', 'ready'].includes(data.phase) &&
      data.accessHash === null)
  ) {
    throw new TypeError('Inconsistent secret chat handshake phase');
  }
}

export function restoreSecretHandshake(state) {
  if (
    state?.version !== 1 ||
    typeof state.originator !== 'boolean' ||
    !['requesting', 'waiting', 'accepting', 'ready', 'discarded'].includes(
      state.phase
    )
  ) {
    throw new TypeError('Invalid secret chat handshake state');
  }
  const data = {
    phase: state.phase,
    originator: state.originator,
    selfId: secretLong(state.selfId, 'self ID', true),
    remoteId: secretLong(state.remoteId, 'remote ID', true),
    chatId: secretChatId(state.chatId),
    accessHash:
      state.accessHash === null
        ? null
        : secretLong(state.accessHash, 'access hash'),
    publicValue: secretDecodedBytes(
      state.publicValue,
      256,
      256,
      'public value'
    ),
    remotePublic: null,
    user: null,
    key: null,
    fingerprint: null,
    exchange: null,
    dh: null,
  };
  try {
    restoreMaterial(data, state);
    restoreDh(data, state);
    validatePhase(data);
    if (data.selfId === data.remoteId) {
      throw new RangeError('Secret chat participants must be different');
    }
    return data;
  } catch (error) {
    data.key?.fill(0);
    data.exchange?.destroy();
    throw error;
  }
}

function restoreDh(data, state) {
  const config = state.dh ?? state.exchange;
  if (!config) {
    return;
  }
  const p = secretDecodedBytes(config.p, 256, 256, 'original DH prime');
  const prime = validateDhParameters(p, config.g);
  validateDhPublic(prime, data.publicValue);
  if (data.remotePublic) {
    validateDhPublic(prime, data.remotePublic);
  }
  if (
    state.exchange &&
    (state.exchange.p !== config.p || state.exchange.g !== config.g)
  ) {
    throw new TypeError('Secret chat original DH parameters mismatch');
  }
  data.dh = { p, g: config.g };
}

function restoreMaterial(data, state) {
  if (data.originator) {
    const user = secretRequestUser(secretDecodedUser(state.user), data.selfId);
    if (user.remoteId !== data.remoteId) {
      throw new RangeError('Secret chat request user mismatch');
    }
    data.user = user.user;
  } else if (state.user !== null) {
    throw new TypeError('Unexpected secret chat request user');
  }
  if (state.remotePublic !== null) {
    data.remotePublic = secretDecodedBytes(
      state.remotePublic,
      1,
      256,
      'remote public'
    );
  }
  if (state.key !== null) {
    data.key = secretDecodedBytes(state.key, 256, 256, 'key');
    data.fingerprint = secretLong(state.fingerprint, 'key fingerprint');
    if (hash('sha1', data.key).readBigInt64LE(12) !== data.fingerprint) {
      throw new Error('Secret chat restored key fingerprint mismatch');
    }
  } else if (state.fingerprint !== null) {
    throw new TypeError('Unexpected secret chat key fingerprint');
  }
  if (state.exchange !== null) {
    const pending = state.exchange;
    const p = secretDecodedBytes(pending?.p, 256, 256, 'DH prime');
    data.exchange = new SecretChatKeyExchange({
      p,
      g: pending.g,
      state: pending,
    });
    if (!data.publicValue.equals(data.exchange.publicValue)) {
      throw new Error('Secret chat restored public value mismatch');
    }
  }
}
