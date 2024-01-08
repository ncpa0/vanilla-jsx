import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface LabelTagProps extends PropsForElement<HTMLLabelElement> {
    }
  }
}

export {};
