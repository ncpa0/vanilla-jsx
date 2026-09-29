import { GetElement, jsx, Reconciler } from "../reconciler/reconciler";
import { sigProxy } from "../sig-proxy/_proxy";

export type SwitchProps<T> = {
  value: JSX.Signal<T>;
  /**
   * Children must be `Case` elements.
   */
  children: JSX.Element[];
  /** Parent element to use, if not provided a empty div will be created and used. */
  into?: GetElement;
  /**
   * Don't add the default class name to the parent element.
   * (`vjsx-switch-container`)
   */
  noclass?: boolean;
};

export type CaseRenderFn<T> = (matchedValue: T) => JSX.Element;

function isFunctionMatcher<T>(
  v: T | ((value: T) => boolean),
): v is (value: T) => boolean {
  return typeof v === "function";
}

export function createEmptyElem() {
  const elem = <div />;
  Reconciler.interactions().hide(elem);
  return elem;
}

class CaseBuilder<T> {
  private cases: Array<[(T | ((value: T) => boolean)), CaseCtx<T>]> = [];
  private defaults: Array<CaseCtx<T>> = [];

  constructor() {}

  match(
    matcher: T | ((value: T) => boolean),
    caseCtx: CaseCtx<T>,
  ): CaseBuilder<T> {
    this.cases.push([matcher, caseCtx]);
    return this;
  }

  default(caseCtx: CaseCtx<T>): CaseBuilder<T> {
    this.defaults.push(caseCtx);
    return this;
  }

  static findCase<T>(
    v: T,
    builder: CaseBuilder<T>,
  ): undefined | CaseCtx<T> {
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

    if (builder.defaults.length > 0) {
      return builder.defaults.at(-1);
    }

    return undefined;
  }
}

function childBindingFactory<T>(builder: CaseBuilder<T>) {
  const emptyFragment = createEmptyElem();
  return (element: Element, v: T) => {
    const matchingCase = CaseBuilder.findCase(v, builder);

    const dom = Reconciler.interactions();

    if (matchingCase) {
      if (matchingCase.data.element) {
        dom.replaceAllChildren(element, matchingCase.data.element);
      } else {
        const elem = matchingCase.props.children(v);
        dom.replaceAllChildren(element, elem);

        if (matchingCase.props.memo) {
          matchingCase.data.element = elem;
        }
      }
      return;
    }

    dom.replaceAllChildren(element, emptyFragment);
  };
}

export type CaseProps<T = unknown> =
  & {
    /**
     *  A function that will return element to be rendered when the case is matched.
     */
    children: CaseRenderFn<T>;
    /**
     * When set to true, the child will only ever get rendered once, and after the
     * result wil be reused every time it matches.
     */
    memo?: boolean;
  }
  & ({
    /**
     * A value or a function that will be used to match the value of the switch.
     */
    match: T | ((value: T) => boolean);
  } | {
    default: true;
  });

type CaseCtx<T> = {
  props: CaseProps<T>;
  data: {
    element?: Element;
  };
};

const CaseData = new WeakMap<object, CaseCtx<any>>();

export const Case = <T,>(props: CaseProps<T>): JSX.Element => {
  const tmp = <div />;
  CaseData.set(tmp, {
    data: {},
    props: {
      ...props,
      children: Array.isArray(props.children)
        ? props.children[0]!
        : props.children,
    },
  });
  return tmp;
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
    Reconciler.interactions().addClassName(parent, "vjsx-switch-container");
  }

  const builder = new CaseBuilder<T>();

  for (let i = 0; i < props.children.length; i++) {
    const child = props.children[i]!;
    const caseData = CaseData.get(child);

    if (caseData) {
      if ("default" in caseData.props) {
        builder.default(caseData);
      } else {
        builder.match(caseData.props.match, caseData);
      }
    }
  }

  const s = sigProxy(props.value);
  s.bindTo(parent, childBindingFactory(builder));

  return parent;
};
