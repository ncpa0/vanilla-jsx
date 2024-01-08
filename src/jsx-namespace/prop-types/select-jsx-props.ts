import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface SelectTagProps extends PropsForElement<HTMLSelectElement> {
    }
  }
}
