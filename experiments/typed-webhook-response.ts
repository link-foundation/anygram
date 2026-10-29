import type { ServerResponse } from 'node:http';
import { Telegraf } from '../src/index.js';

declare const response: ServerResponse;
// The public structural response accepts actual current Node response types.
void new Telegraf('123:example').handleUpdate({ update_id: 1 }, response);
