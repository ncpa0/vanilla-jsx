import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface CanvasTagProps extends PropsForElement<HTMLCanvasElement> {
    }
  }
}

export {};
