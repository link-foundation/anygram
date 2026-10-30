import { createSecureContext } from 'node:tls';
import { createPrivateKey, X509Certificate } from 'node:crypto';
for (const [name, check] of [
  [
    'secure context',
    () => createSecureContext({ key: 'invalid', cert: 'invalid' }),
  ],
  ['private key', () => createPrivateKey('invalid')],
  ['certificate', () => new X509Certificate('invalid')],
]) {
  try {
    check();
    console.log(name, 'accepted');
  } catch (error) {
    console.log(name, 'rejected', error.name, error.message);
  }
}
