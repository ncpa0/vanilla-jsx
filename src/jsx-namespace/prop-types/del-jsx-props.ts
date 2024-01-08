import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface DelTagProps extends PropsForElement<HTMLModElement> {
    }
  }
}

export {};
