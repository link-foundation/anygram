import { botRequestOptions } from './bot-operations.js';
import { botMethodSignatures } from './bot-method-signatures.js';

const apiWidths = new Map(
  botMethodSignatures.map((signature) => {
    const [name, ...fields] = signature.split(' ');
    return [name.split('=')[0], fields.length + 1];
  })
);

// Pinned contexts retain omitted optional arguments when calling public APIs.
export function contextApiCall(ctx, method, prefix, args) {
  const width = apiWidths.get(method);
  if (width === undefined) {
    throw new Error(`Unknown context API method: ${method}`);
  }
  return ctx.api[method](
    ...prefix,
    ...Array.from({ length: width - prefix.length }, (_, index) => args[index])
  );
}

export function contextRequired(value, method, ctx) {
  if (value !== undefined) {
    return value;
  }
  if (ctx) {
    throw new TypeError(
      `Telegraf: "${method}" isn't available for "${ctx.updateType}"`
    );
  }
  throw new Error(`Missing information for API call to ${method}`);
}

export function contextMethod(Type, name, value) {
  Object.defineProperty(Type.prototype, name, {
    configurable: true,
    writable: true,
    value,
  });
}

export function contextAlias(Type, name, target) {
  contextMethod(Type, name, function (...args) {
    return this[target](...args);
  });
}

// b: business; t: topic-only thread; T: any thread; d: direct-message topic.
export function contextOptions(ctx, flags, other) {
  const msg = ctx.msg;
  return {
    ...(flags.includes('b') && {
      business_connection_id: ctx.businessConnectionId,
    }),
    ...((flags.includes('T') ||
      (flags.includes('t') && msg?.is_topic_message)) && {
      message_thread_id: msg?.message_thread_id,
    }),
    ...(flags.includes('d') && {
      direct_messages_topic_id: msg?.direct_messages_topic?.topic_id,
    }),
    ...botRequestOptions(other),
  };
}
