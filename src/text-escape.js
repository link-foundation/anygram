/** Check expansion before allocating replacement strings. Ampersand goes first. */
export function escapeBounded(text, replacements, limit, message) {
  let length = text.length;
  for (const [char, value] of Object.entries(replacements)) {
    let at = text.indexOf(char);
    while (at >= 0) {
      length += value.length - char.length;
      if (length > limit) {
        throw new RangeError(message);
      }
      at = text.indexOf(char, at + char.length);
    }
  }
  if (length > limit) {
    throw new RangeError(message);
  }
  for (const [char, value] of Object.entries(replacements)) {
    text = text.replaceAll(char, value);
  }
  return text;
}
