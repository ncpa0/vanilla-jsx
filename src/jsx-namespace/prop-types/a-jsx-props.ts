import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface AnchorTagProps extends PropsForElement<HTMLAnchorElement> {
    }
  }
}

export {};
