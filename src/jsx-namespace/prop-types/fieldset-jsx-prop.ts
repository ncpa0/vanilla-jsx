import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface FieldsetTagProps {
      disabled?: AttributeBool;
      form?: string;
      name?: string;
    }
  }
}
