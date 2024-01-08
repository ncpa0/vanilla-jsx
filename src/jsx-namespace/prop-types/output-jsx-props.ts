import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface OutputTagProps extends PropsForElement<HTMLOutputElement> {
    }
  }
}

export {};
