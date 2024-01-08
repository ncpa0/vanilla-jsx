import { sigProxy } from "../signals/proxy";

export type IfProps = {
  into?: Element;
  noclass?: boolean;
  condition: JSX.Signal<boolean>;
  else?: () => JSX.Element;
  not?: true;
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
