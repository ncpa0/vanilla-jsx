import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ProgressTagProps extends PropsForElement<HTMLProgressElement> {
    }
  }
}

export {};
