import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface DetailsTagProps {
      open?: AttributeBool;
    }
  }
}
