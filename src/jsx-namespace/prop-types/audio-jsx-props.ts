import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface AudioTagProps extends PropsForElement<HTMLAudioElement> {
    }
  }
}
