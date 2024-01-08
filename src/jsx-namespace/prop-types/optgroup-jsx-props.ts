import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface OptgroupTagProps extends PropsForElement<HTMLOptGroupElement> {
    }
  }
}
