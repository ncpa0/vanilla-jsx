import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface SelectTagProps {
      autofocus?: AttributeBool;
      disabled?: AttributeBool;
      form?: string;
      multiple?: AttributeBool;
      name?: string;
      required?: AttributeBool;
      size?: string | number;
    }
  }
}
