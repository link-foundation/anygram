/** Copy a bounded list of client MTProto message IDs before queuing a call. */
export function rpcDependencies(ids) {
  if (ids === undefined) {
    return [];
  }
  if (!Array.isArray(ids) || ids.length > 1000) {
    throw new RangeError('Invalid MTProto dependency limit');
  }
  const output = [];
  const seen = new Set();
  for (const id of ids) {
    if (
      typeof id !== 'bigint' ||
      id <= 0n ||
      id >= 1n << 63n ||
      id % 4n ||
      seen.has(id)
    ) {
      throw new RangeError('Invalid MTProto dependency message ID');
    }
    seen.add(id);
    output.push(id);
  }
  return output;
}

/** Generic wrappers return their innermost query's concrete TL result type. */
export function rpcResultType(codec, request) {
  for (let depth = 0; depth <= codec.maxDepth; depth++) {
    const definition = codec.methods.get(request?._);
    if (!definition) {
      throw new TypeError(`Unknown Telegram RPC ${request?._}`);
    }
    if (definition.type !== 'X') {
      return definition.type;
    }
    request = request.query;
  }
  throw new RangeError('MTProto generic query depth exceeded');
}
