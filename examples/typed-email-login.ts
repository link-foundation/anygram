import type { LoginOptions } from '../src/index.js';
import type { Mtproto } from '../src/mtproto.js';

/** Supply a private application prompt; this helper never prints codes or sessions. */
export async function emailAwareLogin(
  client: Mtproto,
  ask: (label: string) => Promise<string>
): Promise<unknown> {
  const options: LoginOptions = {
    phoneNumber: () => ask('Phone number'),
    phoneCode: (challenge) =>
      ask(`Code for ${challenge.type?._ ?? 'Telegram'}`),
    email: () => ask('Login email address'),
    emailCode: () => ask('Email verification code'),
    password: () => ask('Two-step verification password'),
    maxLoginSteps: 10,
  };
  return client.start(options);
}
