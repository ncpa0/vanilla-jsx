export interface SignalProxy<T> {
  add(cb: (value: T) => void): { detach(): void };
  bindTo<E extends Element | Text>(elem: E, cb: (value: T, element: E) => void): void;
}

const bindFactory = <T>(add: SignalProxy<T>["add"]) => {
  const addSelfDetachingListener = <E extends Element | Text>(
    elementRef: WeakRef<E>,
    cb: (value: T, element: E) => void,
  ) => {
    const ref = add((value) => {
      const elem = elementRef.deref();
      if (elem) {
        cb(value, elem);
      } else {
        ref.detach();
      }
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
