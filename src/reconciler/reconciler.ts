import { DomInteraction } from "../dom/dom-interaction";
import { InteractionInterface } from "../dom/interaction-interface";
import { PropsForElement } from "../jsx-namespace/prop-types/shared/props-for-element";
import { SignalsReg, sigProxy } from "../sig-proxy/_proxy";
import { VSignal } from "../signals/signal";
import { BindingFactories } from "./factories";
import { asArray } from "./utils";

declare global {
  namespace VanillaJSX {
    interface Types {}
  }
}

export type GetElement = VanillaJSX.Types extends
  { Element: infer T extends object } ? T
  : Element;
export type GetTextElement = VanillaJSX.Types extends
  { TextElement: infer T extends object } ? T
  : Text;
export type GetFragmentElement = VanillaJSX.Types extends
  { FragmentElement: infer T extends object } ? T
  : DocumentFragment;
export type GetEvent = VanillaJSX.Types extends { Ev: infer T extends object }
  ? T
  : Event;

type FunctionComponent = (props: object) => JSX.Element;

type ElementProps = {
  [k: string]: any;
  children?: JSX.Children;
  unsafeHTML?: boolean;
};

type ChildElement =
  | GetElement
  | GetTextElement
  | GetFragmentElement
  | JSX.Signal<GetElement | GetTextElement | undefined>;

export class Reconciler {
  private static instance?: Reconciler;

  public static setInteractionInterface(
    interaction: InteractionInterface<
      any,
      any,
      any,
      any
    >,
  ) {
    Reconciler.instance = new Reconciler(interaction);
  }

  public static getInstance() {
    if (!Reconciler.instance) {
      Reconciler.instance = new Reconciler(new DomInteraction());
    }
    return Reconciler.instance;
  }

  public static interactions(): InteractionInterface<
    GetElement,
    GetTextElement,
    GetFragmentElement,
    GetEvent
  > {
    return Reconciler.getInstance().dom;
  }

  private factories;
  constructor(
    private dom: InteractionInterface<
      GetElement,
      GetTextElement,
      GetFragmentElement,
      GetEvent
    >,
  ) {
    this.factories = new BindingFactories(this.dom);
  }

  private appendEmptyTextRef(appendTo: Element) {
    const initialChild = this.dom.createText("");
    this.dom.append(appendTo, initialChild);
    return new WeakRef(initialChild);
  }

  private mapChildren(
    children: Exclude<JSX.Children, JSX.Element | JSX.VanillaValue>,
    accumulator: Array<ChildElement>,
    unsafe?: boolean,
  ) {
    for (let i = 0; i < children.length; i++) {
      const child = children[i];

      switch (typeof child) {
        case "string":
          if (unsafe) {
            const nodes = this.dom.parseUnsafe(child);
            for (const node of nodes) {
              accumulator.push(node);
            }
          } else {
            accumulator.push(this.dom.createText(child));
          }
          break;
        case "number":
        case "bigint":
          accumulator.push(this.dom.createText(child));
        case "boolean":
        case "undefined":
          break;
        case "object":
          if (child === null) {
            break;
          }
          if (Array.isArray(child)) {
            this.mapChildren(child, accumulator);
          } else {
            accumulator.push(child);
          }
          break;
      }
    }
  }

  public bindProps<O extends Record<string, any>>(
    element: Element,
    props: JSX.HTMLProps<PropsForElement<Element> & O>,
  ) {
    for (const [propName, propValue] of Object.entries(props)) {
      if (propName === "children" || propName === "unsafeHTML") {
        continue;
      }

      if (propName === "boundSignal") {
        if (!(propValue instanceof VSignal)) {
          console.error("incorrect value provided to the 'boundSignal'");
          continue;
        }

        if (element.tagName === "INPUT" || element.tagName === "TEXTAREA") {
          this.factories.createInputBound(
            element,
            propValue,
            props.type === "checkbox",
          );
        }

        continue;
      }

      if (
        typeof propValue === "object"
        && propValue !== null
        && SignalsReg.isSignal(propValue)
      ) {
        const sig = sigProxy(propValue);

        if (propName.startsWith("on")) {
          const eventName = propName.substring(2).toLowerCase();
          sig.bindTo(element, this.factories.createEventBinding(eventName));
        } else {
          sig.bindTo(
            element,
            this.factories.createAttributeBinding(propName),
          );
        }
      } else {
        if (propName.startsWith("on")) {
          const eventName = propName.substring(2).toLowerCase();
          this.factories.createEventBinding(eventName)(element, propValue);
        } else {
          this.factories.createAttributeBinding(propName)(element, propValue);
        }
      }
    }
  }

  public bindChildren(element: Element, children: ChildElement[]) {
    for (const child of children) {
      if (SignalsReg.isSignal(child)) {
        const sig = sigProxy(child);
        let initialNodeRef = this.appendEmptyTextRef(element);
        sig.bindTo(element, this.factories.createChildBinding(initialNodeRef));
      } else {
        this.dom.append(element, child);
      }
    }
  }

  public createElement(
    tag: string | FunctionComponent,
    props: ElementProps | undefined,
    ...children: Exclude<JSX.Children, JSX.Element | JSX.VanillaValue>
  ) {
    if (typeof tag === "function") {
      const forwardedProps = props ?? {};
      if (children.length > 0) {
        forwardedProps.children = children;
      }
      return tag(forwardedProps);
    }

    children = children.length > 0
      ? children
      : props
      ? asArray(props?.children)
      : [];

    const childNodes: Array<ChildElement> = [];

    this.mapChildren(children, childNodes, props?.unsafeHTML);

    if (tag === "") {
      const fragment = this.dom.createFragment();
      for (const child of childNodes) {
        if (SignalsReg.isSignal(child)) {
          throw new Error("Signals cannot be used as children of fragments.");
        }
        this.dom.append(fragment, child);
      }
      return fragment as any;
    }

    const element = this.dom.create(tag);

    if (props) {
      this.bindProps(element, props);
    }

    this.bindChildren(element, childNodes);

    return element;
  }
}

/**
 * Bind the given props to an HTML Element similarly to how props are
 * bound when creating an element using the JSX syntax.
 *
 * @example
 * const div = document.createElement("div");
 * bindProps(div, {
 *   class: ["foo", "bar", sig("baz")],
 *   styles: { backgroundColor: "red" },
 *   title: sig("Lorem ipsum"),
 * });
 */
export const bindProps: Reconciler["bindProps"] = (...args) =>
  Reconciler.getInstance().bindProps(...args);

/**
 * Bind the given children to an HTML Element similarly to how they are
 * bound when creating an element using the JSX syntax.
 *
 * @example
 * const div = document.createElement("div");
 * bindChildren(div, [
 *   "Hello",
 *   document.createElement("span"),
 *   sig(["foo", "bar"]),
 * ]);
 */
export const bindChildren: Reconciler["bindChildren"] = (...args) =>
  Reconciler.getInstance().bindChildren(...args);

export const createElement: Reconciler["createElement"] = (...args) =>
  Reconciler.getInstance().createElement(...args);

export const setInteractionInterface:
  (typeof Reconciler)["setInteractionInterface"] = (arg) =>
    Reconciler.setInteractionInterface(arg);

const Fragment = "";

export { createElement as jsx, createElement as jsxs, Fragment };
