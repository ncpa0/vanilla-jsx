import { sigProxy } from "../signals/proxy";

export type IfProps = {
  /** Parent element to use, if not provided a empty div will be created and used. */
  into?: Element;
  /**
   * Don't add the default class name to the parent element. 
   * (`vjsx-if-container`)
   */
  noclass?: boolean;
  /**
   * Signal containing the condition to check.
   */
  condition: JSX.Signal<boolean>;
  /**
   * Negate the condition.
   */
  not?: true;
  /**
   *  A function that will return element to be rendered when the condition is false.
   */
  else?: () => JSX.Element;
  /**
   *  A function that will return element to be rendered when the condition is true.
   */
  then: () => JSX.Element;
};

/**
 * @example
 * <If
 *  condition={boolSignal}
 *  then={() => <div>Condition is true</div>}
 *  else={() => <div>Condition is false</div>}
 * />
 */
export function If(props: IfProps) {
  const parent = props.into ?? document.createElement("div");

  if (!props.noclass) {
    parent.classList.add("vjsx-if-container");
  }

  const sig = sigProxy(props.condition);

  const onConditionMet = (parent?: JSX.Element) => {
    parent?.replaceChildren(props.then());
  };

  const onConditionNotMet = (parent?: JSX.Element) => {
    if (props.else) {
      parent?.replaceChildren(props.else());
    } else {
      parent?.replaceChildren();
    }
  };

  if (props.not) {
    sig.bindTo(parent, (_, value) => {
      if (value) {
        onConditionNotMet();
      } else {
        onConditionMet();
      }
    });
  } else {
    sig.bindTo(parent, (elem, value) => {
      if (value) {
        onConditionMet(elem);
      } else {
        onConditionNotMet(elem);
      }
    });
  }

  return parent;
}
