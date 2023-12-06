import { AttributeBool } from "./shared/bool";
import type { RefererPolicy } from "./shared/referer-policy";

declare global {
  namespace VanillaJSX {
    interface ImgTagProps {
      alt?: string;
      crossorigin?: "anonymous" | "use-credentials";
      height?: string | number;
      ismap?: AttributeBool;
      loading?: "eager" | "lazy";
      longdesc?: string;
      referrerpolicy?: RefererPolicy;
      sizes?: string;
      src?: string;
      srcset?: string;
      usemap?: string;
      width?: string | number;
    }
  }
}
