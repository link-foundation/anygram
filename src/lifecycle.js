import { UnsupportedError } from './errors.js';

const owners = new WeakSet();

function startRequest(start, connection) {
  if (start === undefined) {
    return connection;
  }
  if (!start || typeof start !== 'object' || Array.isArray(start)) {
    throw new TypeError('Invalid connection login options');
  }
  return {
    ...connection,
    ...start,
    ...(connection.signal ? { signal: connection.signal } : {}),
  };
}

function scopeOptions(
  task,
  { start, cleanupAttempts = 3, cleanupDelay = 100, ...connection }
) {
  if (
    typeof task !== 'function' ||
    !Number.isInteger(cleanupAttempts) ||
    cleanupAttempts < 1 ||
    cleanupAttempts > 3 ||
    !Number.isFinite(cleanupDelay) ||
    cleanupDelay < 0 ||
    cleanupDelay > 1000
  ) {
    throw new TypeError('Invalid connection scope options');
  }
  connection.signal?.throwIfAborted();
  return {
    operation: start === undefined ? 'connect' : 'start',
    request: startRequest(start, connection),
    signal: connection.signal,
    cleanupAttempts,
    cleanupDelay,
  };
}

function retryEvent(client, adapter, operation) {
  try {
    client.debug?.({
      event: 'cleanup.retry',
      backend: adapter.name,
      operation,
    });
  } catch {
    // A diagnostic callback cannot prevent the remaining cleanup attempts.
  }
}

async function closeStage(client, adapter, operation, options, failures) {
  for (let attempt = 1; attempt <= options.cleanupAttempts; attempt++) {
    try {
      await adapter.execute(operation, []);
      return true;
    } catch (cause) {
      failures.push(
        new Error(`${operation} attempt ${attempt} failed`, { cause })
      );
      if (attempt < options.cleanupAttempts) {
        retryEvent(client, adapter, operation);
        if (options.cleanupDelay) {
          await new Promise((resolve) =>
            globalThis.setTimeout(resolve, options.cleanupDelay)
          );
        }
      }
    }
  }
  return false;
}

async function closeConnection(client, adapter, stages, options) {
  const failures = [];
  let exhausted = false;
  for (const operation of stages) {
    const closed = await closeStage(
      client,
      adapter,
      operation,
      options,
      failures
    );
    exhausted ||= !closed;
  }
  return exhausted ? failures : [];
}

/** Own one backend until both application work and bounded cleanup have settled. */
export async function withConnection(client, task, input = {}) {
  const options = scopeOptions(task, input);
  const adapter = client.adapters.find(
    (candidate) =>
      (!client.selected || candidate.name === client.selected) &&
      candidate.supports(options.operation)
  );
  const stages = ['disconnect', 'destroy'].filter((operation) =>
    adapter?.supports(operation)
  );
  if (!adapter || stages.length === 0) {
    throw new UnsupportedError(
      'a connectable and closable backend',
      client.selected
    );
  }
  if (owners.has(adapter.client)) {
    throw new Error('Telegram connection is already owned by another scope');
  }
  owners.add(adapter.client);
  try {
    const scoped = client.withBackend(adapter.name);
    let value;
    let primary;
    let failed = false;
    try {
      await scoped.execute(options.operation, options.request);
      options.signal?.throwIfAborted();
      value = await task(scoped);
    } catch (error) {
      failed = true;
      primary = error;
    }
    const failures = await closeConnection(client, adapter, stages, options);
    if (failures.length) {
      throw new globalThis.AggregateError(
        failed ? [primary, ...failures] : failures,
        failed
          ? 'Telegram work and connection cleanup failed'
          : 'Telegram connection cleanup failed',
        { cause: failed ? primary : failures.at(-1).cause }
      );
    }
    if (failed) {
      throw primary;
    }
    return value;
  } finally {
    owners.delete(adapter.client);
  }
}
