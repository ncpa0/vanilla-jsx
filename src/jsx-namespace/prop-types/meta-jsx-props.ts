import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface MetaTagProps extends PropsForElement<HTMLMetaElement> {
    }
  }
}

export {};
