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
  private UnsafeHtmlParser = class {
    private static prepareHtml;

    static {
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

      this.prepareHtml = prepareHtmlFactory();
    }

    public static parseHtml(
      unsafehtml: string,
    ): Iterable<Element> {
      const html = this.prepareHtml(unsafehtml);
      const tmp = document.createElement("div");
      tmp.innerHTML = html;
      return tmp.childNodes as Iterable<Element>;
    }
  };

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

  replace(
    oldChild: Element | Text,
    newChild: Element | DocumentFragment | Text,
  ): void {
    oldChild.replaceWith(newChild);
  }

  remove(
    child: Element | Text,
  ): void {
    child.remove();
  }

  setAttribute(
    element: Element,
    name: string,
    value: Primitive,
  ): void {
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

  setData(
    element: Element,
    name: string,
    value: Primitive,
  ): void {
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

  parseUnsafe(content: string): Iterable<Element> {
    return this.UnsafeHtmlParser.parseHtml(content);
  }

  isFragment(
    element: Element | DocumentFragment | Text,
  ): element is DocumentFragment {
    return element instanceof DocumentFragment;
  }
}
