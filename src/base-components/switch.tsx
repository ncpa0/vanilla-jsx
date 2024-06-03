import { jsx } from "../reconciler/reconciler";
import { sigProxy } from "../signals/proxy";

export type SwitchProps<T> = {
  value: JSX.Signal<T>;
  /**
   * Children must be `Case` elements.
   */
  children: JSX.Element[];
  /** Parent element to use, if not provided a empty div will be created and used. */
  into?: Element;
  /**
   * Don't add the default class name to the parent element. 
   * (`vjsx-switch-container`)
   */
  noclass?: boolean;
};

export type CaseRenderFn<T> = (matchedValue: T) => JSX.Element;

function isFunctionMatcher<T>(v: T | ((value: T) => boolean)): v is (value: T) => boolean {
  return typeof v === "function";
}

export function createEmptyElem() {
  const elem = document.createElement("div");
  elem.style.display = "none";
  return elem;
}

class CaseBuilder<T> {
  private cases: Array<[T | ((value: T) => boolean), CaseRenderFn<T>]> = [];

  constructor() {}

  match(
    matcher: T | ((value: T) => boolean),
    render: CaseRenderFn<T>,
  ): CaseBuilder<T> {
    this.cases.push([matcher, render]);
    return this;
  }

  default(render: CaseRenderFn<T>): CaseBuilder<T> {
    this.cases.push([() => true, render]);
    return this;
  }

  static findCase<T>(v: T, builder: CaseBuilder<T>): undefined | (CaseRenderFn<T>) {
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
    const newChild = matchingCase ? matchingCase(v) : emptyFragment;
    element.replaceChildren(newChild);
  };
}

export type CaseProps<T = unknown> =
  & {
    /**
     *  A function that will return element to be rendered when the case is matched.
     */
    children: CaseRenderFn<T>;
    /**
     * Don't add the default class name to the parent element.
     * (`vjsx-switch-case`)
     */
    noclass?: boolean;
    /**
     * Parent element to use, if not provided a empty div will be created and used.
     */
    into?: Element;
  }
  & ({
    /**
     * A value or a function that will be used to match the value of the switch.
     */
    match: T | ((value: T) => boolean);
  } | {
    default: true;
  });

export const Case = <T,>(props: CaseProps<T>): JSX.Element => {
  const parent = props.into || <div />;
  if (!props.noclass) {
    parent.classList.add("vjsx-switch-case");
  }
  Object.defineProperty(parent, "__vjsx_case_data", {
    value: {
      ...props,
      children: Array.isArray(props.children)
        ? props.children[0]!
        : props.children,
    },
  });
  return parent;
};

/**
 * @example
 * enum MyEnum {
 *  A, B, C
 * }
 *
 * <Switch
 *   value={MyEnum.A}
 * >
 *   <Case match={MyEnum.A}>
 *     {() => <div>Case A</div>}
 *   </Case>
 *   <Case match={MyEnum.B}>
 *     {() => <div>Case B</div>}
 *   </Case>
 *   <Case default>
 *     {() => <div>Default case</div>}
 *   </Case>
 * </Switch>
 */
export const Switch = <T,>(props: SwitchProps<T>): JSX.Element => {
  const parent = props.into || <div />;
  if (!props.noclass) {
    parent.classList.add("vjsx-switch-container");
  }

  const builder = new CaseBuilder<T>();

  for (let i = 0; i < props.children.length; i++) {
    const child = props.children[i]! as { __vjsx_case_data?: CaseProps<T> };

    if ("__vjsx_case_data" in child) {
      const caseData = child.__vjsx_case_data!;

      if ("default" in caseData) {
        builder.default(caseData.children);
      } else {
        builder.match(caseData.match, caseData.children);
      }
    }
  }

  const s = sigProxy(props.value);
  s.bindTo(parent, childBindingFactory(builder));

  return parent;
};
