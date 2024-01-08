import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ButtonTagProps extends PropsForElement<HTMLButtonElement> {
    }
  }
}
