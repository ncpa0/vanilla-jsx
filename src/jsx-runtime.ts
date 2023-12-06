import { sigProxy } from "./signal-proxy";

type FunctionComponent = (props: object) => JSX.Element;

type CreateElementProps = {
  [k: string]: any;
  children?: JSX.Element | Array<JSX.Element | JSX.Element[]>;
};

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function isSignal(o: object): o is JSX.Signal {
  return (
    "add" in o && typeof o["add"] === "function"
  );
}

function valToString(value: JSX.SignalValue): string {
  return value == null ? "" : String(value);
}

const mapChildren = (
  children: Array<JSX.Element | JSX.Element[]>,
  accumulator: Array<Element | DocumentFragment | Text>,
) => {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    switch (typeof child) {
      case "string":
      case "number":
        accumulator.push(document.createTextNode(valToString(child)));
        break;
      case "boolean":
      case "undefined":
        break;
      case "object":
        if (child === null) {
          break;
        }
        if (Array.isArray(child)) {
          mapChildren(child, accumulator);
        } else if (isSignal(child)) {
          const sig = sigProxy(child);
          const node = document.createTextNode("");

          const b = sig.add((value) => {
            node.textContent = valToString(value);
          });

          node.addEventListener("sig-detach", () => {
            b.detach();
          }, { once: true, capture: true });

          accumulator.push(node);
        } else {
          accumulator.push(child);
        }
        break;
    }
  }
};

export function createElement(
  tag: string | FunctionComponent,
  props: CreateElementProps | undefined,
  ...children: Array<JSX.Element | JSX.Element[]>
): JSX.Element {
  if (typeof tag === "function") {
    const forwardedProps = props ?? {};
    if (children.length > 0) {
      forwardedProps.children = children;
    }
    return tag(forwardedProps);
  }

  children = children.length > 0 ? children : props ? asArray(props?.children) : [];

  const childNodes: Array<Element | DocumentFragment | Text> = [];

  mapChildren(children, childNodes);

  if (tag === "") {
    const fragment = document.createDocumentFragment();
    for (const child of childNodes) {
      fragment.appendChild(child);
    }
    return fragment;
  }

  const element = document.createElement(tag);

  if (props) {
    for (const [propName, propValue] of Object.entries(props)) {
      if (propName === "children") {
        continue;
      }

      if (
        typeof propValue === "object"
        && propValue !== null
        && isSignal(propValue)
      ) {
        const sig = sigProxy(propValue);
        let b: {
          detach(): void;
        };

        if (propName.startsWith("on")) {
          const eventName = propName.substring(2).toLowerCase();
          let prevListener: (e: Event) => void;
          b = sig.add((value) => {
            if (prevListener) {
              element.removeEventListener(eventName, prevListener);
            }
            if (value == null) {
              return;
            }
            element.addEventListener(eventName, value as any);
            prevListener = value as any;
          });
        } else {
          b = sig.add((value) => {
            if (value == null) {
              element.removeAttribute(propName);
            } else {
              element.setAttribute(propName, valToString(value));
            }
          });
        }

        element.addEventListener("sig-detach", () => {
          b.detach();
        }, { once: true, capture: true });
      } else {
        if (propName.startsWith("on")) {
          const eventName = propName.substring(2).toLowerCase();
          element.addEventListener(eventName, propValue);
        } else {
          element.setAttribute(propName, propValue);
        }
      }
    }
  }

  for (const child of childNodes) {
    element.appendChild(child);
  }

  return element;
}

export function disconnectElement(elem: Element | DocumentFragment | Text) {
  elem.dispatchEvent(new Event("sig-detach", { bubbles: false, cancelable: false }));
}

const Fragment = "";

export { createElement as jsx, createElement as jsxs, Fragment };
