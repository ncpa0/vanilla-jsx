import { registerBoundSignal } from "../signals/utils";
import { SignalInteropInterface } from "./_interface";
import { VanillaJSXSignalInterop } from "./vanilla-jsx-interop";

/**
 * Registry of signal interop implementations.
 */
export class SignalsReg {
  private static interops: SignalInteropInterface<any>[] = [
    new VanillaJSXSignalInterop(),
  ];

  public static register(interop: SignalInteropInterface<any>) {
    this.interops.unshift(interop);
  }

  public static find(signal: any): SignalInteropInterface<any> {
    const result = this.interops.find(interop => interop.is(signal));
    if (result) {
      return result;
    }
    throw new Error("Unsupported signal implementation");
  }

  public static isSignal(signal: any): signal is JSX.Signal<any> {
    return this.interops.some(interop => interop.is(signal));
  }
}

export type SignalProxyListenerRef = {
  /** Detaches the listener from the Signal. */
  detach(): void;
};

export interface SignalProxy<T> {
  add(cb: (value: T) => void): () => void;
  bindTo<E extends object>(
    elem: E,
    cb: (element: E, value: T, sigRef?: SignalProxyListenerRef) => void,
  ): () => void;
}

export function sigProxy<T>(signal: JSX.Signal<T>): SignalProxy<T> {
  const s = SignalsReg.find(signal);

  const addSelfDetachingListener = <E extends object>(
    elementRef: WeakRef<E>,
    cb: (element: E, value: T, sigRef?: SignalProxyListenerRef) => void,
  ) => {
    let ref: {
      detach(): void;
    };

    const onChange = (value: T) => {
      const elem = elementRef.deref();
      if (elem) {
        cb(elem, value, ref);
      } else {
        ref?.detach();
      }
    };

    ref = { detach: s.add(signal, onChange) };
    return ref;
  };

  return {
    add(cb) {
      return s.add(signal, cb);
    },
    bindTo(element, cb) {
      registerBoundSignal(element, signal);
      const elemRef = new WeakRef(element);
      const ref = addSelfDetachingListener(elemRef, cb);
      return () => ref.detach();
    },
  };
}

/**
 * Bind given signal to the provided element.
 *
 * This binding leverages a WeakReference to allow the GC to clean up the
 * element even when the signal is still accessible in the program, thanks
 * to this mechanism it is not necessary to cleanup the signal->element
 * binding manually.
 *
 * **You must not reference the bound element within the callback function
 * otherwise than through the argument provided to it.**
 *
 * @example
 * // DO NOT DO THIS:
 * bindSignal(mySignal, myElement, (elem, value) => {
 *  myElement.classList.toggle("DONT_DO_THIS", value);
 * });
 *
 * // Do this instead:
 * bindSignal(mySignal, myElement, (elem, value) => {
 *  elem.classList.toggle("this_is_fine", value);
 * });
 */
export function bindSignal<T, E extends Element | Text>(
  signal: JSX.Signal<T>,
  toElement: E,
  callback: (elem: E, value: T, sigRef?: SignalProxyListenerRef) => void,
) {
  sigProxy(signal).bindTo(toElement, callback);
}
