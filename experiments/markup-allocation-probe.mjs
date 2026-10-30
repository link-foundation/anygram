/** Measure strings materialized by replacement operations during a sync call. */
export function markupAllocations(action) {
  const methods = ['replace', 'replaceAll'];
  const originals = methods.map((name) => String.prototype[name]);
  let codeUnits = 0;
  try {
    methods.forEach((name, index) => {
      String.prototype[name] = function (...args) {
        const result = originals[index].apply(this, args);
        if (result !== String(this)) {
          codeUnits += result.length;
        }
        return result;
      };
    });
    let error;
    try {
      action();
    } catch (cause) {
      error = cause;
    }
    return { error, codeUnits };
  } finally {
    methods.forEach((name, index) => {
      String.prototype[name] = originals[index];
    });
  }
}
