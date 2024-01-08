import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface DataTagProps extends PropsForElement<HTMLDataElement> {
    }
  }
}

export {};
