export type SignalProxyListenerRef = {
  /** Detaches the listener from the Signal. */
  detach(): void;
};

export interface SignalProxy<T> {
  add(cb: (value: T) => void): { detach(): void };
  bindTo<E extends Element | Text>(elem: E, cb: (element: E, value: T, sigRef?: SignalProxyListenerRef) => void): void;
}

const bindFactory = <T>(add: SignalProxy<T>["add"]) => {
  const addSelfDetachingListener = <E extends Element | Text>(
    elementRef: WeakRef<E>,
    cb: (element: E, value: T, sigRef?: SignalProxyListenerRef) => void,
  ) => {
    const onChange = (value: T) => {
      const elem = elementRef.deref();
      if (elem) {
        cb(elem, value, ref);
      } else {
        ref.detach();
      }
    };
    const onFirstCall = (value: T) => {
      const elem = elementRef.deref();
      if (elem) {
        cb(elem, value);
      }
      cbRef.cb = onChange;
    };

    const cbRef = {
      cb: onFirstCall,
    };

    const ref = add((value) => {
      cbRef.cb(value);
    });
  };

  const bindTo: SignalProxy<T>["bindTo"] = (element, cb) => {
    const elemRef = new WeakRef(element);
    addSelfDetachingListener(elemRef, cb);
  };

  return bindTo;
};

const hasRemoveFn = <T>(s: JSX.Signal<T>): s is JSX.SignalWithRemove<T> => {
  return "remove" in s && typeof s["remove"] === "function";
};

const hasDetachFn = <T>(s: JSX.Signal<T>): s is JSX.SignalWithDetach<T> => {
  return "detach" in s && typeof s["detach"] === "function";
};

export function sigProxy<T>(s: JSX.Signal<T>): SignalProxy<T> {
  const hasRemove = hasRemoveFn(s);
  const hasDetach = hasDetachFn(s);

  if (!hasRemove && !hasDetach) {
    const add: SignalProxy<T>["add"] = (cb) => {
      return s.add(cb);
    };

    return {
      add,
      bindTo: bindFactory(add),
    };
  } else if (hasDetach) {
    const add: SignalProxy<T>["add"] = (cb) => {
      s.add(cb);
      return {
        detach() {
          s.detach(cb);
        },
      };
    };

    return {
      add,
      bindTo: bindFactory(add),
    };
  } else {
    const add: SignalProxy<T>["add"] = (cb) => {
      s.add(cb);
      return {
        detach() {
          s.remove(cb);
        },
      };
    };

    return {
      add,
      bindTo: bindFactory(add),
    };
  }
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