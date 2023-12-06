export interface SignalProxy<T> {
  add(cb: (value: T) => void): { detach(): void };
  bindTo<E extends HTMLElement | Text>(elem: E, cb: (value: T, element: E) => void): void;
}

let BoundSignals: {
  active: boolean;
  element: Element | Text;
  detach: () => void;
}[] = [];

export function sigProxy<T>(s: JSX.Signal<T>): SignalProxy<T> {
  if ("remove" in s) {
    const add: SignalProxy<T>["add"] = (cb) => {
      s.add(cb);
      return {
        detach() {
          s.remove(cb);
        },
      };
    };

    const bindTo: SignalProxy<T>["bindTo"] = (element, cb) => {
      const binding = add((value) => {
        cb(value, element);
      });
      BoundSignals.push({
        active: true,
        element,
        detach: binding.detach,
      });
    };

    return {
      add,
      bindTo,
    };
  } else {
    const add: SignalProxy<T>["add"] = (cb) => {
      return s.add(cb);
    };

    const bindTo: SignalProxy<T>["bindTo"] = (element, cb) => {
      const binding = add((value) => {
        cb(value, element);
      });
      BoundSignals.push({
        active: true,
        element,
        detach: binding.detach.bind(binding),
      });
    };

    return {
      add,
      bindTo,
    };
  }
}

const isBindingActive = (binding: typeof BoundSignals[0]) => binding.active;
export function disconnectElement(elem: Element | DocumentFragment | Text) {
  for (let i = 0; i < BoundSignals.length; i++) {
    const binding = BoundSignals[i]!;
    if (elem.contains(binding.element)) {
      binding.detach();
      binding.active = false;
    }
  }
  BoundSignals = BoundSignals.filter(isBindingActive);
}
