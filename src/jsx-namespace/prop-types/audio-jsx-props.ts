import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface AudioTagProps {
      autoplay?: AttributeBool;
      controls?: AttributeBool;
      loop?: AttributeBool;
      muted?: AttributeBool;
      preload?: "auto" | "metadata" | "none";
      src?: string;
    }
  }
}
