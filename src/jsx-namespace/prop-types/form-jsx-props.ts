import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface FormTagProps extends PropsForElement<HTMLFormElement> {
    }
  }
}
