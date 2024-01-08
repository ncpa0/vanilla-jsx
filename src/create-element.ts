import { SignalProxyListenerRef, sigProxy } from "./signals/proxy";

type FunctionComponent = (props: object) => JSX.Element;

type CreateElementProps = {
  [k: string]: any;
  children?: JSX.Children;
};

type ChildNode = Element | DocumentFragment | Text | JSX.Signal<Text | Element>;

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

const getInitialChild = (appendTo: Element) => {
  const initialChild = document.createTextNode("");
  appendTo.appendChild(initialChild);
  return new WeakRef(initialChild);
};

const childBindingFactory = (lastNodeRef: WeakRef<Text | Element>) => {
  return (_: unknown, value: Text | Element, sigRef?: SignalProxyListenerRef) => {
    const lastNode = lastNodeRef?.deref();
    if (!lastNode) {
      return sigRef?.detach();
    }

    if (typeof value === "string") {
      if (lastNode instanceof Text) {
        lastNode.textContent = valToString(value);
      } else {
        const node = document.createTextNode(valToString(value));
        lastNode.replaceWith(node);
        lastNodeRef = new WeakRef(node);
      }
    } else {
      lastNode.replaceWith(value);
      lastNodeRef = new WeakRef(value);
    }
  };
};

const mapChildren = (
  children: Exclude<JSX.Children, JSX.Element | JSX.VanillaValue>,
  accumulator: Array<ChildNode>,
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
        } else {
          accumulator.push(child);
        }
        break;
    }
  }
};

const eventBindingFactory = (eventName: string) => {
  let prevListener: (e: Event) => void;
  return (elem: HTMLElement, value: any) => {
    if (prevListener) {
      elem.removeEventListener(eventName, prevListener);
    }
    if (value == null) {
      return;
    }
    elem.addEventListener(eventName, value as any);
    prevListener = value as any;
  };
};

const attributeBindingFactory = (attributeName: string) => {
  return (elem: HTMLElement, value: any) => {
    if (value == null && elem.hasAttribute(attributeName)) {
      elem.removeAttribute(attributeName);
      return;
    }

    if (attributeName in elem) {
      (elem as any)[attributeName] = value;
      return;
    }

    if (value != null) {
      elem.setAttribute(attributeName, valToString(value));
    }
  };
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

  const childNodes: Array<ChildNode> = [];

  mapChildren(children, childNodes);

  if (tag === "") {
    const fragment = document.createDocumentFragment();
    for (const child of childNodes) {
      if (isSignal(child)) {
        throw new Error("Signals cannot be used as children of fragments.");
      }
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
          sig.bindTo(element, eventBindingFactory(eventName));
        } else {
          sig.bindTo(element, attributeBindingFactory(propName));
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
    if (isSignal(child)) {
      const sig = sigProxy(child);
      let initialNodeRef: WeakRef<Text | Element> = getInitialChild(element);
      sig.bindTo(element, childBindingFactory(initialNodeRef));
    } else {
      element.appendChild(child);
    }
  }

  return element;
}

const Fragment = "";

export { createElement as jsx, createElement as jsxs, Fragment };
