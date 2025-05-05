type LastLetter<T> = T extends `${string}${infer U}` ? U : never;

type BaseOverride = {
  style: any;
};

export type PropsForElement<T, Override = {}> =
  & Override
  & EvCallbacksForElement<T>
  & {
    [
      K in keyof T as K extends `on${string}` ? never
        : T[K] extends Function ? never
        : K extends keyof Override ? never
        : K extends keyof BaseOverride ? never
        : K extends "children" ? never
        : LastLetter<K> extends Capitalize<LastLetter<K>> ? never
        : K
    ]?: T[K];
  };

type EvCallbacksForElement<T> = {
  [
    K in keyof T as K extends `on${string}` ? K : never
  ]?: NonNullable<T[K]> extends (this: infer Th, ev: infer Ev) => infer Ret
    ? ((this: Th, ev: Ev & { target: T }) => Ret) | null
    : T[K];
};
