import { registerBoundSignal } from "../signals/utils";
import { DomGate, type GatedBinding } from "./_gate";
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

  /**
   * Prevents all signals bound to the given element and all of its
   * descendants from making DOM and attribute mutations.
   *
   * The signals keep updating their values as usual, only the mutations
   * of the DOM elements and attributes are suppressed. Once `resume()` is
   * called, all the suppressed mutations will be re-applied with the most
   * recent values of their signals.
   *
   * Calls to `stop()` can be nested - resuming an element will also
   * resume all of its descendant subtrees that have been stopped
   * separately.
   *
   * The element is held through a weak reference, so a stopped subtree
   * that gets removed from the document and dropped from memory gets
   * unregistered automatically without leaking.
   *
   * This operation is O(1) - the element tree is never walked.
   */
  public static stop(element: Element) {
    DomGate.stop(element);
  }

  /**
   * Re-enables all the signals bound to the given element and all of its
   * descendants that have been stopped with `SignalsReg.stop()` and
   * re-applies all the DOM and attribute mutations that were suppressed
   * in the meantime, using the most recent values of their signals.
   */
  public static resume(element: Element) {
    DomGate.resume(element);
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

    const binding: GatedBinding = {
      elemRef: elementRef,
      signal: signal as { get(): any },
      cb: (elem, value) => cb(elem, value, ref),
      detached: false,
    };

    const onChange = (value: T) => {
      const elem = elementRef.deref();
      if (elem) {
        if (DomGate.gate(elem, binding)) {
          return;
        }
        binding.cb(elem, value);
      } else {
        ref?.detach();
      }
    };

    const detachFromSignal = s.add(signal, onChange);
    ref = {
      detach: () => {
        detachFromSignal();
        DomGate.discard(binding);
      },
    };
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
