import { htmlElementAttributes } from "html-element-attributes";
import { ClassName } from "./jsx-namespace/jsx.types";
import { SignalProxy, SignalProxyListenerRef, sigProxy } from "./signals/proxy";

const ElementAttributes = new Map<string, string[]>();

for (const [key, value] of Object.entries(htmlElementAttributes)) {
  ElementAttributes.set(key.toUpperCase(), value.concat(htmlElementAttributes["*"]!));
}

declare global {
  interface Window {
    trustedTypes: {
      createPolicy: (name: string, policy: { createHTML: (html: string) => string }) => {
        createHTML: (html: string) => string;
      };
    };
  }
}

type FunctionComponent = (props: object) => JSX.Element;

type CreateElementProps = {
  [k: string]: any;
  children?: JSX.Children;
  unsafeHTML?: boolean;
};

type ChildNode = Element | DocumentFragment | Text | JSX.Signal<Text | Element>;

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

const isArray = <T, O>(maybeArray: T[] | O): maybeArray is T[] => Array.isArray(maybeArray);

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
  return (_: unknown, value: Text | Element | undefined, sigRef?: SignalProxyListenerRef) => {
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
    } else if (value) {
      lastNode.replaceWith(value);
      lastNodeRef = new WeakRef(value);
    } else {
      const emptyNode = document.createTextNode("");
      lastNode.replaceWith(emptyNode);
      lastNodeRef = new WeakRef(emptyNode);
    }
  };
};

const prepareHtmlFactory = typeof window.trustedTypes !== "undefined"
  ? () => {
    const unsafePolicy = window.trustedTypes.createPolicy("unsafe", {
      createHTML: (html: string) => html,
    });
    return (html: string) => {
      return unsafePolicy.createHTML(html);
    };
  }
  : () => (html: string) => {
    return html;
  };

const prepareHtml = prepareHtmlFactory();

const parseHtml = (unsafehtml: string): Iterable<globalThis.ChildNode> => {
  const html = prepareHtml(unsafehtml);
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.childNodes;
};

const mapChildren = (
  children: Exclude<JSX.Children, JSX.Element | JSX.VanillaValue>,
  accumulator: Array<ChildNode>,
  unsafe?: boolean,
) => {
  for (let i = 0; i < children.length; i++) {
    const child = children[i];

    switch (typeof child) {
      case "string":
        if (unsafe) {
          const nodes = parseHtml(child);
          for (const node of nodes) {
            accumulator.push(node as ChildNode);
          }
        } else {
          accumulator.push(document.createTextNode(child));
        }
        break;
      case "number":
      case "bigint":
        accumulator.push(document.createTextNode(valToString(child)));
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

const setSimpleClassNameFactory = () => {
  let lastNames: string[] = [];
  return (elem: HTMLElement, cname: string | number | boolean) => {
    elem.classList.remove(...lastNames);
    switch (typeof cname) {
      case "string":
        const names = cname.split(" ").filter(Boolean);
        elem.classList.add(...names);
        lastNames = names;
        break;
      case "number":
        const name = String(cname);
        elem.classList.add(name);
        lastNames = [name];
        break;
      default:
        lastNames.splice(0, lastNames.length);
    }
  };
};

const setClassNameConditionallyFactory = (cname: string) => {
  const names = cname.split(" ").filter(Boolean);
  return (elem: HTMLElement, condition: any) => {
    if (!!condition) {
      elem.classList.add(...names);
    } else {
      elem.classList.remove(...names);
    }
  };
};

const setClassName = (elem: HTMLElement, value: ClassName) => {
  switch (typeof value) {
    case "string":
      elem.className = value;
      return;
    case "number":
      elem.className = String(value);
      return;
    case "object":
      if (isArray(value)) {
        elem.className = "";
        for (let i = 0; i < value.length; i++) {
          const cname = value[i];
          switch (typeof cname) {
            case "string":
              const names = cname.split(" ").filter(Boolean);
              elem.classList.add(...names);
              break;
            case "number":
              elem.classList.add(String(cname));
              break;
            case "object":
              if (cname != null) {
                const signal = sigProxy(cname);
                signal.bindTo(elem, setSimpleClassNameFactory());
              }
              break;
          }
        }
        return;
      }
      if (isSignal(value)) {
        const signal = sigProxy(value);
        signal.bindTo(elem, setClassName);
        return;
      }
      const entries = Object.entries(value);
      elem.className = "";
      for (const [cname, condition] of entries) {
        const setCname = setClassNameConditionallyFactory(cname);
        if (typeof condition === "object" && isSignal(condition)) {
          const signal = sigProxy(condition);
          signal.bindTo(elem, setCname);
        } else {
          setCname(elem, condition);
        }
      }
  }
};

const attributeBindingFactory = (attributeName: string) => {
  if (attributeName === "class") {
    return setClassName;
  }

  if (attributeName.includes("data-")) {
    // data attributes can be set using the `dataset` Element property
    const dataName = attributeName.substring(5);
    return (elem: HTMLElement, value: any) => {
      if (value == null) {
        delete elem.dataset[dataName];
      } else {
        elem.dataset[dataName] = String(value);
      }
    };
  }

  if (attributeName.includes("-")) {
    // custom attribute should always be set using the setAttribute method
    return (elem: HTMLElement, value: any) => {
      if (value != null) {
        elem.setAttribute(attributeName, valToString(value));
      } else {
        elem.removeAttribute(attributeName);
      }
    };
  }

  return (elem: HTMLElement, value: any) => {
    const possibleAttributeNames = ElementAttributes.get(elem.tagName) ?? [];
    const isAttributeName = possibleAttributeNames.includes(attributeName);
    // prioritize setting the attribute if the value is of type string | number | boolean
    if (isAttributeName) {
      switch (typeof value) {
        case "string":
          elem.setAttribute(attributeName, value);
          return;
        case "number":
          elem.setAttribute(attributeName, valToString(value));
          return;
        case "boolean":
          if (value) {
            elem.setAttribute(attributeName, attributeName);
          } else {
            elem.removeAttribute(attributeName);
          }
          return;
        case "undefined":
          elem.removeAttribute(attributeName);
          return;
      }
      if (value == null) {
        elem.removeAttribute(attributeName);
      }
    }

    if (attributeName in elem) {
      (elem as any)[attributeName] = value;
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

  mapChildren(children, childNodes, props?.unsafeHTML);

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
      if (propName === "children" || propName === "unsafeHTML") {
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
          eventBindingFactory(eventName)(element, propValue);
        } else {
          attributeBindingFactory(propName)(element, propValue);
        }
      }
    }
  }

  for (const child of childNodes) {
    if (isSignal(child)) {
      const sig = sigProxy(child) as SignalProxy<Element | Text | undefined>;
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
