import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface TimeTagProps extends PropsForElement<HTMLTimeElement> {
    }
  }
}

export {};
