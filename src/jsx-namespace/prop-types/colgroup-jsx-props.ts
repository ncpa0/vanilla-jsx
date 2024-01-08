import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ColgroupTagProps extends PropsForElement<HTMLTableColElement> {
    }
  }
}

export {};
