import type { Target } from "./shared/target";

declare global {
  namespace VanillaJSX {
    interface BaseTagProps {
      href?: string;
      target?: Target;
    }
  }
}
