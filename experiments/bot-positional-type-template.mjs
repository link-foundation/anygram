// Callable declarations share the independently generated wire contract map.
export function grammyTypeTemplate(declarations, routes) {
  return `import type { RequestOptions } from './index.js';
import type { BotApiMethod, BotApiParams, BotApiResult, BotArgument, BotOther } from './bot-api-types.js';
interface Signatures {${declarations.join('\n')}}
interface Routes {${routes.join('\n')}}
type Method<K extends keyof Signatures> = K extends keyof Routes ? Routes[K] : K & BotApiMethod;
type Fields<S extends string> = S extends '' | '?' ? never : S extends \x60\${infer First} \${infer Rest}\x60 ? First | Fields<Rest> : S;
type WireFields<S extends string> = Exclude<Fields<S>, 'text_or_rich_message'> | (Fields<S> extends infer F ? 'text_or_rich_message' extends F ? 'text' | 'rich_message' : never : never);
type RequiredArguments<M extends BotApiMethod, S extends string> = S extends '' ? [] : S extends \x60\${infer First} \${infer Rest}\x60 ? [value: BotArgument<M, First>, ...RequiredArguments<M, Rest>] : [value: BotArgument<M, S>];
type Arguments<M extends BotApiMethod, S extends string> = S extends '?' ? [other?: BotOther<M, never>, signal?: RequestOptions | AbortSignal] : S extends \x60\${infer Required} ?\x60 ? [...RequiredArguments<M, Required>, other?: BotOther<M, WireFields<Required>>, signal?: RequestOptions | AbortSignal] : [...RequiredArguments<M, S>, options?: RequestOptions | AbortSignal];
export type GrammyPositionalArguments<K extends keyof Signatures> = Arguments<Method<K>, Signatures[K]>;
export type GrammyPositionalResult<K extends keyof Signatures> = K extends \x60\${string}Inline\x60 ? Extract<BotApiResult<Method<K>>, true> extends never ? BotApiResult<Method<K>> : true : BotApiResult<Method<K>>;
export type GrammyPositionalApi = { [M in keyof Signatures]: Signatures[M] extends '' | '?' ? (...args: GrammyPositionalArguments<M>) => Promise<GrammyPositionalResult<M>> : ((...args: GrammyPositionalArguments<M>) => Promise<GrammyPositionalResult<M>>) & ((params: BotApiParams<Method<M>>, options?: RequestOptions | AbortSignal) => Promise<GrammyPositionalResult<M>>) };
`;
}
