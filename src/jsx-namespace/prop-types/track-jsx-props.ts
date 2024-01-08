import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface TrackTagProps extends PropsForElement<HTMLTrackElement> {
    }
  }
}
