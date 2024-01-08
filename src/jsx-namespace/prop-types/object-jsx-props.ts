import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ObjectTagProps extends PropsForElement<HTMLObjectElement> {
    }
  }
}
