export interface SignalInteropInterface<T> {
  /**
   * Checks if the given signal is supported by this interop.
   */
  is(signal: unknown): signal is T;
  /**
   * Adds a listener to the given signal. The listener should
   * be called once immediately after adding it.
   */
  add(signal: T, cb: (value: any) => any): () => void;
}
