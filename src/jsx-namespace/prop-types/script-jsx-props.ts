import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ScriptTagProps extends PropsForElement<HTMLScriptElement> {
    }
  }
}
