import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ParamTagProps extends PropsForElement<HTMLParamElement> {
    }
  }
}

export {};
