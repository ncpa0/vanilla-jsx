import { AttributeBool } from "./shared/bool";

declare global {
  namespace VanillaJSX {
    interface TrackTagProps {
      default?: AttributeBool;
      kind?:
        | "captions"
        | "chapters"
        | "descriptions"
        | "metadata"
        | "subtitles";
      label?: string;
      src?: string;
      srclang?: string;
    }
  }
}
