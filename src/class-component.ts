import {
  ClassComponentInit,
  GetElement,
  Reconciler,
} from "./reconciler/reconciler";

export abstract class ClassComponent<P extends object> {
  protected readonly props: Readonly<P>;
  protected readonly reconciler: Reconciler;

  constructor(props: P, init: ClassComponentInit) {
    this.props = props as P;
    this.reconciler = init.reconciler;
  }

  abstract render(): GetElement;
}

Object.defineProperty(ClassComponent.prototype, "__isClassComponent", {
  value: true,
  writable: false,
  configurable: false,
  enumerable: false,
});
