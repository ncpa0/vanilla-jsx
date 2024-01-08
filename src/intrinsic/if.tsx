import { sigProxy } from "../signals/proxy";

export type IfProps = {
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
  const renderThen: () => JSX.Element = props.then;

  const sig = sigProxy(props.condition);
  let lastResult: WeakRef<JSX.Element>;

  const getResult = () => {
    if (lastResult) {
      return lastResult.deref()!;
    }
    const elem = renderThen();
    lastResult = new WeakRef(elem);
    return elem;
  };

  const validateNotFragment = (element: Element | DocumentFragment) => {
    if (element instanceof DocumentFragment) {
      throw new Error("DocumentFragment is not a valid child of If component.");
    }
  };

  const onConditionMet = (currentElem?: JSX.Element) => {
    const element = renderThen();
    validateNotFragment(element);
    currentElem?.replaceWith(element);
    lastResult = new WeakRef(element);
  };

  const onConditionNotMet = (currentElem?: JSX.Element) => {
    if (props.else) {
      const element = props.else();
      validateNotFragment(element);
      currentElem?.replaceWith(element);
      lastResult = new WeakRef(element);
    } else {
      const placeholder = document.createElement("template");
      currentElem?.replaceWith(placeholder);
      lastResult = new WeakRef(placeholder);
    }
  };

  if (props.not) {
    const sigRef = sig.add((value) => {
      let currentElem: JSX.Element | undefined;
      if (lastResult) {
        currentElem = lastResult.deref();
        if (!currentElem) {
          sigRef.detach();
          return;
        }
      }

      if (value) {
        onConditionNotMet(currentElem);
      } else {
        onConditionMet(currentElem);
      }
    });
  } else {
    const sigRef = sig.add((value) => {
      let currentElem: JSX.Element | undefined;
      if (lastResult) {
        currentElem = lastResult.deref();
        if (!currentElem) {
          sigRef.detach();
          return;
        }
      }

      if (value) {
        onConditionMet(currentElem);
      } else {
        onConditionNotMet(currentElem);
      }
    });
  }

  return getResult();
}
