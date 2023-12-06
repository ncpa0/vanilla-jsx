import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface DialogTagProps {
      open?: AttributeBool;
    }
  }
}
