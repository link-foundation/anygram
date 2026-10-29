// Translate reviewed public wire types without importing SDK declarations.
const primitives = {
  Integer: 'number',
  Float: 'number',
  String: 'string',
  Boolean: 'boolean',
  True: 'true',
};
export function factType(type, names, { arrays = 'Array', richText } = {}) {
  const nested = (value) => factType(value, names, { arrays, richText });
  if (type === 'Array of RichText' && richText) {
    return richText;
  }
  if (type.startsWith('Array of ')) {
    return `${arrays}<${nested(type.substring(9).replaceAll(', ', ' or ').replaceAll(' and ', ' or '))}>`;
  }
  if (type.includes(' or ')) {
    return type.split(' or ').map(nested).join(' | ');
  }
  if (primitives[type]) {
    return primitives[type];
  }
  if (!names.has(type)) {
    throw new Error(`Unknown Bot API type: ${type}`);
  }
  return `BotModels[${JSON.stringify(type)}]`;
}
