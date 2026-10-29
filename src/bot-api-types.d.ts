import type { Parameters, RequestOptions, TextWithEntities } from './index.js';
import type { BotApiMethodMap } from './bot-method-types/index.js';
import type { InputPollOption, InputRichMessage } from './bot-types/index.js';
import type { BotRequestInput } from './bot-input-types.js';

export type BotApiMethod = keyof BotApiMethodMap;
export type BotApiParams<M extends BotApiMethod> = BotRequestInput<
  BotApiMethodMap[M]['params']
>;
export type BotApiResult<M extends string> = M extends BotApiMethod
  ? BotApiMethodMap[M]['result']
  : unknown;
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];
export type BotCallArguments<
  M extends string,
  R = RequestOptions,
> = M extends BotApiMethod
  ? [RequiredKeys<BotApiParams<M>>] extends [never]
    ? [params?: BotApiParams<M> | Extract<R, AbortSignal>, options?: R]
    : [params: BotApiParams<M>, options?: R]
  : [params?: Parameters | Extract<R, AbortSignal>, options?: R];
export type BotApiCall<R = RequestOptions> = <
  T = never,
  M extends string = string,
>(
  method: M,
  ...args: BotCallArguments<NoInfer<M>, R>
) => Promise<[NoInfer<T>] extends [never] ? BotApiResult<M> : NoInfer<T>>;
export type ExtensionMethods<R = RequestOptions> = {
  [method: string]: <T = unknown>(
    params?: Parameters | Extract<R, AbortSignal>,
    options?: R
  ) => Promise<T>;
};
export type RawBotApi<R = RequestOptions> = {
  [M in BotApiMethod]: <T = BotApiResult<M>>(
    ...args: BotCallArguments<M, R>
  ) => Promise<NoInfer<T>>;
} & ExtensionMethods<R>;
export type BotArgument<
  M extends BotApiMethod,
  F extends string,
> = F extends 'text_or_rich_message'
  ? string | TextWithEntities | BotRequestInput<InputRichMessage>
  : M extends 'sendPoll'
    ? F extends 'options'
      ? ReadonlyArray<string | BotRequestInput<InputPollOption>>
      : Field<M, F>
    : Field<M, F>;
type Field<
  M extends BotApiMethod,
  F extends string,
> = F extends keyof BotApiParams<M> ? BotApiParams<M>[F] : never;
export type BotOther<M extends BotApiMethod, F extends PropertyKey> = Omit<
  BotApiParams<M>,
  F
> &
  RequestOptions &
  Parameters;
