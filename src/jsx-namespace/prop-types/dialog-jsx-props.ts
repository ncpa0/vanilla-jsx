import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface DialogTagProps extends PropsForElement<HTMLDialogElement> {
    }
  }
}
