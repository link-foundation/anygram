function replaceOnce(source, before, after) {
  const index = source.indexOf(before);
  if (index < 0 || source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Terminal migration expected one occurrence of ${before}`);
  }
  return source.replace(before, after);
}

function retireSessions(source) {
  source = replaceOnce(
    source,
    'let updateTimeout = null;',
    'let updateTimeout = null;\n    let initialUpdateTimeout = null;'
  );
  source = replaceOnce(
    source,
    'setTimeout(updateTerminalMessage, 500);',
    'initialUpdateTimeout = setTimeout(updateTerminalMessage, 500);'
  );
  source = replaceOnce(
    source,
    '      updateTerminalMessage,',
    `      updateTerminalMessage,
      cleanup() {
        clearTimeout(updateTimeout);
        clearTimeout(initialUpdateTimeout);
        this.cancelAnimation?.();
        if (typeof unsubscribeFromChanges === 'function') {
          unsubscribeFromChanges();
        }
      },`
  );
  source = replaceOnce(
    source,
    'userSessions.get(userId).terminal.kill();',
    'userSessions.get(userId).cleanup();\n      userSessions.get(userId).terminal.kill();'
  );
  source = source.replaceAll(
    'session.terminal.kill();',
    'session.cleanup();\n      session.terminal.kill();'
  );
  const guard = `if (userSessions.get(userId)?.terminal !== terminal) { return; }`;
  source = replaceOnce(
    source,
    'terminal.onData((data) => {',
    `terminal.onData((data) => {\n      ${guard}`
  );
  source = replaceOnce(
    source,
    'terminal.onExit((exitCode, signal) => {',
    `terminal.onExit((exitCode, signal) => {\n      ${guard}\n      userSessions.get(userId).cleanup();`
  );
  source = replaceOnce(
    source,
    'async function updateTerminalMessage() {',
    `async function updateTerminalMessage() {\n      ${guard}`
  );
  return source;
}

function cancelAnimation(source) {
  return replaceOnce(
    source,
    'await new Promise(resolve => setTimeout(resolve, ANIMATION_DURATION + 500));',
    `let animationTimeout;
      await new Promise(resolve => {
        session.cancelAnimation = () => {
          clearTimeout(frameTimeout);
          clearTimeout(animationTimeout);
          resolve();
        };
        animationTimeout = setTimeout(resolve, ANIMATION_DURATION + 500);
      });
      clearTimeout(animationTimeout);
      delete session.cancelAnimation;
      if (userSessions.get(userId) !== session) { return; }`
  );
}

function gracefulShutdown(source) {
  const begin = source.indexOf('process.once("SIGINT"');
  const end = source.indexOf('// Start the bot', begin);
  if (begin < 0 || end <= begin) {
    throw new Error('Terminal shutdown boundaries changed');
  }
  const handlers = `let shutdownTask;
function shutdownTerminal() {
  shutdownTask ??= (async () => {
    bot.stop();
    for (const [userId, session] of userSessions) {
      try {
        session.cleanup();
        session.terminal.kill();
      } catch (error) {
        logger.warn({ userId, error: error.message }, 'Terminal cleanup failed');
      }
    }
    userSessions.clear();
    await polling;
    await bot.queue;
    logger.info('All terminal sessions and polling closed');
    process.exit(0);
  })();
  return shutdownTask;
}
process.once("SIGINT", shutdownTerminal);
process.once("SIGTERM", shutdownTerminal);

`;
  source = source.slice(0, begin) + handlers + source.slice(end);
  return replaceOnce(source, 'bot.start({', 'const polling = bot.start({');
}

/** Explicit patches for the pinned public-domain text/visual terminal sources. */
export function migrateTerminalSource(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 128 * 1024) {
    throw new RangeError('Terminal migration requires a bounded source file');
  }
  source = replaceOnce(
    source,
    'import { Bot, InlineKeyboard } from "grammy";',
    'import { Bot } from "anygram";'
  );
  const begin = source.indexOf(
    '// Handle all text messages as terminal commands'
  );
  const end = source.indexOf('// Handle stop command', begin);
  if (begin < 0 || end <= begin) {
    throw new Error('Terminal text-handler boundaries changed');
  }
  const textHandler = source.slice(begin, end);
  source = source.slice(0, begin) + source.slice(end);
  source = replaceOnce(
    source,
    '// Error handling',
    `${textHandler}\n// Error handling`
  );
  source = replaceOnce(
    source,
    'text: "/start"',
    'text: "/start",\n        entities: [{ type: "bot_command", offset: 0, length: 6 }]'
  );
  source = retireSessions(source);
  if (source.includes('output += data;')) {
    source = cancelAnimation(source);
    source = replaceOnce(
      source,
      'output += data;',
      `output = (output + data).slice(-262144);
      userSessions.get(userId).output = output;`
    );
  }
  return gracefulShutdown(source);
}
