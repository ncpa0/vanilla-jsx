import { PropsForElement } from "./shared/props-for-element";

declare global {
  namespace VanillaJSX {
    interface ThTagProps extends PropsForElement<HTMLTableCellElement> {
      abbr?: string;
      colspan?: string | number;
      headers?: string;
      rowspan?: string | number;
      scope?: "col" | "colgroup" | "row" | "rowgroup";
    }
  }
}

export {};
