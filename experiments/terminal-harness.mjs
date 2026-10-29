import { setImmediate as turn } from 'node:timers/promises';
import { Bot } from '../src/index.js';
import {
  loadTerminalSource,
  loadVirtualTerminal,
} from './load-terminal-source.mjs';

export function terminalClock() {
  let now = 100000,
    identifier = 0,
    work = 0;
  const pending = new Map();
  return {
    get now() {
      return now;
    },
    get pending() {
      return pending.size;
    },
    setTimeout(callback, delay) {
      if (
        ++work > 256 ||
        pending.size >= 64 ||
        !Number.isFinite(delay) ||
        delay < 0
      ) {
        throw new RangeError('Terminal clock probe exceeded its finite budget');
      }
      pending.set(++identifier, { callback, at: now + delay });
      return identifier;
    },
    clearTimeout(id) {
      pending.delete(id);
    },
    async advance(duration) {
      const target = now + duration;
      for (;;) {
        const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > target) {
          break;
        }
        pending.delete(next[0]);
        now = next[1].at;
        await next[1].callback();
        await turn();
      }
      now = target;
      await turn();
    },
  };
}

function terminals() {
  const instances = [];
  return {
    instances,
    spawn(shell, args, options) {
      if (instances.length >= 16) {
        throw new RangeError('Terminal spawn fixture budget exceeded');
      }
      let data, exit;
      const terminal = {
        shell,
        args,
        options,
        writes: [],
        killed: 0,
        onData(handler) {
          data = handler;
        },
        onExit(handler) {
          exit = handler;
        },
        write(value) {
          if (terminal.writes.length >= 64 || value.length > 8192) {
            throw new RangeError('PTY write fixture budget exceeded');
          }
          terminal.writes.push(value);
        },
        kill() {
          terminal.killed++;
        },
        data(value) {
          if (value.length > 8192) {
            throw new RangeError('PTY data fixture budget exceeded');
          }
          data(value);
        },
        exit() {
          exit(0, 0);
        },
      };
      instances.push(terminal);
      return terminal;
    },
  };
}

function rendering(frames) {
  class GIFEncoder {
    createReadStream() {
      return (async function* () {
        yield Buffer.from('GIF89a');
      })();
    }
    start() {}
    setRepeat() {}
    setDelay() {}
    setQuality() {}
    addFrame(context) {
      frames.push(context.lines);
    }
    finish() {}
  }
  return {
    GIFEncoder,
    createCanvas() {
      return {
        getContext() {
          return {
            lines: [],
            fillRect() {},
            fillText(text) {
              this.lines.push(text);
            },
          };
        },
      };
    },
  };
}

function fixtureLogger(errors) {
  return Object.fromEntries(
    ['info', 'warn', 'debug', 'fatal', 'error'].map((level) => [
      level,
      (...args) => {
        if (level === 'error') {
          errors.push(args);
        }
      },
    ])
  );
}

function fixtureLogStream() {
  return {
    once(event, callback) {
      if (event === 'finish') {
        this.finish = callback;
      }
    },
    end() {
      this.finish();
    },
  };
}

export function terminalHarness(
  mode,
  {
    Constructor = Bot,
    migrated = true,
    env = {},
    dependencies = {},
    startup = false,
    initialization = false,
    botOptions = {},
    processExtras = {},
    fetch: transportFetch,
  } = {}
) {
  const calls = [],
    exits = [],
    frames = [],
    errors = [];
  const clock = terminalClock(),
    pty = terminals(),
    signals = new Map();
  let failure;
  const fetcher = (url, options) => {
    const method = url.split('/').at(-1);
    const params =
      typeof options.body === 'string'
        ? JSON.parse(options.body)
        : options.body;
    calls.push({ method, params });
    if (transportFetch) {
      return transportFetch(method, params, options);
    }
    const result = failure?.(method, params) ?? {
      ok: true,
      result: { message_id: calls.length },
    };
    return Promise.resolve(
      new Response(JSON.stringify(result), {
        status: result.ok ? 200 : result.error_code,
      })
    );
  };
  class FixtureBot extends Constructor {
    constructor(token) {
      super(token, {
        botInfo: { id: 1, is_bot: true, username: 'terminalbot' },
        fetch: fetcher,
        ...botOptions,
      });
      if (Object.hasOwn(this.api, 'config')) {
        this.api.config.use((next, method, params) => {
          calls.push({ method, params });
          return Promise.resolve(
            failure?.(method, params) ?? {
              ok: true,
              result: { message_id: calls.length },
            }
          );
        });
      }
    }
  }
  const logger = fixtureLogger(errors);
  class FixtureDate extends Date {
    static now() {
      return clock.now;
    }
  }
  const scenario = loadTerminalSource(
    mode,
    {
      Bot: FixtureBot,
      pty,
      logger,
      VirtualTerminal: loadVirtualTerminal(),
      ...rendering(frames),
      Buffer,
      global: {},
      Date: FixtureDate,
      setTimeout: clock.setTimeout,
      clearTimeout: clock.clearTimeout,
      ...(startup ? {} : { polling: Promise.resolve() }),
      logStream: fixtureLogStream(),
      process: {
        env: { BOT_TOKEN: 'terminal:fixture', AUTHORIZED_USER_ID: '8', ...env },
        on(name, callback) {
          signals.set(name, callback);
        },
        once(name, callback) {
          signals.set(name, callback);
        },
        exit(code) {
          exits.push(code);
          if (code) {
            throw new Error(`Terminal fixture requested failure exit ${code}`);
          }
        },
        ...processExtras,
      },
      ...dependencies,
    },
    { migrated, startup, initialization }
  );
  let updateId = 0;
  return {
    ...scenario,
    calls,
    exits,
    errors,
    frames,
    clock,
    terminals: pty.instances,
    fail(handler) {
      failure = handler;
    },
    async signal(name) {
      await signals.get(name)();
      await turn();
    },
    send(text, from = { id: 8, username: 'owner' }) {
      const id = ++updateId;
      return scenario.bot.handleUpdate({
        update_id: id,
        message: {
          message_id: id,
          chat: { id: 7, type: 'private' },
          from,
          date: 1,
          text,
          ...(text.startsWith('/')
            ? {
                entities: [
                  {
                    type: 'bot_command',
                    offset: 0,
                    length: text.split(' ')[0].length,
                  },
                ],
              }
            : {}),
        },
      });
    },
  };
}
