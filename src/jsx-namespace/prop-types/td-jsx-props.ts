import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface TdTagProps extends PropsForElement<HTMLTableCellElement> {
      colspan?: string | number;
      headers?: string;
      rowspan?: string | number;
    }
  }
}

export {};
