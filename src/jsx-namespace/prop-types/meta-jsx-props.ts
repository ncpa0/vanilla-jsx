declare global {
  namespace VanillaJSX {
    interface MetaTagProps {
      "http-equiv"?:
        | "content-security-policy"
        | "content-type"
        | "default-style"
        | "x-ua-compatible"
        | "refresh";
      charset?: string;
      content?: string;
      name?: string;
    }
  }
}

export {};