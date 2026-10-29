type StripScope<A extends unknown[], S extends unknown[]> = S extends [
  unknown,
  ...infer Remaining,
]
  ? A extends [unknown, ...infer Tail]
    ? StripScope<Tail, Remaining>
    : never
  : A;
export type ContextOperation<
  A extends unknown[],
  Scope extends unknown[] = [unknown],
> = (...args: StripScope<A, Scope>) => Promise<unknown>;
