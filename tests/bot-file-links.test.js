import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Telegram as ReferenceTelegram } from 'telegraf';
import {
  BotApi,
  createClient,
  createAdapter,
  UnsupportedError,
  Context,
  Bot,
} from '../src/index.js';

const token = 'file-links:fixture';

it('retains file-link configuration in a directly constructed context', async () => {
  const api = new BotApi({
    token,
    baseUrl: 'https://files.example.invalid/prefix',
  });
  api.callApi = () => assert.fail('Metadata-only context link invoked an RPC');
  for (const contextApi of [api, new Bot(token, { api }).api]) {
    const context = new Context({}, contextApi, { id: 1 });
    assert.equal(
      String(
        await context.telegram.getFileLink({ file_path: 'docs/file.pdf' })
      ),
      `https://files.example.invalid/prefix/file/bot${token}/docs/file.pdf`
    );
  }
});

for (const options of [
  { apiRoot: 'https://files.example.invalid' },
  { apiRoot: 'https://files.example.invalid/prefix' },
  {
    apiRoot: 'https://files.example.invalid/prefix/',
    apiMode: 'user',
    testEnv: true,
  },
  { apiRoot: 'http://localhost:8081', testEnv: true },
]) {
  it(`retains actual Telegraf file URL options ${JSON.stringify(options)}`, async () => {
    const client = await createClient({
      token,
      native: false,
      libraries: ['telegraf'],
      clientOptions: { telegram: options },
    });
    const reference = new ReferenceTelegram(token, options);
    for (const file of [
      { file_path: 'docs/example.pdf' },
      { file_path: '/tmp/local file.pdf' },
    ]) {
      assert.equal(
        String(await client.getFileLink(file)),
        String(await reference.getFileLink(file))
      );
    }
  });
}

it('keeps native server path prefixes and explicit file roots', async () => {
  const native = new BotApi({
    token,
    baseUrl: 'https://files.example.invalid/prefix',
  });
  assert.equal(
    String(await native.getFileLink({ file_path: 'docs/example.pdf' })),
    `https://files.example.invalid/prefix/file/bot${token}/docs/example.pdf`
  );
  const client = await createClient({
    token,
    native: false,
    libraries: ['grammy'],
    clientOptions: { client: { environment: 'test' } },
  });
  assert.equal(
    String(await client.getFileLink({ file_path: 'docs/example.pdf' })),
    `https://api.telegram.org/file/bot${token}/test/docs/example.pdf`
  );
});

it('requires an explicit file root for custom grammY URL builders', async () => {
  const config = {
    token,
    native: false,
    libraries: ['grammy'],
    clientOptions: {
      client: {
        buildUrl: () => assert.fail('Metadata-only link contacted a transport'),
      },
    },
  };
  const unconfigured = await createClient(config);
  await assert.rejects(
    unconfigured.getFileLink({ file_path: 'docs/example.pdf' }),
    (error) =>
      error instanceof UnsupportedError ||
      error.cause instanceof UnsupportedError
  );
  const configured = await createClient({
    ...config,
    fileOptions: { apiRoot: 'https://files.example.invalid/custom' },
  });
  assert.equal(
    String(await configured.getFileLink({ file_path: 'docs/example.pdf' })),
    `https://files.example.invalid/custom/file/bot${token}/docs/example.pdf`
  );
});

it('supports explicit file metadata on initialized bot adapters without exposing its token', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('injected metadata cancelled');
  controller.abort(reason);
  const reference = new ReferenceTelegram('initialized-sdk:fixture');
  reference.callApi = () => assert.fail('Cached metadata invoked an SDK RPC');
  for (const backend of [
    { callApi: () => assert.fail('Cached file contacted the adapter') },
    reference,
  ]) {
    const adapter = createAdapter('injected', backend, {
      kind: 'bot',
      fileOptions: { token, apiRoot: 'https://files.example.invalid' },
    });
    const client = await createClient({
      native: false,
      adapters: [adapter],
      backend: 'injected',
    });
    assert.equal(
      String(await client.getFileLink({ file_path: 'docs/example.pdf' })),
      `https://files.example.invalid/file/bot${token}/docs/example.pdf`
    );
    assert.equal(JSON.stringify(client).includes(token), false);
    assert.equal(JSON.stringify(new BotApi({ token })).includes(token), false);
    await assert.rejects(
      client.getFileLink({ file_path: 'docs/example.pdf' }, controller.signal),
      (error) => error === reason || error.cause === reason
    );
  }
});
