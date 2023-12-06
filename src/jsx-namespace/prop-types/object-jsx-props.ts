import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface ObjectTagProps {
      data?: string;
      form?: string;
      height?: string | number;
      name?: string;
      type?: string;
      typemustmatch?: AttributeBool;
      usemap?: string;
      width?: string | number;
    }
  }
}
