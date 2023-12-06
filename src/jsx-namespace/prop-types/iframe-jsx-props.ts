import { AttributeBool } from "./shared/bool";
import type { RefererPolicy } from "./shared/referer-policy";

declare global {
  namespace VanillaJSX {
    interface IframeTagProps {
      allow?: string;
      allowfullscreen?: AttributeBool;
      allowpaymentrequest?: AttributeBool;
      height?: string | number;
      loading?: "eager" | "lazy";
      name?: string;
      referrerpolicy?: RefererPolicy;
      sandbox?:
        | "allow-forms"
        | "allow-pointer-lock"
        | "allow-popups"
        | "allow-same-origin"
        | "allow-scripts"
        | "allow-top-navigation";
      src?: string;
      srcdoc?: string;
      width?: string | number;
    }
  }
}

export {};
