import type { IncomingMessage, ServerResponse } from 'node:http';
import { Bot, Telegraf, webhookCallback } from '../src/index.js';

declare const response: ServerResponse;
// The public structural response accepts actual current Node response types.
void new Telegraf('123:example').handleUpdate({ update_id: 1 }, response);
declare const request: IncomingMessage;
void webhookCallback(new Bot('123:example'), 'http')(request, response);
