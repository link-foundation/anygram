import { passwordProof } from './password.js';
import { TelegramError } from './errors.js';
const input = async (value, name, context) => {
  const result =
    typeof value === 'function'
      ? await value(globalThis.structuredClone(context))
      : value;
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
    if (result?.user?.id === undefined) {
      throw new TelegramError('Invalid login authorization response');
    }
    await this.client.onSession?.(this.client.saveSession());
    return result.user;
  }
  async phoneLogin(options) {
    const maxLoginSteps = loginStepLimit(options);
    const phoneNumber = await input(options.phoneNumber, 'phoneNumber');
    let code = await this.sendCode(phoneNumber, options.codeSettings, options);
    for (let step = 0; step <= maxLoginSteps; step++) {
      if (code._ === 'auth.sentCodeSuccess') {
        return code.authorization;
      }
      if (step === maxLoginSteps) {
        break;
      }
      if (code._ !== 'auth.sentCode') {
        throw new TelegramError('Telegram requires an additional login step', {
          type: code._,
        });
      }
      if (typeof code.phone_code_hash !== 'string' || !code.phone_code_hash) {
        throw new TelegramError('Invalid login code hash');
      }
      const next = await this.codeDelivery(phoneNumber, code, options);
      if (next !== undefined) {
        code = next;
        continue;
      }
      if (code.type?._ === 'auth.sentCodeTypeSetUpEmailRequired') {
        code = await this.setupEmail(phoneNumber, code, options);
        continue;
      }
      const credentials =
        code.type?._ === 'auth.sentCodeTypeEmailCode'
          ? { emailVerification: await this.emailVerification(code, options) }
          : { phoneCode: await input(options.phoneCode, 'phoneCode', code) };
      const result = await this.signIn(
        {
          phoneNumber,
          phoneCodeHash: code.phone_code_hash,
          ...credentials,
        },
        options
      );
      return this.finishPhoneLogin(
        result,
        phoneNumber,
        code.phone_code_hash,
        options
      );
    }
    throw new TelegramError('Login challenge step limit exceeded', {
      type: 'LOGIN_STEP_LIMIT',
    });
  }

  async codeDelivery(phoneNumber, code, options) {
    const decision = deliveryAction(
      await options.onCode?.(globalThis.structuredClone(code))
    );
    options.signal?.throwIfAborted();
    if (decision === undefined) {
      return undefined;
    }
    const params = {
      phone_number: phoneNumber,
      phone_code_hash: code.phone_code_hash,
    };
    if (decision.action === 'cancel') {
      const result = await this.call('auth.cancelCode', params, options);
      if (typeof result !== 'boolean') {
        throw new TelegramError('Invalid login cancellation response');
      }
      throw new TelegramError('Login cancelled', { type: 'LOGIN_CANCELLED' });
    }
    if (
      typeof code.next_type?._ !== 'string' ||
      !code.next_type._.startsWith('auth.codeType')
    ) {
      throw new TelegramError(
        'Telegram did not advertise another code delivery method',
        {
          type: 'LOGIN_CODE_RESEND_UNAVAILABLE',
        }
      );
    }
    const result = await this.call(
      'auth.resendCode',
      {
        ...params,
        ...(decision.reason === undefined ? {} : { reason: decision.reason }),
      },
      options
    );
    if (!result || typeof result._ !== 'string') {
      throw new TelegramError('Invalid login resend response');
    }
    return result;
  }

  async emailVerification(challenge, options) {
    let proof = options.emailVerification;
    if (proof === undefined) {
      proof = {
        _: 'emailVerificationCode',
        code: await input(
          options.emailCode ?? options.phoneCode,
          'emailCode',
          challenge
        ),
      };
    } else if (typeof proof === 'function') {
      proof = await proof(globalThis.structuredClone(challenge));
    }
    return validateEmailProof(proof, challenge.type ?? challenge);
  }

  async setupEmail(phoneNumber, code, options) {
    const purpose = {
      _: 'emailVerifyPurposeLoginSetup',
      phone_number: phoneNumber,
      phone_code_hash: code.phone_code_hash,
    };
    let challenge = code;
    if (options.emailVerification === undefined) {
      challenge = await this.call(
        'account.sendVerifyEmailCode',
        {
          purpose,
          email: await input(options.email, 'email', code),
        },
        options
      );
      if (challenge._ !== 'account.sentEmailCode') {
        throw new TelegramError('Invalid email verification response');
      }
    }
    const result = await this.call(
      'account.verifyEmail',
      {
        purpose,
        verification: await this.emailVerification(challenge, options),
      },
      options
    );
    if (result._ !== 'account.emailVerifiedLogin' || !result.sent_code) {
      throw new TelegramError('Invalid email verification response');
    }
    return result.sent_code;
  }

  async finishPhoneLogin(result, phoneNumber, phoneCodeHash, options) {
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
        phone_code_hash: phoneCodeHash,
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

function loginStepLimit({ maxLoginSteps = 10, onCode }) {
  if (
    !Number.isSafeInteger(maxLoginSteps) ||
    maxLoginSteps < 1 ||
    maxLoginSteps > 1000
  ) {
    throw new RangeError('Invalid login challenge step limit');
  }
  if (onCode !== undefined && typeof onCode !== 'function') {
    throw new TypeError('onCode must be a function');
  }
  return maxLoginSteps;
}

function deliveryAction(value) {
  if (value === undefined) {
    return undefined;
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !['resend', 'cancel'].includes(value.action) ||
    Object.keys(value).some((key) => !['action', 'reason'].includes(key)) ||
    (value.reason !== undefined &&
      (value.action !== 'resend' || typeof value.reason !== 'string'))
  ) {
    throw new TypeError('Invalid login code delivery action');
  }
  return { action: value.action, reason: value.reason };
}

function validateEmailProof(proof, type) {
  const field = {
    emailVerificationCode: 'code',
    emailVerificationGoogle: 'token',
    emailVerificationApple: 'token',
  }[proof?._];
  if (!field || typeof proof[field] !== 'string' || !proof[field]) {
    throw new TypeError('Invalid email verification proof');
  }
  if (field === 'token') {
    const provider = proof._ === 'emailVerificationGoogle' ? 'google' : 'apple';
    if (!type[`${provider}_signin_allowed`]) {
      throw new TypeError(`Email verification with ${provider} is not allowed`);
    }
  }
  return { _: proof._, [field]: proof[field] };
}
