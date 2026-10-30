/** Owned application helpers serialized into the self-contained migration patch. */
function installTerminalControls({ bot, userSessions, logger, capture }) {
  const pending = new Set();
  const selected = (ctx) => {
    const session = userSessions.get(ctx.from?.id);
    return session?.chatId === ctx.chat?.id ? session : undefined;
  };
  const warn = (error) =>
    logger.warn({ error: error.message }, 'Terminal control failed');
  const screenshot = (ctx, session) => {
    if (selected(ctx) !== session) {
      return;
    }
    if (session.screenshotTask) {
      return session.screenshotTask;
    }
    const controller = new globalThis.AbortController();
    session.screenshotController = controller;
    const task = Promise.resolve()
      .then(() => capture(ctx, session, controller.signal))
      .catch(async (error) => {
        if (!controller.signal.aborted) {
          warn(error);
          await ctx
            .reply(
              '❌ Failed to capture terminal screenshot. Try /controls again.'
            )
            .catch(warn);
        }
      })
      .finally(() => {
        pending.delete(task);
        delete session.screenshotTask;
        delete session.screenshotController;
      });
    session.screenshotTask = task;
    pending.add(task);
    return task;
  };
  bot.command('controls', (ctx) => {
    const session = selected(ctx);
    if (!session) {
      return ctx.reply('❌ No active terminal session. Use /start to begin.');
    }
    const button = (text, action) => ({
      text,
      callback_data: `terminal:${session.controlKey}:${action}`,
    });
    return ctx.reply('Terminal controls', {
      reply_markup: {
        inline_keyboard: [
          [
            button('Ctrl+C', 'interrupt'),
            button('Ctrl+D', 'eof'),
            button('Ctrl+Z', 'suspend'),
          ],
          [
            button(capture ? 'Screenshot' : 'Refresh', 'refresh'),
            button('Stop', 'stop'),
          ],
        ],
      },
    });
  });
  bot.callbackQuery(/^terminal:/, async (ctx) => {
    const session = selected(ctx);
    const match = /^terminal:(\d+):(interrupt|eof|suspend|refresh|stop)$/.exec(
      ctx.callbackQuery.data
    );
    if (!session || !match || match[1] !== session.controlKey) {
      return ctx.answerCallbackQuery({
        text: 'Terminal controls have expired. Use /controls.',
        show_alert: true,
      });
    }
    await ctx.answerCallbackQuery();
    if (selected(ctx) !== session) {
      return;
    }
    const action = match[2];
    const bytes = { interrupt: '\x03', eof: '\x04', suspend: '\x1a' };
    if (Object.hasOwn(bytes, action)) {
      session.terminal.write(bytes[action]);
    } else if (action === 'refresh') {
      if (capture) {
        await screenshot(ctx, session);
      } else {
        await session.updateTerminalMessage();
      }
    } else {
      session.cleanup();
      session.terminal.kill();
      userSessions.delete(ctx.from.id);
      await session.screenshotTask?.catch(() => {});
      try {
        await ctx.editMessageReplyMarkup({
          reply_markup: { inline_keyboard: [] },
        });
      } catch (error) {
        warn(error);
      }
    }
  });
  return { screenshot, drain: () => Promise.allSettled(pending) };
}

function captureTerminalPng(
  ctx,
  session,
  signal,
  { createCanvas, formatTerminalOutput, InputFile, fontSize, lineHeight }
) {
  signal.throwIfAborted();
  const { cols, rows } = session;
  if (
    !Number.isInteger(cols) ||
    !Number.isInteger(rows) ||
    cols < 1 ||
    rows < 1 ||
    cols > 80 ||
    rows > 80
  ) {
    throw new RangeError(
      'Terminal screenshot dimensions exceed the bounded presets'
    );
  }
  const width = Math.floor(cols * fontSize * 0.6);
  const height = Math.floor(rows * lineHeight);
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#000000';
  context.fillRect(0, 0, width, height);
  context.fillStyle = '#FFFFFF';
  context.font = `${fontSize}px monospace`;
  const lines = formatTerminalOutput(session.output, cols, rows).split('\n');
  for (let index = 0; index < Math.min(lines.length, rows); index++) {
    context.fillText(lines[index].slice(0, cols), 0, (index + 1) * lineHeight);
  }
  const png = canvas.toBuffer('image/png');
  if (png.byteLength > 4 * 1024 * 1024) {
    throw new RangeError('Terminal screenshot exceeds the upload budget');
  }
  return ctx.replyWithPhoto(
    new InputFile(png, 'terminal.png'),
    {
      caption: 'Terminal screenshot',
    },
    signal
  );
}

export function terminalControlSource(visual) {
  const capture = visual
    ? `(ctx, session, signal) => (${captureTerminalPng.toString()})(ctx, session, signal, { createCanvas, formatTerminalOutput, InputFile, fontSize: FONT_SIZE, lineHeight: LINE_HEIGHT })`
    : 'undefined';
  return `const terminalControls = (${installTerminalControls.toString()})({ bot, userSessions, logger, capture: ${capture} });\n`;
}
