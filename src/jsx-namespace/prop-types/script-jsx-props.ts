import { AttributeBool } from "./shared/bool";
import type { Crossorigin } from "./shared/crossorigin";
import type { RefererPolicy } from "./shared/referer-policy";

declare global {
  namespace VanillaJSX {
    interface ScriptTagProps {
      async?: AttributeBool;
      crossorigin?: Crossorigin;
      defer?: AttributeBool;
      integrity?: string;
      nomodule?: "True" | "False";
      referrerpolicy?: RefererPolicy;
      src?: string;
      type?: string;
    }
  }
}
