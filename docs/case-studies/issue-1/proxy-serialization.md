# Method proxy serialization

`JSON.stringify({ api: client.raw })` looked up `api.toJSON`. The generic method
proxy manufactured that method, causing JSON serialization to dispatch a request.
The proxy returned a promise, which JSON represented as an empty object, hiding
the unexpected work. Rejected requests could also become unhandled rejections.

Two focused regressions reproduce this without network connections or Telegram
credentials. Both fail before the change in
`ci-logs/method-proxy-json-before.log`. The first checks root and nested proxies;
the second retains explicit RPC invocation and promise assimilation. The proxy
now suppresses the reserved `toJSON` hook alongside its existing `then` and symbol
guards. Direct `invoke` and `callBotApi` remain available for explicit method
names.

Run `node --test tests/method-proxy-json.test.js`. JSON serialization now omits
method-proxy functions and causes no synthetic RPC. This is a shared boundary
fix for raw account and bot method namespaces, advancing R08/R16/R19; it does not
establish complete ecosystem compatibility or close the remaining requirements.
