import { InteractionInterface } from "../dom/interaction-interface";
import { ClassName } from "../jsx-namespace/jsx.types";
import {
  SignalProxyListenerRef,
  SignalsReg,
  sigProxy,
} from "../sig-proxy/_proxy";
import { VanillaJSXReconcilerError } from "./reconciller-error";
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

  private assertNotFragment<T>(
    elem: T,
  ): asserts elem is T {
    if (this.dom.isFragment(elem as any)) {
      throw new VanillaJSXReconcilerError(
        "Fragment cannot be placed into an element via signals since Fragments are not replaceable.",
      );
    }
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
                const names = cname.split(" ").filter(Boolean);
                this.dom.addClassName(elem, ...names);
                break;
              case "number":
                this.dom.addClassName(elem, String(cname));
                break;
              case "object":
                if (cname != null) {
                  const signal = sigProxy(cname);
                  signal.bindTo(elem, this.createSimpleClassNameBinding());
                }
                break;
            }
          }
          return;
        }
        if (SignalsReg.isSignal(value)) {
          const signal = sigProxy(value);
          signal.bindTo(elem, this.setClassName.bind(this));
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
      value: MaybeArray<TextElement | Element | undefined>,
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
        if (Array.isArray(value)) {
          const [firstNode] = value;
          if (firstNode) {
            this.assertNotFragment(firstNode);

            const fragment = this.dom.createFragment();
            this.dom.append(fragment, firstNode);
            lastNodeRef = new WeakRef(firstNode);

            for (let i = 1; i < value.length; i++) {
              const node: TextElement | Element | undefined = value[i];
              this.assertNotFragment(node);

              if (node) {
                this.dom.append(fragment, node);
                rest.push(new WeakRef(node));
              }
            }

            this.dom.replace(lastNode, fragment);
          } else {
            const emptyNode = this.dom.createText("");
            this.dom.replace(lastNode, emptyNode);
            lastNodeRef = new WeakRef(emptyNode);
          }
        } else {
          this.assertNotFragment(value);
          this.dom.replace(lastNode, value);
          lastNodeRef = new WeakRef(value);
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
    let lastNames: string[] = [];
    return (elem: Element, cname: string | number | boolean) => {
      this.dom.removeClassName(elem, ...lastNames);
      switch (typeof cname) {
        case "string":
          const names = cname.split(" ").filter(Boolean);
          this.dom.addClassName(elem, ...names);
          lastNames = names;
          break;
        case "number":
          const name = String(cname);
          this.dom.addClassName(elem, name);
          lastNames = [name];
          break;
        default:
          lastNames.splice(0, lastNames.length);
      }
    };
  }

  public createConditionalClassNameBinding(cname: string) {
    const names = cname.split(" ").filter(Boolean);
    return (elem: Element, condition: any) => {
      if (!!condition) {
        this.dom.addClassName(elem, ...names);
      } else {
        this.dom.removeClassName(elem, ...names);
      }
    };
  }

  public createDataBinding(dataName: string) {
    return (elem: Element, value: any) => {
      this.dom.setData(elem, dataName, value);
    };
  }

  public createAttributeBinding(attributeName: string) {
    if (attributeName === "class") {
      return this.setClassName.bind(this);
    }

    if (attributeName.includes("data-")) {
      // data attributes can be set using the `dataset` Element property
      const dataName = attributeName.substring(5);
      return this.createDataBinding(dataName);
    }

    return (elem: Element, value: any) => {
      this.dom.setAttribute(elem, attributeName, value);
    };
  }
}