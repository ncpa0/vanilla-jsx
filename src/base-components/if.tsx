import { GetElement, jsx, Reconciler } from "../reconciler/reconciler";
import { sigProxy } from "../sig-proxy/_proxy";

export type IfProps<T> =
  & {
    /** Parent element to use, if not provided a empty div will be created and used. */
    into?: GetElement;
    /**
     * Don't add the default class name to the parent element.
     * (`vjsx-if-container`)
     */
    noclass?: boolean;
    /**
     * Signal containing the condition to check.
     */
    condition: JSX.Signal<T>;
  }
  & ({
    /**
     * Negate the condition.
     */
    not?: undefined | false;
    /**
     *  A function that will return element to be rendered when the condition is true.
     */
    then: (value: NonNullable<T>) => JSX.Element;
    /**
     *  A function that will return element to be rendered when the condition is false.
     */
    else?: () => JSX.Element;
  } | {
    /**
     * Negate the condition.
     */
    not: true;
    /**
     *  A function that will return element to be rendered when the condition is false.
     */
    else?: (value: NonNullable<T>) => JSX.Element;
    /**
     *  A function that will return element to be rendered when the condition is true.
     */
    then: () => JSX.Element;
  });

/**
 * @example
 * // Boolean condition:
 * <If
 *  condition={boolSignal}
 *  then={() => <div>Condition is true</div>}
 *  else={() => <div>Condition is false</div>}
 * />
 *
 * // Value defined condition
 * const v = sig<string | undefined>()
 *
 * <If
 *  condition={v}
 *  then={(str) => <div>String is defined: {str}</div>}
 *  else={() => <div>String is undefined</div>}
 * />
 */
export function If<T>(props: IfProps<T>) {
  const parent = props.into ?? <div />;

  if (!props.noclass) {
    Reconciler.interactions().addClassName(parent, "vjsx-if-container");
  }

  const sig = sigProxy(props.condition);

  const onConditionMet = (v?: T, parent?: JSX.Element) => {
    Reconciler.interactions().replaceAllChildren(
      parent as HTMLElement,
      props.then(v!),
    );
  };

  const onConditionNotMet = (v: T | undefined, parent: JSX.Element) => {
    if (props.else) {
      Reconciler.interactions().replaceAllChildren(
        parent as HTMLElement,
        props.else(v!),
      );
    } else {
      Reconciler.interactions().replaceAllChildren(parent as HTMLElement);
    }
  };

  if (props.not) {
    sig.bindTo(parent, (elem, value) => {
      if (value) {
        onConditionNotMet(value, elem);
      } else {
        onConditionMet(value, elem);
      }
    });
  } else {
    sig.bindTo(parent, (elem, value) => {
      if (value) {
        onConditionMet(value, elem);
      } else {
        onConditionNotMet(value, elem);
      }
    });
  }

  return parent;
}
