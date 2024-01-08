import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface IframeTagProps extends PropsForElement<HTMLIFrameElement> {
    }
  }
}

export {};
