import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface LiTagProps extends PropsForElement<HTMLLIElement> {
    }
  }
}

export {};
