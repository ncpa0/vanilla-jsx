import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface InputTagProps extends PropsForElement<HTMLInputElement, { value?: string | number }> {
    }
  }
}
