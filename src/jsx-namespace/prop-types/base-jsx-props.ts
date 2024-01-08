import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface BaseTagProps extends PropsForElement<HTMLBaseElement> {
    }
  }
}
