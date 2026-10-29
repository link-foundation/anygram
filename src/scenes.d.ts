import type {
  Composer,
  CommonContext,
  Middleware,
  MiddlewareLike,
  Parameters,
  TelegrafContext,
} from './index.js';

export interface SceneSessionData {
  current?: string;
  expires?: number;
  state?: Parameters;
  cursor?: number;
}
export interface SceneSession<D extends SceneSessionData = SceneSessionData> {
  __scenes?: D;
}
export interface SceneFlavor<D extends SceneSessionData = SceneSessionData> {
  session: SceneSession<D>;
  scene: SceneContextScene<any, D>;
}
export interface WizardFlavor extends SceneFlavor {
  wizard: WizardContextWizard<any>;
}
export interface SceneOptions<C extends CommonContext = Scenes.SceneContext> {
  ttl?: number;
  handlers?: MiddlewareLike<C>[];
  enterHandlers?: MiddlewareLike<C>[];
  leaveHandlers?: MiddlewareLike<C>[];
}
export interface StageOptions {
  ttl?: number;
  default?: string;
  defaultSession?: SceneSessionData;
  maxTransitions?: number;
}
export declare class BaseScene<
  C extends CommonContext = Scenes.SceneContext,
> extends Composer<C> {
  constructor(id: string, options?: SceneOptions<C>);
  id: string;
  ttl?: number;
  enter(...middleware: MiddlewareLike<C>[]): this;
  leave(...middleware: MiddlewareLike<C>[]): this;
  enterMiddleware(): Middleware<C>;
  leaveMiddleware(): Middleware<C>;
}
export declare class SceneContextScene<
  C extends CommonContext = Scenes.SceneContext,
  D extends SceneSessionData = SceneSessionData,
> {
  constructor(
    ctx: C,
    scenes: Map<string, BaseScene<C>>,
    options?: StageOptions
  );
  ctx: C;
  readonly session: D;
  state: Parameters;
  readonly current?: BaseScene<C>;
  reset(): void;
  enter(id: string, state?: Parameters, silent?: boolean): Promise<unknown>;
  reenter(): Promise<unknown> | undefined;
  leave(): Promise<void>;
}
export declare class Stage<
  C extends CommonContext = Scenes.SceneContext,
> extends Composer<C> {
  constructor(scenes?: BaseScene<C>[], options?: StageOptions);
  scenes: Map<string, BaseScene<C>>;
  register(...scenes: BaseScene<C>[]): this;
  static enter(
    id: string,
    state?: Parameters,
    silent?: boolean
  ): Middleware<Scenes.SceneContext>;
  static reenter(): Middleware<Scenes.SceneContext>;
  static leave(): Middleware<Scenes.SceneContext>;
}
export declare class WizardContextWizard<
  C extends CommonContext = Scenes.WizardContext,
> {
  constructor(ctx: C, steps: MiddlewareLike<C>[]);
  state: Parameters;
  cursor: number;
  readonly step?: MiddlewareLike<C>;
  selectStep(index: number): this;
  next(): this;
  back(): this;
}
export declare class WizardScene<
  C extends CommonContext = Scenes.WizardContext,
> extends BaseScene<C> {
  constructor(id: string, ...steps: MiddlewareLike<C>[]);
  constructor(
    id: string,
    options: SceneOptions<C>,
    ...steps: MiddlewareLike<C>[]
  );
  steps: MiddlewareLike<C>[];
}
export declare namespace Scenes {
  const BaseScene: typeof import('./scenes.js').BaseScene;
  const SceneContextScene: typeof import('./scenes.js').SceneContextScene;
  const Stage: typeof import('./scenes.js').Stage;
  const WizardScene: typeof import('./scenes.js').WizardScene;
  const WizardContextWizard: typeof import('./scenes.js').WizardContextWizard;
  type SceneContext = TelegrafContext & SceneFlavor;
  type WizardContext = TelegrafContext & WizardFlavor;
  type SceneSession = import('./scenes.js').SceneSession;
  type SceneSessionData = import('./scenes.js').SceneSessionData;
  type WizardSession = SceneSession;
  type WizardSessionData = SceneSessionData;
}
