import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface EmbedTagProps extends PropsForElement<HTMLEmbedElement> {
    }
  }
}

export {};
