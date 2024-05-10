/**
 * Creates a reference to the signal that should remain alive as long as the
 * given object exists in the memory, this should prevent the signal from being
 * garbage collected if all other references to it are lost.
 */
export function registerBoundSignal(element: object, signal: JSX.Signal<any>) {
  let signals = ElemMap.get(element);
  if (!signals) {
    signals = [];
    ElemMap.set(element, signals);
  }
  signals.push(signal);
}

export const ElemMap = new WeakMap<object, JSX.Signal<any>[]>();
