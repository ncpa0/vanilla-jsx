import { beforeAll, describe, expect, it } from "vitest";
import {
  InteractionInterface,
  Primitive,
} from "../src/dom/interaction-interface";
import { Fragment, jsx } from "../src/index";
import { setInteractionInterface } from "../src/reconciler/reconciler";

class CustomFragment {
  parent?: CustomElement | CustomFragment;
  children: Array<CustomElement | CustomTextNode | CustomFragment> = [];

  append(child: CustomElement | CustomTextNode | CustomFragment) {
    this.children.push(child);
    child.parent = this;
  }

  replaceChild(
    newChild: CustomElement | CustomTextNode | CustomFragment,
    oldChild: CustomElement | CustomTextNode | CustomFragment,
  ) {
    const index = this.children.indexOf(oldChild);
    if (index !== -1) {
      this.children[index]!.parent = undefined;
      this.children[index] = newChild;
      newChild.parent = this;
    }
  }
}

class CustomElement extends CustomFragment {
  attributes: Array<[string, string]> = [];
  listeners: Array<[string, (event: CustomEvent) => void]> = [];
  dataset: Record<string, string> = {};
  classNames = new Set<string>();
  isHidden = false;
  style: Record<string, string> = {};

  constructor(public readonly tagName: string) {
    super();
  }

  setAttribute(name: string, value: string) {
    this.attributes.push([name, value]);
  }

  removeAttribute(name: string) {
    this.attributes = this.attributes.filter(([key]) => key !== name);
  }

  addEventListener(name: string, listener: (event: CustomEvent) => void) {
    this.listeners.push([name, listener]);
  }

  removeEventListener(name: string, listener: (event: CustomEvent) => void) {
    this.listeners = this.listeners.filter(
      ([key, value]) => key !== name || value !== listener,
    );
  }

  setData(key: string, value: string) {
    this.dataset[key] = value;
  }

  deleteData(key: string) {
    delete this.dataset[key];
  }

  addClassNames(classNames: string[]) {
    for (const className of classNames) {
      this.classNames.add(className);
    }
  }

  removeClassNames(classNames: string[]) {
    for (const className of classNames) {
      this.classNames.delete(className);
    }
  }

  setClassName(value: string) {
    this.classNames = new Set(value.split(" ").filter(Boolean));
  }
}

class CustomTextNode {
  parent?: CustomElement | CustomFragment;
  constructor(public content: string) {}
}

class CustomEvent {}

class CustomInteractions
  implements
    InteractionInterface<
      CustomElement,
      CustomTextNode,
      CustomFragment,
      CustomEvent
    >
{
  create(tag: string): CustomElement {
    return new CustomElement(tag);
  }

  createText(content: Primitive): CustomTextNode {
    return new CustomTextNode(String(content));
  }

  createFragment(): CustomFragment {
    return new CustomFragment();
  }

  append(
    parent: CustomFragment | CustomElement,
    child: CustomFragment | CustomElement | CustomTextNode,
  ): void {
    parent.append(child);
  }

  remove(child: CustomElement | CustomTextNode): void {
    const parent = child.parent;
    if (parent) {
      parent.replaceChild(this.createFragment(), child);
    }
  }

  replace(
    oldChild: CustomElement | CustomTextNode,
    newChild: CustomElement | CustomFragment | CustomTextNode,
  ): void {
    const parent = oldChild.parent;
    if (parent) {
      parent.replaceChild(newChild, oldChild);
    }
  }

  setText(element: CustomTextNode, value: Primitive): void {
    element.content = String(value);
  }

  setClass(element: CustomElement, value: string): void {
    element.setClassName(value);
  }

  addClassName(element: CustomElement, ...value: string[]): void {
    element.addClassNames(value);
  }

  removeClassName(element: CustomElement, ...value: string[]): void {
    element.removeClassNames(value);
  }

  setAttributeOrProperty(
    element: CustomElement,
    name: string,
    value: Primitive,
  ): void {
    this.setAttribute(element, name, value);
  }

  setProperty(element: CustomElement, name: string, value: Primitive): void {
    this.setAttribute(element, name, value);
  }

  setAttribute(element: CustomElement, name: string, value: Primitive): void {
    if (value == null) {
      element.removeAttribute(name);
      return;
    }
    element.setAttribute(name, String(value));
  }

  setData(element: CustomElement, name: string, value: Primitive): void {
    if (value == null) {
      element.deleteData(name);
      return;
    }
    element.setData(name, String(value));
  }

  on(
    element: CustomElement,
    event: string,
    listener: (event: CustomEvent) => void,
  ): void {
    element.addEventListener(event, listener);
  }

  once(
    element: CustomElement,
    event: string,
    listener: (event: CustomEvent) => void,
  ): void {
    element.addEventListener(event, listener);
  }

  off(
    element: CustomElement,
    event: string,
    listener: (event: CustomEvent) => void,
  ): void {
    element.removeEventListener(event, listener);
  }

  parseUnsafe(
    content: string,
  ): Iterable<CustomElement | CustomTextNode | CustomFragment> {
    return [];
  }

  isText(
    element: CustomTextNode | CustomElement | CustomFragment,
  ): element is CustomTextNode {
    return element instanceof CustomTextNode;
  }

  isFragment(
    element: CustomElement | CustomFragment | CustomTextNode,
  ): element is CustomFragment {
    return element instanceof CustomFragment;
  }

  hide(element: CustomElement): void {
    element.isHidden = true;
  }

  replaceAllChildren(
    parent: CustomElement | CustomFragment,
    ...children: (CustomElement | CustomFragment | CustomTextNode)[]
  ): void {
    for (const child of parent.children) {
      child.parent = undefined;
    }
    parent.children = children;
    for (const child of children) {
      child.parent = parent;
    }
  }

  insertBefore(
    parent: CustomElement | CustomFragment,
    child: CustomElement | CustomTextNode | CustomFragment,
    before: CustomElement | CustomTextNode | CustomFragment,
  ): void {
    const index = parent.children.indexOf(before);
    if (index !== -1) {
      parent.children.splice(index, 0, child);
      child.parent = parent;
    }
  }

  clearStyle(element: CustomElement): void {
    element.style = {};
  }

  insertAfter(
    child: CustomElement | CustomTextNode | CustomFragment,
    after: CustomElement | CustomTextNode | CustomFragment,
  ): void {
    const parent = after.parent;
    if (parent) {
      const index = parent.children.indexOf(after);
      if (index !== -1) {
        parent.children.splice(index + 1, 0, child);
        child.parent = parent;
      }
    }
  }

  setStyle(
    element: CustomElement,
    styleKey: string,
    value: string | undefined,
  ): void {
    if (value == null) {
      delete element.style[styleKey];
      return;
    }
    element.style[styleKey] = value;
  }
}

describe("correctly works with a custom InteractionInterface", () => {
  beforeAll(() => {
    setInteractionInterface(new CustomInteractions());
  });

  it("should render a simple element", () => {
    const element = <div />;
    expect(element).toEqual(new CustomElement("div"));
    expect(element).toMatchSnapshot();
  });

  it("should render a more complex element structure", () => {
    const element = (
      <div id="root" draggable>
        <p class="header text">Hello</p>
        <>
          <span data-foo="1">World</span>
        </>
      </div>
    );

    const root = new CustomElement("div");
    root.attributes = [
      ["id", "root"],
      ["draggable", "true"],
    ];
    const paragraph = new CustomElement("p");
    paragraph.classNames = new Set(["header", "text"]);
    paragraph.append(new CustomTextNode("Hello"));
    root.append(paragraph);
    const fragment = new CustomFragment();
    const span = new CustomElement("span");
    span.dataset = { foo: "1" };
    span.append(new CustomTextNode("World"));
    fragment.append(span);
    root.append(fragment);

    expect(element).toEqual(root);
    expect(element).toMatchSnapshot();
  });
});
