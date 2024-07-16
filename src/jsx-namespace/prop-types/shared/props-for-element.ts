type LastLetter<T> = T extends `${string}${infer U}` ? U : never;

type BaseOverride = {
  style: any;
};

export type PropsForElement<T, Override = {}> = Override & {
  [K in keyof T as T[K] extends Function
    ? never
    : K extends keyof Override
      ? never
      : K extends keyof BaseOverride
        ? never
        : K extends "children"
          ? never
          : LastLetter<K> extends Capitalize<LastLetter<K>>
            ? never
            : K]?: T[K];
};
