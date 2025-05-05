import { Signal } from "../../signals";
import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface TextareaTagProps
      extends PropsForElement<HTMLTextAreaElement, { input?: string | number }>
    {
      boundSignal?: Signal<string> | Signal<boolean>;
    }
  }
}
