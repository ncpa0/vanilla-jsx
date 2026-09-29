# Interop: other signal libraries and custom DOM layers

VanillaJSX does not enforce any specific signal implementation. Signals used in JSX are detected through a registry of "interops", and even the DOM layer itself is pluggable.

## Custom signal interops

To make a third-party signal usable in JSX, register an interop with `SignalsReg`:

```typescript
import { SignalsReg } from "@ncpa0cpl/vanilla-jsx";
import { MySignal } from "./my-signal";

class MySignalInterop {
  is(maybeSignal: unknown): maybeSignal is MySignal<unknown> {
    return maybeSignal instanceof MySignal;
  }
  add(signal: MySignal<any>, listener: (value: any) => void) {
    signal.addListener(listener);
    // interops must call the listener immediately if the signals 
    // `addListener()` doesn't do that already
    listener(signal.value); 
    return () => signal.removeListener(listener);
  }
}

SignalsReg.register(new MySignalInterop());
```

An interop implements two methods:

- `is(maybeSignal)` — type guard used to detect whether a prop value is a signal of that implementation. The `add` methods of all registered interops are tried in registration order, with **the most recently registered interop checked first**.
- `add(signal, listener)` — subscribe the listener, call it once immediately with the current value, and return a detach function. The library uses the detach function for its own cleanup.

To make the types available in JSX, extend the global `JSX.SupportedSignals` interface via declaration merging:

```typescript
declare global {
  namespace JSX {
    interface SupportedSignals<V> {
      mySignal: MySignal<V>;
      // every registered implementation adds a member here;
      // JSX.Signal<V> is the union of all of them
      default: ReadonlySignal<V>; // built-in signals
    }
  }
}
```

After this, `JSX.Signal<T>` includes your signal type, and `MySignal`s can be used anywhere a signal is expected in JSX.

## Provided interops

Interops for a few popular signal implementations ship with the library and can be registered directly:

```typescript
import {
  SignalsReg,
  JsSignalInterop,     // JS Signals (active.js-style)
  MiniSignalInterop,   // mini-signals
  PreactSignalInterop, // @preact/signals-core
} from "@ncpa0cpl/vanilla-jsx";

SignalsReg.register(new JsSignalInterop());
SignalsReg.register(new MiniSignalInterop());
SignalsReg.register(new PreactSignalInterop());
```

Detection of these is heuristic (string tags, symbol properties, subscription APIs), so unusual signal implementations may need a custom interop registered as above.

The built-in signal implementation never needs registration — it is seeded in the registry by default.


## Custom interaction interface

The DOM layer itself is abstracted behind an `InteractionInterface`. The default implementation (`DomInteraction`) talks to the real DOM. Replacing it lets the entire JSX machinery render into any element-like system — custom element classes, canvas nodes, server-side stubs, tests, etc.:

```typescript
import { setInteractionInterface } from "@ncpa0cpl/vanilla-jsx";

setInteractionInterface(new MyInteractionInterface());
```

The interface (see `src/dom/interaction-interface.ts`) covers element creation, attribute/property setting, class and style manipulation, text mutation, child insertion and SVG namespace handling, plus an HTML parsing hook used by `unsafeHTML`. The default `DomInteraction` decides attribute-vs-property via the `html-element-attributes` package, keeps a list of SVG tags and exposes `parseUnsafe` for HTML parsing.

If you swap the DOM layer, you will usually also want to retarget the element types in TypeScript (see [Working with JSX](./jsx.md#overriding-the-element-types)). Note that the DOM gate's containment checks rely on a `parentElement`-compatible property, so custom elements should expose one.
