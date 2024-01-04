import { jsx } from "../create-element";
import { sigProxy } from "../signals/proxy";

export type IfProps = JSX.PropsWithChildren<{
  condition: JSX.Signal<boolean>;
  else?: JSX.Element;
  not?: true;
  parent?: Element;
}>;

export function If(props: IfProps) {
  const sig = sigProxy(props.condition);
  const parent = (props.parent ?? <div></div>) as HTMLElement;

  const onConditionMet = (() => {
    if (Array.isArray(props.children)) {
      return () => parent.append(...props.children as Element[]);
    } else {
      return () => parent.append(props.children as Element);
    }
  })();

  const onConditionNotMet = (() => {
    const elseElem = props.else;
    if (elseElem) {
      return () => {
        parent.innerHTML = "";
        parent.append(elseElem);
      };
    } else {
      return () => {
        parent.innerHTML = "";
      };
    }
  })();

  if (props.not) {
    sig.bindTo(parent, (value) => {
      if (value) {
        onConditionNotMet();
      } else {
        onConditionMet();
      }
    });
  } else {
    sig.bindTo(parent, (value) => {
      if (value) {
        onConditionMet();
      } else {
        onConditionNotMet();
      }
    });
  }

  return parent;
}
