import { join } from 'node:path';
import pino from 'pino';

export function terminalLogger(root, opened = () => {}) {
  return Object.assign((...args) => pino(...args), pino, {
    destination(options) {
      const stream = pino.destination({
        ...options,
        dest: join(root, options.dest),
      });
      opened(stream);
      return stream;
    },
  });
}
