import { botMethodSignatures } from './bot-method-signatures.js';
import {
  botRequestOptions,
  callBotOperation,
  isBotSignal,
} from './bot-operations.js';

const descriptors = botMethodSignatures.map((signature) => {
  const [route, ...fields] = signature.split(' ');
  const [name, method = name] = route.split('=');
  const other = fields.at(-1) === '?';
  if (other) {
    fields.pop();
  }
  return { name, method, fields, other };
});

function positionalFields(descriptor, args) {
  return Object.fromEntries(
    descriptor.fields.map((field, index) => {
      const value = args[index];
      if (field === 'text_or_rich_message') {
        const text =
          typeof value === 'string' ||
          (typeof value?.text === 'string' && Array.isArray(value.entities));
        return [text ? 'text' : 'rich_message', value];
      }
      if (descriptor.method === 'sendPoll' && field === 'options') {
        if (!Array.isArray(value) || value.length > 1000) {
          throw new RangeError('Poll options must be a bounded array');
        }
        return [
          field,
          value.map((option) =>
            typeof option === 'string' ? { text: option } : option
          ),
        ];
      }
      return [field, value];
    })
  );
}

function rawArguments({ fields }, args) {
  const value = args[0];
  return (
    fields.length > 0 &&
    args.length <= 2 &&
    value &&
    Object.getPrototypeOf(value) === Object.prototype &&
    fields.every((field) => Object.hasOwn(value, field)) &&
    // A positional InputProfilePhoto itself also contains a photo property.
    !(fields.length === 1 && fields[0] === 'photo' && value.type)
  );
}

function invoke(api, descriptor, args) {
  const { method, fields, other } = descriptor;
  if (rawArguments(descriptor, args)) {
    return callBotOperation(api, method, args[0], args[1]);
  }
  let options = other ? args[fields.length] : undefined;
  let signal = args[fields.length + (other ? 1 : 0)];
  if (!other && signal !== undefined && !isBotSignal(signal)) {
    options = signal;
    signal = undefined;
  }
  const finalOptions = isBotSignal(signal) ? { signal } : signal;
  const values = {
    ...positionalFields(descriptor, args),
    ...botRequestOptions(options),
  };
  // getUpdates.timeout is Telegram's long-poll duration in seconds.
  if (method === 'getUpdates') {
    const { timeout } = values;
    return callBotOperation(
      api,
      method,
      timeout === undefined ? {} : { timeout },
      { ...values, timeout: finalOptions?.timeout },
      finalOptions?.signal
    );
  }
  return callBotOperation(
    api,
    method,
    {},
    {
      ...values,
      ...(finalOptions?.timeout !== undefined && {
        timeout: finalOptions.timeout,
      }),
    },
    finalOptions?.signal
  );
}

/** Positional views share one translator and the already selected transport. */
export function positionalBotMethods(api) {
  return Object.fromEntries(
    descriptors.map((descriptor) => [
      descriptor.name,
      (...args) => invoke(api, descriptor, args),
    ])
  );
}
