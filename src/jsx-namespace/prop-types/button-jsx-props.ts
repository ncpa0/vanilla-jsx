import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface ButtonTagProps {
      autofocus?: AttributeBool;
      disabled?: AttributeBool;
      form?: string;
      formaction?: string;
      formenctype?: string;
      formmethod?: string;
      formnovalidate?: string;
      formtarget?: string;
      name?: string;
      type?: "button" | "reset" | "submit";
      value?: string;
    }
  }
}
