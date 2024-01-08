import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface DetailsTagProps extends PropsForElement<HTMLDetailsElement> {
    }
  }
}
