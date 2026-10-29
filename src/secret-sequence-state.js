export const MAX_SECRET_COUNTER = 0x3fffffff;
export function secretLimit(value, min, max, name) {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new RangeError(`Invalid secret chat ${name}`);
  }
  return value;
}
export function secretCounter(wire, parity) {
  secretLimit(wire, 0, 0x7fffffff, 'sequence number');
  if (wire % 2 !== parity) {
    throw new RangeError('Invalid secret chat sequence parity');
  }
  return (wire - parity) / 2;
}
export const isSecretResend = (frame) =>
  frame.message?._ === 'decryptedMessageService' &&
  frame.message.action?._ === 'decryptedMessageActionResend';

function cached(data, context) {
  if (
    typeof data !== 'string' ||
    data.length % 4 ||
    data.length > Math.ceil(context.codec.maxBytes / 3) * 4
  ) {
    throw new RangeError('Invalid secret chat cached bytes');
  }
  const size =
    (data.length * 3) / 4 -
    (data.endsWith('==') ? 2 : Number(data.endsWith('=')));
  if (size > context.remaining) {
    throw new RangeError('Secret chat state exceeds buffer byte limit');
  }
  const decoded = Buffer.from(data, 'base64');
  if (decoded.toString('base64') !== data) {
    throw new TypeError('Noncanonical secret chat cached bytes');
  }
  const bytes = Uint8Array.from(decoded);
  decoded.fill(0);
  context.buffers.push(bytes);
  context.remaining -= bytes.length;
  const frame = context.codec.decode(bytes, 'DecryptedMessageLayer');
  secretLimit(frame.layer, 17, 216, 'cached layer');
  if (frame.random_bytes.length < 15) {
    throw new RangeError('Invalid cached secret chat padding');
  }
  return { frame, bytes };
}

function entries(values, maximum) {
  if (!Array.isArray(values) || values.length > maximum) {
    throw new RangeError('Invalid secret chat state cache limit');
  }
  return values;
}

function historyOf(state, context) {
  const output = new Map();
  let previous,
    acknowledgement = 0,
    layer = 17;
  for (const data of entries(state.history, context.maxHistory)) {
    const { frame, bytes } = cached(data, context);
    const index = secretCounter(frame.out_seq_no, context.originator ? 1 : 0);
    const ack = secretCounter(frame.in_seq_no, context.originator ? 0 : 1);
    if (
      index >= state.outgoing ||
      (previous !== undefined && index !== previous + 1) ||
      ack < acknowledgement ||
      ack > state.incoming ||
      frame.layer < layer ||
      frame.layer > context.layer
    ) {
      throw new RangeError('Invalid secret chat history continuity');
    }
    output.set(index, bytes);
    previous = index;
    acknowledgement = ack;
    layer = frame.layer;
  }
  const first = output.keys().next().value;
  if (
    output.size
      ? previous !== state.outgoing - 1 || first > state.acknowledged
      : state.outgoing !== state.acknowledged
  ) {
    throw new RangeError('Missing unacknowledged secret chat history');
  }
  return output;
}

function pendingOf(state, context) {
  const output = new Map();
  for (const data of entries(state.pending, context.maxPending)) {
    const { frame, bytes } = cached(data, context);
    const index = secretCounter(frame.out_seq_no, context.originator ? 0 : 1);
    const ack = secretCounter(frame.in_seq_no, context.originator ? 1 : 0);
    if (
      index <= state.incoming ||
      index >= MAX_SECRET_COUNTER ||
      output.has(index) ||
      ack < state.acknowledged ||
      ack > state.outgoing
    ) {
      throw new RangeError('Invalid pending secret chat sequence');
    }
    output.set(index, { bytes, handledResend: isSecretResend(frame) });
  }
  return output;
}

/** Validate and copy a portable snapshot before exposing any restored state. */
export function restoreSecretSequence(state, options) {
  if (
    !state ||
    state.version !== 1 ||
    state.originator !== options.originator ||
    state.layer !== options.layer
  ) {
    throw new TypeError('Invalid secret chat state version, role or layer');
  }
  for (const name of ['incoming', 'outgoing', 'acknowledged']) {
    secretLimit(state[name], 0, MAX_SECRET_COUNTER, `state ${name}`);
  }
  if (state.acknowledged > state.outgoing) {
    throw new RangeError('Invalid secret chat persisted acknowledgement');
  }
  const context = { ...options, remaining: options.maxBytes, buffers: [] };
  try {
    const history = historyOf(state, context);
    const pending = pendingOf(state, context);
    if (pending.size) {
      secretLimit(
        state.requestedUntil,
        state.incoming,
        MAX_SECRET_COUNTER - 1,
        'persisted resend range'
      );
      if (!pending.has(state.requestedUntil + 1)) {
        throw new RangeError('Invalid secret chat persisted gap');
      }
    } else if (state.requestedUntil !== null) {
      throw new RangeError('Unexpected secret chat persisted resend range');
    }
    return {
      history,
      pending,
      bufferedBytes: options.maxBytes - context.remaining,
      requestedUntil: state.requestedUntil ?? undefined,
    };
  } catch (error) {
    for (const bytes of context.buffers) {
      bytes.fill(0);
    }
    throw error;
  }
}
