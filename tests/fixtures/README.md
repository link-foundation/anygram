# Local transport fixtures

`localhost-cert.pem` and `localhost-key.pem` are a public, self-signed test pair
for loopback TLS servers, valid for `localhost` and `127.0.0.1`. The test key is
deliberately committed and must never be used outside tests. No production
credentials, account sessions or authorization keys are stored here.

The independent `websocket` development dependency checks RFC 6455 interoperability.
SOCKS fixture destinations always map to a specified loopback port.
