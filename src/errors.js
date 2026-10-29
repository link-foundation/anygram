export function throwFailures(failures, message) {
  if (failures.length === 1) {
    throw failures[0];
  }
  if (failures.length > 1) {
    throw new globalThis.AggregateError(failures, message);
  }
}

export class UnsupportedError extends Error {
  constructor(operation, backend) {
    super(
      `Operation ${operation} is unavailable${backend ? ` on ${backend}` : ''}`
    );
    this.name = 'UnsupportedError';
    this.operation = operation;
    this.backend = backend;
  }
}

export class TelegramError extends Error {
  constructor(
    message,
    { code, type, backend, retryAfter, migrateTo, cause } = {}
  ) {
    super(message, { cause });
    this.name = 'TelegramError';
    Object.assign(this, { code, type, backend, retryAfter, migrateTo });
  }

  static from(error, backend) {
    if (error instanceof TelegramError || error instanceof UnsupportedError) {
      return error;
    }
    const response = botResponse(error);
    if (response) {
      return botApiError(response, {
        method: error.method,
        backend,
        cause: error,
      });
    }
    const type = errorText(error);
    const details = error ?? {};
    const wait = /(?:FLOOD|SLOWMODE|FLOOD_PREMIUM)_WAIT_(\d+)/.exec(type);
    const migrate = /(?:PHONE|NETWORK|USER|FILE)_MIGRATE_(\d+)/.exec(type);
    return new TelegramError(type, {
      code: details.code ?? details.error_code,
      type,
      backend,
      retryAfter:
        details.seconds ??
        details.parameters?.retry_after ??
        (wait ? Number(wait[1]) : undefined),
      migrateTo:
        details.newDc ??
        details.parameters?.migrate_to_chat_id ??
        (migrate ? Number(migrate[1]) : undefined),
      cause: error,
    });
  }
}

function errorText(error) {
  return (
    error?.errorMessage ??
    error?.error_message ??
    error?.text ??
    error?.message ??
    String(error)
  );
}

function botResponse(error) {
  const response = error?.response ?? error;
  return response?.ok === false &&
    Number.isInteger(response.error_code) &&
    typeof response.description === 'string'
    ? response
    : undefined;
}

/** Shared Bot API error data, retaining aliases used by both bot frameworks. */
export function botApiError(response, options = {}) {
  const parameters = { ...response.parameters };
  const error = new TelegramError(response.description, {
    code: response.error_code,
    type: 'BOT_API_ERROR',
    backend: options.backend,
    retryAfter: parameters.retry_after,
    migrateTo: parameters.migrate_to_chat_id,
    cause: options.cause,
  });
  return Object.assign(error, {
    ok: false,
    error_code: error.code,
    description: error.message,
    parameters,
    method: options.method,
    response: {
      ok: false,
      error_code: error.code,
      description: error.message,
      parameters,
    },
  });
}
