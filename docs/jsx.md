# Working with JSX

VanillaJSX compiles JSX directly into real DOM elements. There is no virtual DOM and no re-render loop: `jsx` runs **once**, eagerly builds the `HTMLElement`s, and every future update is handled by signal bindings registered at creation time.

```tsx
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

const counter = sig(0);

const container = (
  <div>
    <button onClick={() => counter.dispatch((c) => c + 1)}>
      Click me!
    </button>
    <p>{counter}</p>
  </div>
);
```

## Setup

Enable JSX in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@ncpa0cpl/vanilla-jsx"
  }
}
```

Your bundler needs the same option. For esbuild:

```javascript
esbuild.build({
  jsxImportSource: "@ncpa0cpl/vanilla-jsx",
  ...rest
});
```

The package provides the standard `jsx-runtime` and `jsx-dev-runtime` entry points, so any tool that supports the `react-jsx` transform will work. If your bundler cannot resolve `exports` (older configurations), root-level `jsx-runtime.js` and `signals.js` shims are published for compatibility.

## Elements, fragments, children

- Intrinsic tags (`div`, `span`, `svg`, ...) create real DOM elements — SVG tags are created with `createElementNS` automatically.
- `<>...</>` fragments produce a real `DocumentFragment`. Note: a fragment cannot hold signal children directly — bind them inside an element instead.
- Children can be strings, numbers, booleans, `null`/`undefined` (skipped), elements, arrays (flattened) and, of course, signals.
- The `children` prop and positional children are both supported.

```tsx
const elem = (
  <div>
    text
    {123}
    {false /* rendered nothing */}
    {null}
    {someSignal}
    {someSignal.derive((v) => <p>Derived: {v}</p>)}
    {[<span key="a" />, <span key="b" />]}
  </div>
);
```

When a signal is used as a child, an anchor text node is placed in the DOM and the signal's value (text, element, fragment or array of elements) replaces it on every change. Primitive values update the existing text node in place rather than rebuilding the DOM.

## Props: attributes and properties

Most props are set with a simple heuristic powered by the `html-element-attributes` package: known HTML attributes for the tag go through `setAttribute`, everything else is assigned as a JS property. `null`/`undefined` removes the attribute. A few props get special treatment:

- `class` — see [Class](#class) below.
- `style` — see [Style](#style) below.
- `data-*` — set through the element's `dataset`.
- `checked` on inputs — set as the `checked` property (attribute would only set the *initial* state).
- `value` on inputs and textareas — set as the `value` property.
- `aria-*` — booleans are stringified.
- SVG attributes (`xlink:href` etc.) — set as attributes.

You can also force either behavior with the `attribute:` and `property:` prefixes:

```tsx
<input property:customProp={x} attribute:whatever={y} />
```

### Events

Any prop starting with `on` is bound as an event listener, with the event name lower-cased:

```tsx
<button onclick={onClick} onmouseover={onHover} />
```

The handler receives the native event, typed with the right event type for the tag (e.g. the `target` is narrowed to the element type).

### `unsafeHTML`

When the `unsafeHTML` prop is truthy, string children are parsed as HTML with `DOMParser` and inserted as real elements, like `innerHTML`:

```tsx
<div unsafeHTML={trustedHtml} />
```

> ⚠ **This is an XSS surface.** No sanitization is performed anywhere in the library. Only ever pass fully trusted, static or verified strings.

### `ns` and SVG

SVG tags are detected by name and created in the SVG namespace automatically. If you need a custom namespace (e.g. MathML or XHTML), use the `ns` prop:

```tsx
<div ns="http://www.w3.org/1999/xhtml" />
```

## Reactive props

Any prop can take a signal instead of a static value. The attribute is then re-applied on every signal change:

```tsx
const counter = sig(0);

<button
  id={counter.derive((c) => `btn-${c}`)}
  disabled={counter.derive((c) => c === 0)}
>
  {counter}
</button>
```

Signal values in `class`, `style` and children are handled by dedicated bindings — see below.

## Class

The `class` prop accepts a string, a number, an array, a record, or a signal of any of these:

```tsx
const active = sig(true);

<div class="base-class" />
<div class={active.derive((a) => a ? "active" : "inactive")} />
<div class={{ highlighted: active, muted: false }} />
<div class={["base-class", active.derive((a) => a ? "active" : "inactive"), 42]} />
```

The key concept is the **reset**: every evaluation of the `class` prop starts by clearing the element's current classes, then applies the new value. What "applying" means depends on the shape of the value:

- **String or number** — after the reset, the class list is set to that single value. Everything the element had before is gone.

  ```tsx
  // element's classes become exactly "abc"
  <div class="abc" />
  ```

- **Array** — after the reset, each entry is **added** to the class list. Entries are applied together, side by side; no entry replaces another. Entries may be strings, numbers, or signals (each signal entry is bound individually and adds/removes its own class on change).

  ```tsx
  // element's classes become "base-class abc" (and "foo" comes and goes with the signal)
  <div class={["base-class", active.derive((a) => a && "foo"), "abc"]} />
  ```

- **Record** (`{ [className]: boolean | Signal<boolean> }`) — after the reset, each key is added or removed based on the truthiness of its condition; conditions may be signals.

  ```tsx
  // element's classes become "highlighted", tracking `active` on every change
  <div class={{ highlighted: active }} />
  ```

- **Signal** — the signal's value is evaluated with the rules above on every change (so a signal of an array re-resets and re-applies the whole array on each change).

Two things worth calling out:

- Replacement only ever happens at the **top level**. Inside an array, everything is additive — `["abc", someSignal]` never discards `"abc"` when the signal changes, because the reset happens once per evaluation of the whole prop value, before any entry is applied.
- Mixing shapes is only possible inside a **signal**: since a signal's value is re-evaluated wholesale, a signal that emits an array (or a record) treats each emission as a fresh top-level value. A plain array's entries, however, must each be a string, number, or signal — a record is not supported as an array entry and will log a warning.

  ```tsx
  const classes = sig(["foo", "bar"]);
  // ✅ each emission is a fresh top-level value: reset, then add "foo" and "bar"
  <div class={classes} />

  // ⚠ records can't be entries of a plain array
  <div class={[{ foo: true }, "abc"]} /> // logs "unsupported object used as class name"
  ```

## Style

The `style` prop accepts a string or an object. In the object form each key can be a signal, and numeric values get `"px"` appended (custom properties starting with `--` go through `setProperty` instead):

```tsx
const color = sig("red");

<div
  style={{
    color,
    width: 100, // → "100px"
    "--brand-color": "hotpink",
    backgroundColor: color.derive((c) => `${c}-ish`),
  }}
/>
```

CSS property names are exhaustively typed (see `CSSDict` in the type definitions).

## Two-way input binding with `boundSignal`

For form controls there is a dedicated `boundSignal` prop that creates a **two-way** binding: input events dispatch to the signal, and signal changes update the input:

```tsx
const name = sig("");
const agreed = sig(false);

<label>
  Name: <input boundSignal={name} />
  Agree: <input type="checkbox" boundSignal={agreed} />
</label>
```

- Text inputs and textareas: synced via the `value` property and the `input` event.
- Checkboxes: synced via the `checked` property and the `change` event.

This prop only works on `input` and `textarea` elements and the signal must be one of the built-in `VSignal`s.

## Function and class components

A **function component** is just a function invoked once at creation time. There is no re-render; make stateful parts reactive with signals:

```tsx
const MyComponent = (props: { name: JSX.Signal<string> }) => (
  <p>Hello, {props.name}!</p>
);

const elem = <MyComponent name={sig("Jane")} />;
```

For components that need lifecycle hooks, use [`$component`](./components.md#component-and-componentapi) or [`ClassComponent`](./components.md#classcomponent).

## Overriding the element types

The reconciler produces DOM `Element`/`Text`/`DocumentFragment` types by default. If you plug in a custom interaction interface (see [Advanced interop](./interop.md#custom-interaction-interface)), you can swap these globally via declaration merging:

```typescript
declare global {
  namespace VanillaJSX {
    interface Types {
      Element: MyElement;
      TextElement: MyTextElement;
      FragmentElement: MyFragmentElement;
      Ev: MyEvent;
    }
  }
}
```
