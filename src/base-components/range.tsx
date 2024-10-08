import { GetElement, Reconciler, jsx } from "../reconciler/reconciler";
import { sigProxy } from "../sig-proxy/_proxy";

export type RangeProps<T> = {
  data: JSX.Signal<readonly T[]>;
  /** Parent element to use, if not provided a empty div will be created and used. */
  into?: GetElement;
  /**
   * Don't add the default class name to the parent element.
   * (`vjsx-map-container`)
   */
  noclass?: boolean;
  /**
   *  A function that will return the HTML element for each value in the data list provided.
   */
  children: (value: T) => GetElement;
};

class RenderMemory<T> {
  elements: Array<[value: T, element: GetElement]> = [];

  findIndexForValue(value: T): number {
    for (let i = 0; i < this.elements.length; i++) {
      const [v] = this.elements[i]!;
      if (v === value) {
        return i;
      }
    }

    return -1;
  }

  moveBefore(idx: number, beforeIdx: number) {
    const [entry] = this.elements.splice(idx, 1);
    this.elements.splice(beforeIdx, 0, entry!);
  }

  add(idx: number, value: T, element: Element) {
    this.elements.splice(idx, 0, [value, element]);
  }
}

const getRenderFn = <T,>(props: {
  children: any;
}): ((elem: T) => JSX.Element) => {
  if (
    Array.isArray(props.children) &&
    typeof props.children[0] === "function"
  ) {
    return props.children[0];
  } else if (typeof props.children === "function") {
    return props.children;
  }

  throw new Error("<Range>: Invalid children");
};

const mapBindingFactory = <T,>(memo: RenderMemory<T>, props: RangeProps<T>) => {
  return (container: JSX.Element, list: readonly T[]) => {
    for (let i = 0; i < memo.elements.length; i++) {
      const [value, element] = memo.elements[i]!;
      if (list.indexOf(value) === -1) {
        Reconciler.interactions().remove(element);
        memo.elements.splice(i, 1);
        i--;
      }
    }

    for (let i = 0; i < list.length; i++) {
      const value = list[i]!;

      // If the element index didn't change, skip it.
      if (i in memo.elements && memo.elements.at(i)![0] === value) {
        continue;
      }

      // If the element is already in the list, move it to the correct idx
      const prevIdx = memo.findIndexForValue(value);
      if (prevIdx !== -1) {
        const [, element] = memo.elements[prevIdx]!;
        const beforeElem = memo.elements[i];
        if (beforeElem) {
          Reconciler.interactions().insertBefore(
            container,
            element,
            beforeElem[1],
          );
        } else {
          Reconciler.interactions().append(container, element);
        }
        memo.moveBefore(prevIdx, i);
        continue;
      }

      // Otherwise, render a new element
      const render = getRenderFn(props);
      const element = render(value);
      const beforeElem = memo.elements[i];
      if (beforeElem) {
        Reconciler.interactions().insertBefore(
          container,
          element,
          beforeElem[1],
        );
      } else {
        Reconciler.interactions().append(container, element);
      }
      memo.add(i, value, element);
    }
  };
};

/**
 * @example
 * const data = signal([1, 2, 3]);
 *
 * <Range
 *   data={data}
 *   into={<ul />}
 * >
 *   {(value) => <li>{value}</li>}
 * </Range>
 */
export function Range<T>(props: RangeProps<T>) {
  const memo = new RenderMemory<T>();
  const parent = props.into ?? <div />;
  const signal = sigProxy(props.data);

  if (!props.noclass) {
    Reconciler.interactions().addClassName(parent, "vjsx-range-container");
  }

  signal.bindTo(parent, mapBindingFactory(memo, props));

  return parent;
}
