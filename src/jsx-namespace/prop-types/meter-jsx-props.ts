import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface MeterTagProps extends PropsForElement<HTMLMeterElement> {
    }
  }
}

export {};
