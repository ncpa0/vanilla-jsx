declare global {
  namespace VanillaJSX {
    interface TdTagProps {
      colspan?: string | number;
      headers?: string;
      rowspan?: string | number;
    }
  }
}

export {};
