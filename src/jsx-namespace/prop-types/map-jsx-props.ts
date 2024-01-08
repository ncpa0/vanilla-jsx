import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface MapTagProps extends PropsForElement<HTMLMapElement> {
    }
  }
}

export {};
