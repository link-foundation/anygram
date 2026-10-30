import { terminalControlSource } from './terminal-controls.js';

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
        this.screenshotController?.abort();
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

function logDestination(source) {
  source = replaceOnce(
    source,
    'import { createWriteStream } from "fs";',
    'import { mkdirSync } from "fs";'
  );
  source = replaceOnce(
    source,
    "createWriteStream('./logs/bot.log', { flags: 'a' })",
    'logStream'
  );
  return replaceOnce(
    source,
    '// Setup logger with file and console output',
    `mkdirSync('./logs', { recursive: true });
const logStream = pino.destination({ dest: './logs/bot.log', sync: true });

// Setup logger with file and console output`
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
    const controlsDrained = terminalControls.drain();
    userSessions.clear();
    await controlsDrained;
    await polling;
    await bot.queue;
    logger.info('All terminal sessions and polling closed');
    await new Promise((resolve, reject) => {
      logStream.once('error', reject);
      logStream.once('finish', resolve);
      logStream.end();
    });
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

function interactiveControls(source, visual) {
  source = replaceOnce(
    source,
    '// Start command handler',
    `${terminalControlSource(visual)}\n// Start command handler`
  );
  source = replaceOnce(
    source,
    '      terminal,',
    '      terminal,\n      chatId: ctx.chat.id,\n      controlKey: String(ctx.update.update_id),'
  );
  source = replaceOnce(
    source,
    'if (!isAuthorized(ctx.from)) {',
    'if (!ctx.from || !isAuthorized(ctx.from)) {\n    if (ctx.callbackQuery) { return ctx.answerCallbackQuery({ text: "You are not authorized to use this bot.", show_alert: true }); }'
  );
  source = replaceOnce(
    source,
    '**Commands:**',
    '**Commands:**\n• /controls - Open terminal keyboard controls'
  );
  source = replaceOnce(
    source,
    'session.terminal.kill();\n      userSessions.delete(userId);',
    'session.terminal.kill();\n      await session.screenshotTask;\n      userSessions.delete(userId);'
  );
  if (visual) {
    source = replaceOnce(
      source,
      'async function updateTerminalMessage() {',
      `async function updateTerminalMessage() {
      const session = userSessions.get(userId);
      if (session?.terminal === terminal && session.pendingScreenshot) {
        session.pendingScreenshot = false;
        await terminalControls.screenshot(ctx, session);
      }`
    );
    source = replaceOnce(
      source,
      "logger.info({ userId, command }, 'Executing regular terminal command');",
      "logger.info({ userId, command }, 'Executing regular terminal command');\n      session.pendingScreenshot = true;"
    );
  }
  return source;
}

/** Explicit patches for the pinned public-domain text/visual terminal sources. */
export function migrateTerminalSource(source) {
  if (typeof source !== 'string' || Buffer.byteLength(source) > 128 * 1024) {
    throw new RangeError('Terminal migration requires a bounded source file');
  }
  source = replaceOnce(
    source,
    'import { Bot, InlineKeyboard } from "grammy";',
    'import { Bot, InputFile } from "anygram";'
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
  source = logDestination(retireSessions(source));
  if (source.includes('output += data;')) {
    source = cancelAnimation(source);
    source = replaceOnce(
      source,
      'output += data;',
      `output = (output + data).slice(-262144);
      userSessions.get(userId).output = output;`
    );
  }
  return gracefulShutdown(
    interactiveControls(
      source,
      source.includes('output += data;') ||
        source.includes('userSessions.get(userId).output = output;')
    )
  );
}
