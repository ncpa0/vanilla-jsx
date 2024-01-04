import { sigProxy } from "./signals/proxy";

type FunctionComponent = (props: object) => JSX.Element;

type CreateElementProps = {
  [k: string]: any;
  children?: JSX.Children;
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
  children: Exclude<JSX.Children, JSX.Element | JSX.VanillaValue>,
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

          sig.bindTo(node, (value) => {
            node.textContent = valToString(value);
          });

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
  ...children: Exclude<JSX.Children, JSX.Element | JSX.VanillaValue>
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
    return fragment as any;
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

        if (propName.startsWith("on")) {
          const eventName = propName.substring(2).toLowerCase();
          let prevListener: (e: Event) => void;
          sig.bindTo(element, (value) => {
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
          sig.bindTo(element, (value) => {
            if (value == null && element.hasAttribute(propName)) {
              element.removeAttribute(propName);
              return;
            }

            if (propName in element) {
              (element as any)[propName] = value;
              return;
            }

            if (value != null) {
              element.setAttribute(propName, valToString(value));
            }
          });
        }
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

const Fragment = "";

export { createElement as jsx, createElement as jsxs, Fragment };
