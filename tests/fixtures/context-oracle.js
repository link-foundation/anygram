import { Api as GrammyApi } from 'grammy';
import { Telegram } from 'telegraf';

export const plainPayload = (value) => JSON.parse(JSON.stringify(value));

export function recordingBot(Constructor) {
  const calls = [];
  const bot = new Constructor('context:fixture', {
    api: {
      callApi(method, params, options) {
        calls.push({
          method,
          params: plainPayload(params),
          signal: options?.signal,
          timeout: options?.timeout,
        });
        return Promise.resolve(true);
      },
    },
  });
  return { bot, calls };
}

export function contextOracle(style) {
  const calls = [];
  const api =
    style === 'grammY'
      ? new GrammyApi('oracle:fixture')
      : new Telegram('oracle:fixture');
  const record = (method, params, signal) => {
    calls.push({
      method,
      params: plainPayload(params),
      signal,
      timeout: undefined,
    });
    return Promise.resolve(true);
  };
  if (style === 'grammY') {
    api.config.use(async (next, method, params, signal) => ({
      ok: true,
      result: await record(method, params, signal),
    }));
  } else {
    api.callApi = record;
  }
  return { api, calls };
}
