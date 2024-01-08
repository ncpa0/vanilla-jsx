import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface StyleTagProps extends PropsForElement<HTMLStyleElement> {
    }
  }
}

export {};
