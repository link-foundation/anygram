import { TelegrafComposer as Composer } from './telegraf-composer.js';
import { compose } from './bot-context.js';

const noop = async () => {};
const copy = (value) => globalThis.structuredClone(value ?? {});

function validateTtl(ttl) {
  if (ttl !== undefined && (typeof ttl !== 'number' || !(ttl >= 0))) {
    throw new RangeError('Scene TTL must be nonnegative seconds');
  }
}

export class BaseScene extends Composer {
  constructor(id, options = {}) {
    super(...(options.handlers ?? []));
    if (typeof id !== 'string' || !id) {
      throw new TypeError('Scene id must be a nonempty string');
    }
    validateTtl(options.ttl);
    this.id = id;
    this.ttl = options.ttl;
    this.enterHandlers = [...(options.enterHandlers ?? [])];
    this.leaveHandlers = [...(options.leaveHandlers ?? [])];
  }
  enter(...middleware) {
    this.enterHandlers.push(...middleware);
    return this;
  }
  leave(...middleware) {
    this.leaveHandlers.push(...middleware);
    return this;
  }
  enterMiddleware() {
    return compose(this.enterHandlers);
  }
  leaveMiddleware() {
    return compose(this.leaveHandlers);
  }
}

export class SceneContextScene {
  constructor(ctx, scenes, options = {}) {
    this.ctx = ctx;
    this.scenes = scenes;
    this.options = options;
    this.transitions = 0;
    this.leaving = false;
    this.maxTransitions = options.maxTransitions ?? 32;
    if (!Number.isSafeInteger(this.maxTransitions) || this.maxTransitions < 1) {
      throw new RangeError('Invalid scene transition limit');
    }
    validateTtl(options.ttl);
  }
  get session() {
    let value = this.ctx.session?.__scenes ?? copy(this.options.defaultSession);
    if (
      value.expires !== undefined &&
      value.expires < Math.floor(Date.now() / 1000)
    ) {
      value = copy(this.options.defaultSession);
    }
    this.ctx.session ??= {};
    this.ctx.session.__scenes = value;
    return value;
  }
  get state() {
    return (this.session.state ??= {});
  }
  set state(value) {
    this.session.state = { ...value };
  }
  get current() {
    return this.scenes.get(this.session.current ?? this.options.default);
  }
  reset() {
    if (this.ctx.session !== undefined) {
      this.ctx.session.__scenes = copy(this.options.defaultSession);
    }
  }
  async enter(id, state = {}, silent = false) {
    const scene = this.scenes.get(id);
    if (!scene) {
      throw new Error(`Unknown scene: ${id}`);
    }
    if (++this.transitions > this.maxTransitions) {
      throw new Error('Scene transition limit exceeded');
    }
    if (!silent) {
      await this.leave();
    }
    this.session.current = id;
    this.state = state;
    const ttl = scene.ttl ?? this.options.ttl;
    if (ttl !== undefined) {
      this.session.expires = Math.floor(Date.now() / 1000) + ttl;
    }
    if (!silent) {
      const handler = scene.enterMiddleware?.() ?? scene.middleware();
      return await handler(this.ctx, noop);
    }
  }
  reenter() {
    return this.session.current === undefined
      ? undefined
      : this.enter(this.session.current, this.state);
  }
  async leave() {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    try {
      const scene = this.current;
      if (scene) {
        await (scene.leaveMiddleware?.() ?? noop)(this.ctx, noop);
        this.reset();
      }
    } finally {
      this.leaving = false;
    }
  }
}

export class Stage extends Composer {
  constructor(scenes = [], options = {}) {
    super();
    this.scenes = new Map();
    this.options = options;
    this.register(...scenes);
  }
  register(...scenes) {
    for (const scene of scenes) {
      if (
        typeof scene?.id !== 'string' ||
        typeof scene.middleware !== 'function'
      ) {
        throw new TypeError('Unsupported scene');
      }
      this.scenes.set(scene.id, scene);
    }
    return this;
  }
  middleware() {
    const run = super.middleware();
    return (ctx, next) => {
      if (!('session' in ctx)) {
        return next();
      }
      ctx.scene = new SceneContextScene(ctx, this.scenes, this.options);
      return run(ctx, () => {
        const current = ctx.scene.current;
        return current ? current.middleware()(ctx, next) : next();
      });
    };
  }
  static enter(...args) {
    return (ctx) => ctx.scene.enter(...args);
  }
  static reenter() {
    return (ctx) => ctx.scene.reenter();
  }
  static leave() {
    return (ctx) => ctx.scene.leave();
  }
}

export class WizardContextWizard {
  constructor(ctx, steps) {
    this.ctx = ctx;
    this.steps = steps;
    this.state = ctx.scene.state;
    this.cursor = ctx.scene.session.cursor ?? 0;
  }
  get cursor() {
    return this.ctx.scene.session.cursor;
  }
  set cursor(value) {
    if (!Number.isSafeInteger(value)) {
      throw new RangeError('Invalid wizard step');
    }
    this.ctx.scene.session.cursor = value;
  }
  get step() {
    return this.steps[this.cursor];
  }
  selectStep(index) {
    this.cursor = index;
    return this;
  }
  next() {
    return this.selectStep(this.cursor + 1);
  }
  back() {
    return this.selectStep(this.cursor - 1);
  }
}

export class WizardScene extends BaseScene {
  constructor(id, ...args) {
    const first = args[0];
    const stepFirst =
      typeof first === 'function' || typeof first?.middleware === 'function';
    super(id, stepFirst ? {} : (first ?? {}));
    this.steps = stepFirst ? args : args.slice(1);
  }
  middleware() {
    const run = super.middleware();
    return (ctx, next) => {
      ctx.wizard = new WizardContextWizard(ctx, this.steps);
      return run(ctx, () => {
        const step = ctx.wizard.step;
        if (!step) {
          ctx.wizard.selectStep(0);
          return ctx.scene.leave();
        }
        return (typeof step === 'function' ? step : step.middleware())(
          ctx,
          next
        );
      });
    };
  }
  enterMiddleware() {
    return compose([super.enterMiddleware(), this.middleware()]);
  }
}

export const Scenes = Object.freeze({
  BaseScene,
  SceneContextScene,
  Stage,
  WizardScene,
  WizardContextWizard,
});
