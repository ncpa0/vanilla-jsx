import { AttributeBool } from "./shared/bool";
import type { Target } from "./shared/target";

declare global {
  namespace VanillaJSX {
    interface FormTagProps {
      "accept-charset"?: string;
      action?: string;
      autocomplete?: "on" | "off";
      enctype?:
        | "application/x-www-form-urlencoded"
        | "multipart/form-data"
        | "text/plain";
      method?: "get" | "post";
      name?: string;
      novalidate?: AttributeBool;
      rel?:
        | "external"
        | "help"
        | "license"
        | "next"
        | "nofollow"
        | "noopener"
        | "noreferrer"
        | "opener"
        | "prev"
        | "search";
      target?: Target;
    }
  }
}
