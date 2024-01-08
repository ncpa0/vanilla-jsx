import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface QTagProps extends PropsForElement<HTMLQuoteElement> {
    }
  }
}

export {};
