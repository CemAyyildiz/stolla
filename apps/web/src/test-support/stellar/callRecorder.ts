/**
 * A minimal, runner-agnostic call recorder.
 *
 * This exists instead of `vi.fn()` so the mocks can be type-checked and
 * imported without a test runner installed. It records the argument object of
 * every call, which is what makes "assert contract method arguments" possible.
 */
export type CallRecorder<TArgs, TResult> = {
  (args: TArgs): TResult;
  /** Every argument value this mock received, oldest first. */
  readonly calls: TArgs[];
  callCount(): number;
  lastArgs(): TArgs | undefined;
  argsAt(index: number): TArgs | undefined;
  wasCalledWith(predicate: (args: TArgs) => boolean): boolean;
  reset(): void;
};

export function createRecorder<TArgs, TResult>(
  implementation: (args: TArgs) => TResult,
): CallRecorder<TArgs, TResult> {
  const calls: TArgs[] = [];

  const recorder = ((args: TArgs): TResult => {
    calls.push(args);
    return implementation(args);
  }) as CallRecorder<TArgs, TResult>;

  Object.defineProperty(recorder, "calls", {
    value: calls,
    writable: false,
    enumerable: true,
  });

  recorder.callCount = () => calls.length;
  recorder.lastArgs = () =>
    calls.length === 0 ? undefined : calls[calls.length - 1];
  recorder.argsAt = (index: number) => calls[index];
  recorder.wasCalledWith = (predicate: (args: TArgs) => boolean) =>
    calls.some(predicate);
  recorder.reset = () => {
    calls.length = 0;
  };

  return recorder;
}
