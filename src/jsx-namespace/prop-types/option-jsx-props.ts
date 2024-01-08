import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface OptionTagProps extends PropsForElement<HTMLOptionElement> {
    }
  }
}
