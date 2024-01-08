import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface InsTagProps extends PropsForElement<HTMLModElement> {
    }
  }
}

export {};
