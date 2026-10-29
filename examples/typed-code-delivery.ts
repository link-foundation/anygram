import type {
  LoginChallenge,
  LoginOptions,
  LoginCodeDeliveryAction,
} from '../src/index.js';
import type { Mtproto } from '../src/mtproto.js';

/** The application UI honors challenge.timeout before offering the next method. */
export async function loginWithDeliveryChoice(
  client: Mtproto,
  ask: (label: string) => Promise<string>,
  choose: (
    challenge: LoginChallenge
  ) => Promise<LoginCodeDeliveryAction | void>,
  signal?: AbortSignal
) {
  const options: LoginOptions = {
    phoneNumber: () => ask('Phone number'),
    onCode: choose,
    phoneCode: () => ask('Telegram verification code'),
    email: () => ask('Login email address'),
    emailCode: () => ask('Email verification code'),
    password: () => ask('Two-step verification password'),
    signal,
    maxLoginSteps: 10,
  };
  return client.start(options);
}
