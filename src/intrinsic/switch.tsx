import { jsx } from "../create-element";
import { createEmptyElem } from "../create-empty-elem";
import { sigProxy } from "../signals/proxy";

export type SwitchProps<T> = {
  value: JSX.Signal<T>;
  children: (cases: CaseBuilder<T>) => void;
  into?: Element;
  noclass?: boolean;
};

function isFunctionMatcher<T>(v: T | ((value: T) => boolean)): v is (value: T) => boolean {
  return typeof v === "function";
}

class CaseBuilder<T> {
  private cases: Array<[T | ((value: T) => boolean), () => JSX.Element]> = [];

  constructor() {}

  match(
    matcher: T | ((value: T) => boolean),
    render: () => JSX.Element,
  ): CaseBuilder<T> {
    this.cases.push([matcher, render]);
    return this;
  }

  default(render: () => JSX.Element): CaseBuilder<T> {
    this.cases.push([() => true, render]);
    return this;
  }

  static findCase<T>(v: T, builder: CaseBuilder<T>): undefined | (() => JSX.Element) {
    for (let i = 0; i < builder.cases.length; i++) {
      const [matcher, render] = builder.cases[i]!;
      if (isFunctionMatcher(matcher)) {
        if (matcher(v)) {
          return render;
        }
      } else if (Object.is(matcher, v)) {
        return render;
      }
    }

    return undefined;
  }
}

function childBindingFactory<T>(builder: CaseBuilder<T>) {
  const emptyFragment = createEmptyElem();
  return (element: Element, v: T) => {
    const matchingCase = CaseBuilder.findCase(v, builder);
    const newChild = matchingCase ? matchingCase() : emptyFragment;
    element.replaceChildren(newChild);
  };
}

/**
 * @example
 * enum MyEnum {
 *  A, B, C
 * }
 *
 * <Switch
 *   value={MyEnum.A}
 * >
 *   {(sw) =>
 *      sw
 *        .match(MyEnum.A, () => <div>Case A</div>)
 *        .match(MyEnum.B, () => <div>Case B</div>)
 *        .default(() => <div>Default case</div>)}
 * </Switch>
 */
export const Switch = <T,>(props: SwitchProps<T>): JSX.Element => {
  const collectCases: typeof props.children = Array.isArray(props.children) ? props.children[0] : props.children;

  const parent = props.into || <div />;
  if (!props.noclass) {
    parent.classList.add("vjsx-switch-container");
  }

  const builder = new CaseBuilder<T>();

  // collect cases
  collectCases(builder);

  const s = sigProxy(props.value);
  s.bindTo(parent, childBindingFactory(builder));

  return parent;
};
