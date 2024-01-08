import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface BdoTagProps extends PropsForElement<HTMLElement> {
    }
  }
}

export {};
