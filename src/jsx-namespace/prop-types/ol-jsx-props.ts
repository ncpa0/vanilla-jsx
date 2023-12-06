import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface OlTagProps {
      reversed?: AttributeBool;
      start?: string | number;
      type?: "1" | "A" | "a" | "I" | "i";
    }
  }
}
