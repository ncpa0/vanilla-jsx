import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface BlockquoteTagProps extends PropsForElement<HTMLQuoteElement> {
      cite?: string;
    }
  }
}

export {};
