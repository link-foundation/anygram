function thrownMessage(error) {
  if (error instanceof Error) {
    return `${error.name} in middleware: ${error.message}`;
  }
  const type = typeof error;
  const prefix = `Non-error value of type ${type} thrown in middleware`;
  if (type === 'string') {
    return `${prefix}: ${error.substring(0, 50)}`;
  }
  if (['number', 'bigint', 'boolean', 'symbol'].includes(type)) {
    return `${prefix}: ${String(error)}`;
  }
  return `${prefix}!`;
}

/** Preserve the original thrown value and the update context. */
export class BotError extends Error {
  constructor(error, ctx) {
    super(thrownMessage(error));
    this.name = 'BotError';
    this.error = error;
    this.ctx = ctx;
    if (error instanceof Error) {
      this.stack = error.stack;
    }
  }
}
