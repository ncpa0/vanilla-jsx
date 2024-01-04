import { jsx } from "../create-element";
import { sigProxy } from "../signals/proxy";

export type MapProps<T> = {
  data: JSX.Signal<T[]>;
  parent?: Element;
  children: (value: T) => Element;
};

class RenderMemory<T> {
  elements: Array<[value: T, element: Element]> = [];

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

const getRenderFn = <T,>(props: { children: any }): (elem: T) => JSX.Element => {
  if (Array.isArray(props.children) && typeof props.children[0] === "function") {
    return props.children[0];
  } else if (typeof props.children === "function") {
    return props.children;
  }

  throw new Error("<Map>: Invalid children");
};

export function Map<T>(props: MapProps<T>) {
  const memo = new RenderMemory<T>();
  const parent = props.parent ?? <div></div>;
  const signal = sigProxy(props.data);

  signal.bindTo(parent, list => {
    for (let i = 0; i < memo.elements.length; i++) {
      const [value, element] = memo.elements[i]!;
      if (list.indexOf(value) === -1) {
        element.remove();
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
          parent.insertBefore(element, beforeElem[1]);
        } else {
          parent.appendChild(element);
        }
        memo.moveBefore(prevIdx, i);
        continue;
      }

      // Otherwise, render a new element
      const render = getRenderFn(props);
      const element = render(value);
      const beforeElem = memo.elements[i];
      if (beforeElem) {
        parent.insertBefore(element, beforeElem[1]);
      } else {
        parent.append(element);
      }
      memo.add(i, value, element);
    }
  });

  return parent;
}
