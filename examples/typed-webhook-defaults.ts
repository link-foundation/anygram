import { Bot, webhookCallback } from '../src/index.js';

declare const bot: Bot;
const request = { body: { update_id: 1 }, header: () => undefined };
const response = {
  end() {},
  set() {
    return this;
  },
  send(_body: string) {},
  status(_code: number) {
    return this;
  },
};
// Owned precision extension: accept defaults supported by the SDK runtime.
void webhookCallback(bot, undefined, { secretToken: 'secret' })(
  request,
  response
);
void webhookCallback(
  bot,
  undefined,
  'return',
  1000,
  'secret'
)(request, response);
