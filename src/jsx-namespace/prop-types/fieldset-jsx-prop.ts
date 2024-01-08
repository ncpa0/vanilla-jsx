import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface FieldsetTagProps extends PropsForElement<HTMLFieldSetElement> {
    }
  }
}
