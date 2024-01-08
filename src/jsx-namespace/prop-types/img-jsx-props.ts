import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ImgTagProps extends PropsForElement<HTMLImageElement> {
    }
  }
}
