import { telegrafMethodSignatures } from './telegraf-method-signatures.js';
import { botTextParams } from './formatting.js';
import { botRequestOptions, callBotOperation } from './bot-operations.js';

const descriptors = telegrafMethodSignatures.map((value) => JSON.parse(value));

function formatted(value, format) {
  if (format === 'text') {
    return {
      text:
        typeof value?.text === 'string'
          ? Array.isArray(value.entities)
            ? value
            : value.text
          : String(value),
    };
  }
  if (format === 'caption' && value) {
    const caption = value.caption;
    return typeof caption?.text === 'string' && !Array.isArray(caption.entities)
      ? { ...value, caption: caption.text }
      : botTextParams(value);
  }
  return value;
}

function rawArguments(descriptor, args) {
  const first = args[0];
  return (
    args.length <= 2 &&
    first &&
    Object.getPrototypeOf(first) === Object.prototype &&
    descriptor.fields.some(
      (field) =>
        field.from?.length === 1 &&
        field.from[0] === 0 &&
        Object.hasOwn(first, field.key)
    )
  );
}

function fieldValue(field, args) {
  let value = field.from
    ? field.from.reduce((value, key) => value?.[key], args)
    : field.value;
  value = field.not ? !value : formatted(value, field.format);
  return field.key === 'caption' &&
    typeof value?.text === 'string' &&
    !Array.isArray(value.entities)
    ? value.text
    : value;
}

function invoke(api, descriptor, provided) {
  if (descriptor.helper === 'fileLink') {
    return api.getFileLink(...provided);
  }
  if (rawArguments(descriptor, provided)) {
    return callBotOperation(api, descriptor.method, provided[0], provided[1]);
  }
  const args = descriptor.args.map((arg, index) =>
    provided[index] === undefined ? arg.default : provided[index]
  );
  const controls = {};
  const params = {};
  for (const field of descriptor.fields) {
    if (field.spread !== undefined) {
      let value = formatted(args[field.spread], field.format);
      if (descriptor.args[field.spread].name === 'extra') {
        const { signal, timeout, ...rest } = botRequestOptions(value) ?? {};
        Object.assign(controls, { signal, timeout });
        value = rest;
      }
      Object.assign(params, value);
    } else {
      params[field.key] = fieldValue(field, args);
    }
  }
  const final = botRequestOptions(provided[descriptor.args.length]);
  if (final?.signal !== undefined) {
    controls.signal = final.signal;
  }
  if (final?.timeout !== undefined) {
    controls.timeout = final.timeout;
  }
  return callBotOperation(api, descriptor.method, params, controls);
}

/** Telegraf's field order, aliases and defaults share the normal operation path. */
export function telegrafBotMethods(api) {
  return Object.fromEntries(
    descriptors.map(([name, descriptor]) => [
      name,
      (...args) => invoke(api, descriptor, args),
    ])
  );
}
