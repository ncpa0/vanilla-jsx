export type Primitive = string | number | bigint | boolean | null | undefined;

export interface InteractionInterface<
  Element extends object,
  TextElement extends object,
  FragmentElement extends object,
  Ev extends object,
> {
  create(tag: string): Element;
  createText(content: Primitive): TextElement;
  createFragment(): FragmentElement;
  setAttribute(element: Element, name: string, value: Primitive): void;
  setClass(element: Element, value: string): void;
  addClassName(element: Element, ...value: string[]): void;
  removeClassName(element: Element, ...value: string[]): void;
  setData(element: Element, name: string, value: Primitive): void;
  setText(element: TextElement, value: Primitive): void;
  append(
    parent: Element | FragmentElement,
    child: Element | TextElement | FragmentElement,
  ): void;
  insertBefore(
    parent: Element | FragmentElement,
    child: Element | TextElement | FragmentElement,
    before: Element | TextElement | FragmentElement,
  ): void;
  replace(
    oldChild: Element | TextElement,
    newChild: Element | TextElement | FragmentElement,
  ): void;
  replaceAllChildren(
    parent: Element | FragmentElement,
    ...children: Array<Element | TextElement | FragmentElement>
  ): void;
  remove(child: Element | TextElement): void;
  hide(element: Element): void;
  on(
    element: Element,
    event: string,
    listener: (event: Ev) => void,
  ): void;
  once(
    element: Element,
    event: string,
    listener: (event: Ev) => void,
  ): void;
  off(
    element: Element,
    event: string,
    listener: (event: Ev) => void,
  ): void;
  parseUnsafe(
    content: string,
  ): Iterable<Element | TextElement | FragmentElement>;
  isFragment(
    element: Element | TextElement | FragmentElement,
  ): element is FragmentElement;
  isText(
    element: Element | TextElement | FragmentElement,
  ): element is TextElement;
}