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
  call(method, params, options = {}) {
    options.signal?.throwIfAborted();
    return this.client.call(method, params, {
      signal: options.signal,
      timeout: options.timeout,
      dc: options.dc,
      migrate: options.migrate,
    });
  }
  sendCode(phoneNumber, settings = { _: 'codeSettings' }, options) {
    return this.call(
      'auth.sendCode',
      {
        phone_number: phoneNumber,
        api_id: this.client.apiId,
        api_hash: this.client.apiHash,
        settings,
      },
      options
    );
  }
  signIn(
    { phoneNumber, phoneCodeHash, phoneCode, emailVerification },
    options
  ) {
    return this.call(
      'auth.signIn',
      {
        phone_number: phoneNumber,
        phone_code_hash: phoneCodeHash,
        phone_code: phoneCode,
        email_verification: emailVerification,
      },
      options
    );
  }
  async checkPassword(password, options) {
    const parameters = await this.call('account.getPassword', {}, options);
    return this.call(
      'auth.checkPassword',
      {
        password: await passwordProof(parameters, password),
      },
      options
    );
  }
  async start(options = {}) {
    if (!Number.isInteger(this.client.apiId) || !this.client.apiHash) {
      throw new TypeError(
        'Application apiId and apiHash are required for MTProto login'
      );
    }
    try {
      return (
        await this.call(
          'users.getUsers',
          {
            id: [{ _: 'inputUserSelf' }],
          },
          options
        )
      )[0];
    } catch (error) {
      if (error.code !== 401) {
        throw error;
      }
    }
    let result;
    if (options.botAuthToken) {
      result = await this.call(
        'auth.importBotAuthorization',
        {
          flags: 0,
          api_id: this.client.apiId,
          api_hash: this.client.apiHash,
          bot_auth_token: await input(options.botAuthToken, 'botAuthToken'),
        },
        options
      );
    } else {
      try {
        result =
          options.qrCode === undefined
            ? await this.phoneLogin(options)
            : await this.qrLogin(options);
      } catch (error) {
        if (
          error.type !== 'SESSION_PASSWORD_NEEDED' &&
          error.message !== 'SESSION_PASSWORD_NEEDED'
        ) {
          throw error;
        }
        result = await this.checkPassword(
          await input(options.password, 'password'),
          options
        );
      }
    }
    await this.client.onSession?.(this.client.saveSession());
    return result.user;
  }
  async phoneLogin(options) {
    const phoneNumber = await input(options.phoneNumber, 'phoneNumber');
    const code = await this.sendCode(
      phoneNumber,
      options.codeSettings,
      options
    );
    if (code._ === 'auth.sentCodeSuccess') {
      return code.authorization;
    }
    if (code._ !== 'auth.sentCode') {
      throw new TelegramError('Telegram requires an additional login step', {
        type: code._,
      });
    }
    const result = await this.signIn(
      {
        phoneNumber,
        phoneCodeHash: code.phone_code_hash,
        phoneCode: await input(options.phoneCode, 'phoneCode'),
      },
      options
    );
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
    return this.call(
      'auth.signUp',
      {
        phone_number: phoneNumber,
        phone_code_hash: code.phone_code_hash,
        first_name: await input(options.firstName, 'firstName'),
        last_name: options.lastName ?? '',
      },
      options
    );
  }

  async qrToken(options) {
    let result = await this.call(
      'auth.exportLoginToken',
      {
        api_id: this.client.apiId,
        api_hash: this.client.apiHash,
        except_ids: options.exceptIds ?? [],
      },
      options
    );
    const visited = new Set();
    while (result._ === 'auth.loginTokenMigrateTo') {
      if (visited.has(result.dc_id) || visited.size >= 5) {
        throw new TelegramError('QR login data center migration cycle');
      }
      visited.add(result.dc_id);
      result = await this.call(
        'auth.importLoginToken',
        { token: result.token },
        {
          ...options,
          dc: result.dc_id,
          migrate: true,
        }
      );
    }
    return result;
  }

  async qrLogin(options) {
    const { maxQrAttempts = 100, qrTimeout = 300000 } = options;
    if (
      typeof options.qrCode !== 'function' ||
      !Number.isSafeInteger(maxQrAttempts) ||
      maxQrAttempts < 1 ||
      !Number.isSafeInteger(qrTimeout) ||
      qrTimeout < 1
    ) {
      throw new TypeError('Invalid QR login callback or limits');
    }
    const deadline = globalThis.AbortSignal.timeout(qrTimeout);
    options = {
      ...options,
      signal: options.signal
        ? globalThis.AbortSignal.any([options.signal, deadline])
        : deadline,
    };
    let displayed;
    for (let attempt = 0; attempt < maxQrAttempts; attempt++) {
      const result = await this.qrToken(options);
      if (result._ === 'auth.loginTokenSuccess') {
        return result.authorization;
      }
      if (result._ !== 'auth.loginToken') {
        throw new TelegramError('Invalid QR login token response');
      }
      const url = `tg://login?token=${Buffer.from(result.token).toString('base64url')}`;
      if (url !== displayed) {
        await options.qrCode({
          token: result.token,
          expires: result.expires,
          url,
        });
        displayed = url;
      }
      await this.client.pollUpdates({
        signal: options.signal,
        maxWait: Math.max(
          0,
          Math.min(25000, result.expires * 1000 - Date.now())
        ),
      });
    }
    throw new TelegramError('QR login attempt limit exceeded');
  }
}
