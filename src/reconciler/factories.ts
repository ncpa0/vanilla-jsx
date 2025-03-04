import { InteractionInterface } from "../dom/interaction-interface";
import { ClassName, StyleDict } from "../jsx-namespace/jsx.types";
import {
  SignalProxyListenerRef,
  SignalsReg,
  sigProxy,
} from "../sig-proxy/_proxy";
import { isArray, MaybeArray } from "./utils";

export class BindingFactories<
  Element extends object,
  TextElement extends object,
  FragmentElement extends object,
  Ev extends object,
> {
  constructor(
    private dom: InteractionInterface<
      Element,
      TextElement,
      FragmentElement,
      Ev
    >,
  ) {}

  private flattenFragments(
    arr: Array<Element | TextElement | FragmentElement | undefined>,
  ): Array<Element | TextElement | undefined> {
    return arr.flatMap((elem) => {
      if (this.dom.isFragment(elem)) {
        return this.flattenFragments(this.dom.getFragmentChildren(elem));
      }
      return elem;
    });
  }

  private setClassName(elem: Element, value: ClassName) {
    switch (typeof value) {
      case "string":
        this.dom.setClass(elem, value);
        return;
      case "number":
        this.dom.setClass(elem, String(value));
        return;
      case "object":
        if (isArray(value)) {
          this.dom.setClass(elem, "");
          for (let i = 0; i < value.length; i++) {
            const cname = value[i];
            switch (typeof cname) {
              case "string":
                this.dom.addClassName(elem, cname);
                break;
              case "number":
                this.dom.addClassName(elem, String(cname));
                break;
              case "object":
                if (SignalsReg.isSignal(cname)) {
                  if (cname != null) {
                    const signal = sigProxy(cname);
                    signal.bindTo(elem, this.createSimpleClassNameBinding());
                  }
                } else if (cname != null) {
                  if (Symbol.toPrimitive in cname) {
                    this.dom.addClassName(elem, String(cname));
                  } else {
                    console.warn(
                      "unsupported object used as class name",
                      cname,
                    );
                  }
                }
                break;
              default:
                console.warn("unsupported value used as class name", cname);
            }
          }
          return;
        }
        if (SignalsReg.isSignal(value)) {
          const signal = sigProxy(value);
          signal.bindTo(elem, this.setClassName.bind(this));
          return;
        }
        if (Symbol.toPrimitive in value) {
          this.dom.setClass(elem, String(value));
          return;
        }
        const entries = Object.entries(value);
        this.dom.setClass(elem, "");
        for (const [cname, condition] of entries) {
          const setCname = this.createConditionalClassNameBinding(cname);
          if (typeof condition === "object" && SignalsReg.isSignal(condition)) {
            const signal = sigProxy(condition);
            signal.bindTo(elem, setCname);
          } else {
            setCname(elem, condition);
          }
        }
    }
  }

  public createChildBinding(
    lastNodeRef: WeakRef<TextElement | Element>,
    rest: WeakRef<TextElement | Element>[] = [],
  ) {
    return (
      _: unknown,
      value: MaybeArray<TextElement | Element | FragmentElement | undefined>,
      sigRef?: SignalProxyListenerRef,
    ) => {
      const lastNode = lastNodeRef?.deref();
      if (!lastNode) {
        return sigRef?.detach();
      }

      if (rest.length > 0) {
        for (const ref of rest) {
          const node = ref.deref();
          if (node) {
            this.dom.remove(node);
          }
        }
        rest.splice(0, rest.length);
      }

      if (typeof value === "string") {
        if (this.dom.isText(lastNode)) {
          this.dom.setText(lastNode, value);
        } else {
          const node = this.dom.createText(value);
          this.dom.replace(lastNode, node);
          lastNodeRef = new WeakRef(node);
        }
      } else if (value) {
        if (this.dom.isFragment(value)) {
          value = this.dom.getFragmentChildren(value);
        }

        if (Array.isArray(value)) {
          const elements = this.flattenFragments(value);
          const [firstNode] = elements;
          if (firstNode) {
            if (firstNode === lastNode) {
              let insertAfter = firstNode;
              for (let i = 1; i < elements.length; i++) {
                const node: TextElement | Element | undefined = elements[i];
                if (node) {
                  this.dom.insertAfter(node, insertAfter);
                  rest.push(new WeakRef(node));
                  insertAfter = node;
                }
              }
            } else {
              const fragment = this.dom.createFragment();
              this.dom.append(fragment, firstNode);
              lastNodeRef = new WeakRef(firstNode);

              for (let i = 1; i < elements.length; i++) {
                const node: TextElement | Element | undefined = elements[i];
                if (node) {
                  this.dom.append(fragment, node);
                  rest.push(new WeakRef(node));
                }
              }

              this.dom.replace(lastNode, fragment);
            }
          } else {
            const emptyNode = this.dom.createText("");
            this.dom.replace(lastNode, emptyNode);
            lastNodeRef = new WeakRef(emptyNode);
          }
        } else {
          if (value !== lastNode) {
            this.dom.replace(lastNode, value);
            lastNodeRef = new WeakRef(value);
          }
        }
      } else {
        const emptyNode = this.dom.createText("");
        this.dom.replace(lastNode, emptyNode);
        lastNodeRef = new WeakRef(emptyNode);
      }
    };
  }

  public createEventBinding(eventName: string) {
    let prevListener: (e: Ev) => void;
    return (elem: Element, fn: (ev: Ev) => void) => {
      if (prevListener) {
        this.dom.off(elem, eventName, prevListener);
      }
      if (fn == null) {
        return;
      }
      this.dom.on(elem, eventName, fn);
      prevListener = fn;
    };
  }

  public createSimpleClassNameBinding() {
    let lastNames: string = "";
    return (
      elem: Element,
      cname: string | number | boolean | { [Symbol.toPrimitive](): any },
    ) => {
      this.dom.removeClassName(elem, lastNames);
      switch (typeof cname) {
        case "string":
          this.dom.addClassName(elem, cname);
          lastNames = cname;
          break;
        case "number":
          const name = String(cname);
          this.dom.addClassName(elem, name);
          lastNames = name;
          break;
        case "object":
          if (Symbol.toPrimitive in cname) {
            const name = String(cname);
            this.dom.addClassName(elem, name);
            lastNames = name;
            break;
          }
        default:
          lastNames = "";
      }
    };
  }

  public createConditionalClassNameBinding(cname: string) {
    return (elem: Element, condition: any) => {
      if (!!condition) {
        this.dom.addClassName(elem, cname);
      } else {
        this.dom.removeClassName(elem, cname);
      }
    };
  }

  public createDataBinding(dataName: string) {
    return (elem: Element, value: any) => {
      this.dom.setData(elem, dataName, value);
    };
  }

  public createStyleKeyBinding(stylekey: string) {
    return (elem: Element, value: string | undefined) => {
      this.dom.setStyle(elem, stylekey, value);
    };
  }

  public setStyle(
    elem: Element,
    value: Exclude<StyleDict, JSX.Signal<any>> | string | undefined,
  ) {
    if (typeof value !== "object") {
      this.dom.setAttributeOrProperty(elem, "style", value);
      return;
    }

    this.dom.clearStyle(elem);
    const entries = Object.entries(value);
    for (let i = 0; entries.length > i; i++) {
      const [key, v] = entries[i]!;
      if (SignalsReg.isSignal(v)) {
        const s = sigProxy(v);
        s.bindTo(elem, this.createStyleKeyBinding(key));
      } else {
        this.dom.setStyle(elem, key, v);
      }
    }
  }

  public createAttributeBinding(
    attributeName: string,
  ): (elem: Element, v: any) => void {
    if (attributeName === "class") {
      return this.setClassName.bind(this);
    }

    if (attributeName === "style") {
      return this.setStyle.bind(this);
    }

    if (attributeName.startsWith("data-")) {
      // data attributes can be set using the `dataset` Element property
      const dataName = attributeName.substring(5);
      return this.createDataBinding(dataName);
    }

    if (attributeName.startsWith("attribute:")) {
      const actualName = attributeName.substring(10);
      return (elem: Element, value: any) => {
        this.dom.setAttribute(elem, actualName, value);
      };
    }

    if (attributeName.startsWith("property:")) {
      const actualName = attributeName.substring(9);
      return (elem: Element, value: any) => {
        this.dom.setProperty(elem, actualName, value);
      };
    }

    return (elem: Element, value: any) => {
      this.dom.setAttributeOrProperty(elem, attributeName, value);
    };
  }
}
