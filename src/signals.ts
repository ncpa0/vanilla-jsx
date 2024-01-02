export interface SignalProxy<T> {
  add(cb: (value: T) => void): { detach(): void };
  bindTo<E extends Element | Text>(elem: E, cb: (value: T, element: E) => void): void;
}

let BoundSignals: {
  active: boolean;
  element: Element | Text;
  detach: () => void;
}[] = [];

const bindFactory = <T>(add: SignalProxy<T>["add"]) => {
  const bindTo: SignalProxy<T>["bindTo"] = (element, cb) => {
    const ref = add((value) => {
      cb(value, element);
    });
    const binding = {
      active: true,
      element,
      detach: ref.detach.bind(ref),
    };
    BoundSignals.push(binding);
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

const isBindingActive = (binding: typeof BoundSignals[0]) => binding.active;
export function disconnectElement(elem: Element | DocumentFragment | Text) {
  for (let i = 0; i < BoundSignals.length; i++) {
    const binding = BoundSignals[i]!;
    if (binding.active && elem.contains(binding.element)) {
      binding.detach();
      binding.active = false;
    }
  }
  BoundSignals = BoundSignals.filter(isBindingActive);
}
