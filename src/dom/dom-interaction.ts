import { htmlElementAttributes } from "html-element-attributes";
import { InteractionInterface, Primitive } from "./interaction-interface";

const ElementAttributes = new Map<string, string[]>();

for (const [key, value] of Object.entries(htmlElementAttributes)) {
  ElementAttributes.set(
    key.toUpperCase(),
    value.concat(htmlElementAttributes["*"]!),
  );
}

export class DomInteraction
  implements InteractionInterface<Element, Text, DocumentFragment, Event>
{
  private static domparser = new DOMParser();

  private toStr(value: Primitive): string {
    return value == null ? "" : String(value);
  }

  create(tag: string): HTMLElement {
    return document.createElement(tag);
  }

  createText(content: Primitive): Text {
    return document.createTextNode(this.toStr(content));
  }

  createFragment(): DocumentFragment {
    return document.createDocumentFragment();
  }

  append(
    parent: Element | DocumentFragment,
    child: Element | DocumentFragment | Text,
  ): void {
    parent.appendChild(child);
  }

  insertBefore(
    parent: Element | DocumentFragment,
    child: Element | DocumentFragment | Text,
    before: Element | DocumentFragment | Text,
  ): void {
    parent.insertBefore(child, before);
  }

  insertAfter(
    child: Element | DocumentFragment | Text,
    after: Element | DocumentFragment | Text,
  ): void {
    after.parentNode?.insertBefore(child, after.nextSibling);
  }

  replace(
    oldChild: Element | Text,
    newChild: Element | DocumentFragment | Text,
  ): void {
    oldChild.replaceWith(newChild);
  }

  replaceAllChildren(
    parent: Element | DocumentFragment,
    ...children: (Element | DocumentFragment | Text)[]
  ): void {
    parent.replaceChildren(...children);
  }

  remove(child: Element | Text): void {
    child.remove();
  }

  hide(element: Element): void {
    (element as HTMLElement).style.display = "none";
  }

  setAttribute(element: Element, name: string, value: Primitive): void {
    if (
      name === "value"
      && (element.tagName === "INPUT" || element.tagName === "TEXT_AREA")
    ) {
      (element as HTMLInputElement).value = this.toStr(value);
      return;
    }
    const possibleAttributeNames = ElementAttributes.get(element.tagName) ?? [];
    const isAttributeName = possibleAttributeNames.includes(name);

    if (isAttributeName) {
      if (value == null) {
        element.removeAttribute(name);
      } else {
        if (typeof value === "boolean") {
          if (value) {
            element.setAttribute(name, name);
          } else {
            element.removeAttribute(name);
          }
        } else {
          element.setAttribute(name, this.toStr(value));
        }
      }
    } else {
      if (name in element) {
        (element as any)[name] = value;
      } else {
        if (value == null) {
          element.removeAttribute(name);
        } else {
          element.setAttribute(name, this.toStr(value));
        }
      }
    }
  }

  setClass(element: Element, value: string): void {
    element.className = value;
  }

  addClassName(element: Element, ...value: string[]): void {
    element.classList.add(...value);
  }

  removeClassName(element: Element, ...value: string[]): void {
    element.classList.remove(...value);
  }

  setStyle(
    element: Element,
    styleKey: string,
    value: string | undefined,
  ): void {
    (element as any).style[styleKey] = value ?? "";
  }

  clearStyle(element: Element): void {
    (element as HTMLElement).style.cssText = "";
  }

  setData(element: Element, name: string, value: Primitive): void {
    if (value == null) {
      delete (element as HTMLElement).dataset[name];
      return;
    }

    (element as HTMLElement).dataset[name] = this.toStr(value);
  }

  setText(element: Text, value: Primitive): void {
    element.data = this.toStr(value);
  }

  on(element: Element, event: string, listener: (event: Event) => void): void {
    element.addEventListener(event, listener);
  }

  once(
    element: Element,
    event: string,
    listener: (event: Event) => void,
  ): void {
    element.addEventListener(event, listener, { once: true });
  }

  off(element: Element, event: string, listener: (event: Event) => void): void {
    element.removeEventListener(event, listener);
  }

  parseUnsafe(unsafehtml: string): Iterable<Element> {
    const tmp = DomInteraction.domparser.parseFromString(
      unsafehtml,
      "text/html",
    );
    return tmp.body.children as Iterable<Element>;
  }

  isFragment(
    element: Element | DocumentFragment | Text,
  ): element is DocumentFragment {
    return element instanceof DocumentFragment;
  }

  isText(element: Element | Text | DocumentFragment): element is Text {
    return element instanceof Text;
  }
}
