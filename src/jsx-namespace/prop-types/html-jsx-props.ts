import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface HtmlTagProps extends PropsForElement<HTMLHtmlElement> {
    }
  }
}

export {};
