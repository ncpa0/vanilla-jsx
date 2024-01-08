import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface OlTagProps extends PropsForElement<HTMLOListElement> {
    }
  }
}
