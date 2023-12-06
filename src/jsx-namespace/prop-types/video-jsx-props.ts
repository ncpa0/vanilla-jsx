import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface VideoTagProps {
      autoplay?: AttributeBool;
      controls?: AttributeBool;
      height?: string | number;
      loop?: AttributeBool;
      muted?: AttributeBool;
      poster?: string;
      preload?: "auto" | "metadata" | "none";
      src?: string;
      width?: string | number;
    }
  }
}
