import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface TextareaTagProps {
      autofocus?: AttributeBool;
      cols?: string | number;
      dirname?: string;
      disabled?: AttributeBool;
      form?: string;
      maxlength?: string | number;
      name?: string;
      placeholder?: string;
      readonly?: AttributeBool;
      required?: AttributeBool;
      rows?: string | number;
      wrap?: "hard" | "soft";
    }
  }
}
