import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface OptionTagProps {
      disabled?: AttributeBool;
      label?: string;
      selected?: AttributeBool;
      value?: string;
    }
  }
}
