import { telegrafWebhookScenario } from '../tests/fixtures/telegraf-webhook.js';
for (const form of ['object', 'string', 'buffer', 'stream']) {
  for (const reply of [false, true]) {
    console.log(
      JSON.stringify({
        form,
        reply,
        result: await telegrafWebhookScenario(true, { form, reply }),
      })
    );
  }
}
for (const replyFlag of [false, true]) {
  console.log(
    JSON.stringify({
      replyFlag,
      result: await telegrafWebhookScenario(true, { replyFlag }),
    })
  );
}
