import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface VideoTagProps extends PropsForElement<HTMLVideoElement> {
    }
  }
}
