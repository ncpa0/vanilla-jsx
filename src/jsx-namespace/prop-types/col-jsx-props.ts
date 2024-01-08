import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ColTagProps extends PropsForElement<HTMLTableColElement> {
    }
  }
}

export {};
