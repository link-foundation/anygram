import { it } from 'test-anywhere';
import { verifyArchiveCheckout } from '../experiments/archive-checkout.mjs';

it('preserves captured schema bytes under Windows-style Git checkout conversion', () => {
  verifyArchiveCheckout();
});
