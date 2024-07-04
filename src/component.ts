import { createElement } from "./reconciler/reconciler";
import { SignalProxy, sigProxy } from "./sig-proxy/_proxy";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "wc-wrapper": HTMLProps<VanillaJSX.DivTagProps>;
    }
  }
}

class ComponentNode extends HTMLElement {
  static readonly TAG_NAME = "vjsx-component-node";
  static readonly MOUNTED = "mounted";
  static readonly UNMOUNTED = "unmounted";
  readonly MOUNTED = ComponentNode.MOUNTED;
  readonly UNMOUNTED = ComponentNode.UNMOUNTED;

  _emitter = new EventTarget();

  connectedCallback() {
    this.style.display = "contents";
    this._emitter.dispatchEvent(
      new CustomEvent(ComponentNode.MOUNTED, { detail: { target: this } }),
    );
  }

  disconnectedCallback() {
    this._emitter.dispatchEvent(
      new CustomEvent(ComponentNode.UNMOUNTED, { detail: { target: this } }),
    );
  }
}

if (typeof window !== "undefined") {
  window.customElements.define(ComponentNode.TAG_NAME, ComponentNode);
}

export interface OnChangeCallback {
  (): void | (() => void);
}

export interface OnMountCallback {
  (): void | (() => void);
}

export interface OnUnmountCallback {
  (): void;
}

export interface ComponentApi {
  /**
   * Register a callback to be called when the component is mounted into the
   * document. This can be called multiple times if the component is
   * unmounted and then re-mounted.
   */
  onMount(listener: OnMountCallback): void;
  /**
   * Register a callback to be called when the component is unmounted from the
   * document. This can be called multiple times if the component is
   * re-mounted and then unmounted again.
   */
  onUnmount(listener: OnUnmountCallback): void;
  /**
   * Register a callback to be called when the given dependencies change.
   * This callback will only be invoked while the component is mounted.
   */
  onChange(cb: OnChangeCallback, deps: Array<JSX.Signal>): void;
}

const noop = () => {};

class CAPI implements ComponentApi {
  private isConnected = false;
  private changeHandlers: Array<
    [cb: OnChangeCallback, deps: JSX.Signal<any>[]]
  > = [];
  private mountHandlers: OnMountCallback[] = [];
  private unmountHandlers: OnUnmountCallback[] = [];

  private connectMountHandlers(element: ComponentNode) {
    for (let i = 0; i < this.mountHandlers.length; i++) {
      const handler = this.mountHandlers[i]!;
      element._emitter.addEventListener(ComponentNode.MOUNTED, () => {
        const cleanup = handler();
        if (cleanup) {
          element._emitter.addEventListener(
            ComponentNode.UNMOUNTED,
            cleanup,
            { once: true },
          );
        }
      });
    }
    this.mountHandlers.splice(0, this.mountHandlers.length);
  }

  private connectUnmountHandlers(element: ComponentNode) {
    for (let i = 0; i < this.unmountHandlers.length; i++) {
      const handler = this.unmountHandlers[i]!;
      element._emitter.addEventListener(ComponentNode.UNMOUNTED, handler);
    }
    this.unmountHandlers.splice(0, this.unmountHandlers.length);
  }

  private connectChangeHandlers(element: ComponentNode) {
    for (let i = 0; i < this.changeHandlers.length; i++) {
      const [cb, deps] = this.changeHandlers[i]!;
      let isQueued = false;
      let cleanup: () => void = noop;

      const addBinding = (signal: SignalProxy<any>, elem: ComponentNode) => {
        const unbind = signal.add(() => {
          if (isQueued) return;
          isQueued = true;
          queueMicrotask(() => {
            isQueued = false;
            cleanup();
            cleanup = cb() ?? noop;
          });
        });

        elem._emitter.addEventListener(ComponentNode.UNMOUNTED, () => {
          unbind();
          cleanup();
        }, {
          once: true,
        });
      };

      for (let j = 0; j < deps.length; j++) {
        const signal = sigProxy(deps[j]!);

        element._emitter.addEventListener(ComponentNode.MOUNTED, (ev) => {
          const event = ev as CustomEvent<{ target: ComponentNode }>;
          addBinding(signal, event.detail.target);
        });
      }
    }
    this.changeHandlers.splice(0, this.changeHandlers.length);
  }

  onChange(...args: [cb: OnChangeCallback, deps: JSX.Signal<any>[]]): void {
    if (this.isConnected) {
      throw new Error(
        "Cannot register onChange handler after component initialization.",
      );
    }
    this.changeHandlers.push(args);
  }

  onMount(listener: OnMountCallback): void {
    if (this.isConnected) {
      throw new Error(
        "Cannot register onMount handler after component initialization.",
      );
    }
    this.mountHandlers.push(listener);
  }

  onUnmount(listener: OnUnmountCallback): void {
    if (this.isConnected) {
      throw new Error(
        "Cannot register onUnmount handler after component initialization.",
      );
    }
    this.unmountHandlers.push(listener);
  }

  connect(element: ComponentNode) {
    this.connectMountHandlers(element);
    this.connectUnmountHandlers(element);
    this.connectChangeHandlers(element);
    this.isConnected = true;
  }
}

/**
 * Wraps the returned html elements in a Web Component and provides an API
 * for subscribing to that component's lifecycle events.
 *
 * @example
 * const MyComponent = $component<{foo: JSX.Signal<string>}>((props, api) => {
 *   api.onMount(() => {
 *     console.log("Mounted");
 *   });
 *   api.onUnmount(() => {
 *     console.log("Unmounted");
 *   });
 *   api.onChange(() => {
 *     console.log("Foo changed");
 *   }, [props.foo]);
 *
 *   return <div>{props.foo}</div>;
 * });
 */
export const $component = <P>(
  component: (props: P, api: ComponentApi) => JSX.Element,
) => {
  return (props: P) => {
    const api = new CAPI();
    const elem = createElement(
      ComponentNode.TAG_NAME,
      {},
      component(props, api),
    ) as ComponentNode;
    api.connect(elem);
    return elem;
  };
};
