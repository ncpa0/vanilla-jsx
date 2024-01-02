export { Fragment, jsx, jsxs } from "./index";
import { jsx } from "./index";

export function jsxDEV(tag: any, props?: object) {
  let children = [];
  // @ts-expect-error
  if (props && props.children) {
    // @ts-expect-error
    children = Array.isArray(props.children) ? props.children : [props.children];
    // @ts-expect-error
    delete props.children;
  }
  return jsx(tag, props, ...children);
}
