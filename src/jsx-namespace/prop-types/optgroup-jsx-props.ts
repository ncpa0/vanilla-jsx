import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface OptgroupTagProps {
      disabled?: AttributeBool;
      label?: string;
    }
  }
}
