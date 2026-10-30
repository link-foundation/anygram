import {
  camel,
  objectRequest,
  requestOf,
  schemaDefinition,
  requestLimits,
  valueMapper,
  mapObjectValues,
} from './requests.js';
import { castInputMedia, mediaInputTypes } from './tl-media.js';

export const resolvableTypes = new Set([
  'InputPeer',
  'InputUser',
  'InputChannel',
  'InputDialogPeer',
  'InputNotifyPeer',
  'InputMessage',
  ...mediaInputTypes,
]);

function canonical(value) {
  return objectRequest({ method: 'value', params: { value } }).value;
}

async function resolveInput(value, type, client, construct, options, depth) {
  options?.signal?.throwIfAborted();
  const input = canonical(value);
  const definition = input?._ && schemaDefinition(input._);
  if (definition?.type === type) {
    await resolveFields(
      value,
      definition.params,
      client,
      construct,
      options,
      depth
    );
    return value;
  }
  if (type === 'InputMessage') {
    return inputMessage(value, input, definition, construct);
  }
  if (mediaInputTypes.has(type)) {
    const materialize = valueMapper(
      (entry, next) => {
        if (
          !entry ||
          typeof entry !== 'object' ||
          entry instanceof Uint8Array
        ) {
          return entry;
        }
        const fields = mapObjectValues(entry, next);
        return entry._ ? construct(entry._, fields) : fields;
      },
      { maxDepth: requestLimits.maxDepth - depth }
    );
    return materialize(castInputMedia(input, type, depth));
  }
  const peer = canonical(
    await client.getInputEntity(
      typeof input === 'bigint' ? input : value,
      options
    )
  );
  options?.signal?.throwIfAborted();
  return inputPeer(peer, type, construct);
}

function inputMessage(value, input, definition, construct) {
  if (typeof value !== 'number' && definition?.type !== 'Message') {
    throw new TypeError('Cannot resolve value as InputMessage');
  }
  return construct('inputMessageID', {
    id: typeof value === 'number' ? value : input.id,
  });
}

const peerTypes = {
  InputUser: {
    inputPeerSelf: 'inputUserSelf',
    inputPeerEmpty: 'inputUserEmpty',
    inputPeerUser: 'inputUser',
    inputPeerUserFromMessage: 'inputUserFromMessage',
  },
  InputChannel: {
    inputPeerChannel: 'inputChannel',
    inputPeerChannelFromMessage: 'inputChannelFromMessage',
  },
};
function inputPeer(peer, type, construct) {
  if (schemaDefinition(peer?._)?.type !== 'InputPeer') {
    throw new TypeError('Peer resolver must return an InputPeer');
  }
  if (type === 'InputPeer') {
    return construct(peer._, peer);
  }
  if (type === 'InputDialogPeer' || type === 'InputNotifyPeer') {
    return construct(
      type === 'InputDialogPeer' ? 'inputDialogPeer' : 'inputNotifyPeer',
      {
        peer: construct(peer._, peer),
      }
    );
  }
  const tag = peerTypes[type]?.[peer._];
  if (!tag) {
    throw new TypeError(`Cannot resolve peer as ${type}`);
  }
  return construct(tag, peer);
}

async function resolveValue(value, type, client, construct, options, depth) {
  if (depth > requestLimits.maxDepth) {
    throw new RangeError('TL depth limit exceeded');
  }
  if (resolvableTypes.has(type)) {
    return resolveInput(value, type, client, construct, options, depth);
  }
  const definition = schemaDefinition(value?._ ?? value?.className);
  if (
    definition &&
    (definition.type === type ||
      definition.predicate === type ||
      ['Object', 'X', '!X'].includes(type))
  ) {
    await resolveFields(
      value,
      definition.params,
      client,
      construct,
      options,
      depth
    );
  }
  return value;
}

export async function resolveTlRequest(
  request,
  fields,
  client,
  construct,
  options
) {
  options?.signal?.throwIfAborted();
  // Validate the complete shape before any lookup or mutation, including cycles.
  objectRequest(requestOf(request));
  await resolveFields(request, fields, client, construct, options);
}

async function resolveFields(
  request,
  fields,
  client,
  construct,
  options,
  depth = 0
) {
  for (const field of fields) {
    options?.signal?.throwIfAborted();
    const key = field.name in request ? field.name : camel(field.name);
    const type = field.type.replace(/^\w+\.\d+\?/, '');
    const vector = /^(?:Vector|vector)<(.+)>$/.exec(type);
    const target = vector?.[1] ?? type;
    const value = request[key];
    if (value === undefined || value === null) {
      continue;
    }
    if (vector) {
      if (!Array.isArray(value) || value.length > requestLimits.maxVector) {
        throw new RangeError('Invalid TL vector length');
      }
      const result = [];
      for (const item of value.slice()) {
        result.push(
          await resolveValue(
            item,
            target,
            client,
            construct,
            options,
            depth + 2
          )
        );
      }
      request[key] = result;
    } else {
      request[key] = await resolveValue(
        value,
        target,
        client,
        construct,
        options,
        depth + 1
      );
    }
  }
}
