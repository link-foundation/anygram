import { passwordProof } from './password.js';
import { TelegramError } from './errors.js';
const input = async (value, name) => {
  const result = typeof value === 'function' ? await value() : value;
  if (typeof result !== 'string' || !result) {
    throw new TypeError(`${name} is required`);
  }
  return result;
};

export class Authentication {
  constructor(client) {
    this.client = client;
  }
  sendCode(phoneNumber, settings = { _: 'codeSettings' }) {
    return this.client.call('auth.sendCode', {
      phone_number: phoneNumber,
      api_id: this.client.apiId,
      api_hash: this.client.apiHash,
      settings,
    });
  }
  signIn({ phoneNumber, phoneCodeHash, phoneCode, emailVerification }) {
    return this.client.call('auth.signIn', {
      phone_number: phoneNumber,
      phone_code_hash: phoneCodeHash,
      phone_code: phoneCode,
      email_verification: emailVerification,
    });
  }
  async checkPassword(password) {
    const parameters = await this.client.call('account.getPassword');
    return this.client.call('auth.checkPassword', {
      password: await passwordProof(parameters, password),
    });
  }
  async start(options = {}) {
    if (!Number.isInteger(this.client.apiId) || !this.client.apiHash) {
      throw new TypeError(
        'Application apiId and apiHash are required for MTProto login'
      );
    }
    try {
      return (
        await this.client.call('users.getUsers', {
          id: [{ _: 'inputUserSelf' }],
        })
      )[0];
    } catch (error) {
      if (error.code !== 401) {
        throw error;
      }
    }
    let result;
    if (options.botAuthToken) {
      result = await this.client.call('auth.importBotAuthorization', {
        flags: 0,
        api_id: this.client.apiId,
        api_hash: this.client.apiHash,
        bot_auth_token: await input(options.botAuthToken, 'botAuthToken'),
      });
    } else {
      try {
        result = await this.phoneLogin(options);
      } catch (error) {
        if (
          error.type !== 'SESSION_PASSWORD_NEEDED' &&
          error.message !== 'SESSION_PASSWORD_NEEDED'
        ) {
          throw error;
        }
        result = await this.checkPassword(
          await input(options.password, 'password')
        );
      }
    }
    await this.client.onSession?.(this.client.saveSession());
    return result.user;
  }
  async phoneLogin(options) {
    const phoneNumber = await input(options.phoneNumber, 'phoneNumber');
    const code = await this.sendCode(phoneNumber, options.codeSettings);
    if (code._ === 'auth.sentCodeSuccess') {
      return code.authorization;
    }
    if (code._ !== 'auth.sentCode') {
      throw new TelegramError('Telegram requires an additional login step', {
        type: code._,
      });
    }
    const result = await this.signIn({
      phoneNumber,
      phoneCodeHash: code.phone_code_hash,
      phoneCode: await input(options.phoneCode, 'phoneCode'),
    });
    if (result._ !== 'auth.authorizationSignUpRequired') {
      return result;
    }
    if (
      result.terms_of_service &&
      !(await options.acceptTerms?.(result.terms_of_service))
    ) {
      throw new TelegramError(
        'Account creation requires acceptance of Telegram terms',
        { type: 'TERMS_ACCEPTANCE_REQUIRED' }
      );
    }
    return this.client.call('auth.signUp', {
      phone_number: phoneNumber,
      phone_code_hash: code.phone_code_hash,
      first_name: await input(options.firstName, 'firstName'),
      last_name: options.lastName ?? '',
    });
  }
}
