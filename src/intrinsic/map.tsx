import { jsx } from "../jsx-runtime";
import { sigProxy } from "../signal-proxy";

export type MapProps<T> = {
  data: JSX.Signal<T[]>;
  render: (value: T) => Element;
  parent?: Element;
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

export function Map<T>(props: MapProps<T>) {
  const memo = new RenderMemory();
  const parent = (props.parent ?? <div></div>) as HTMLElement;
  const signal = sigProxy(props.data);

  const b = signal.add(list => {
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
      const element = props.render(value);
      const beforeElem = memo.elements[i];
      if (beforeElem) {
        parent.insertBefore(element, beforeElem[1]);
      } else {
        parent.appendChild(element);
      }
      memo.add(i, value, element);
    }
  });

  parent.addEventListener("sig-detach", () => {
    b.detach();
    memo.elements.splice(0, memo.elements.length);
  }, { capture: true, once: true });

  return parent;
}
