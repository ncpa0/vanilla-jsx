# Gotchas and limitations

A collection of behaviors worth knowing about before they surprise you.

## Alpha status

The library is in early alpha (`0.0.1-alpha.x`). APIs may change; pin your version.

## The rendering model means no re-renders

Components are executed **once**. If you're used to re-render loops (React-style), remember that all dynamic behavior must go through signals — bindings registered at element creation time. A component that reads a signal value directly into a static prop will capture that value forever:

```tsx
const counter = sig(0);

// ❌ static — always renders 0
const a = <p>{counter.get()}</p>;

// ✅ reactive — updates as counter changes
const b = <p>{counter}</p>;
```

## Garbage-collection based cleanup

Most cleanup is driven by the garbage collector rather than by explicit unmounting:

- DOM bindings hold their element in a `WeakRef` and detach themselves **on the next dispatch** after the element is collected. Cleanup is lazy, not instant.
- Signals used in JSX are kept alive by the element they're bound to, so inline derived signals are safe: `<span>{s.derive(...)}</span>` won't be collected while the element lives.
- **Never strongly reference a bound element inside a binding callback** other than through the argument provided to it — it would defeat the weak-reference cleanup. This applies to `bindSignal` callbacks:

  ```typescript
  // ❌ holds myElement strongly → listener leaks
  bindSignal(s, myElement, () => { myElement.classList.add("x"); });

  // ✅ use the callback argument
  bindSignal(s, myElement, (elem) => { elem.classList.add("x"); });
  ```

- Listeners attached with `add()` to a **derived signal you don't keep a reference to** can be silently collected. Use `observe()` for such listeners (see [Signals](./signals.md#reading-and-reacting)).

## Fragments cannot hold signal children

`<>...</>` fragments are real `DocumentFragment`s and cannot have signals bound as direct children — attempting it throws (this is a limitation of the DOM not this library.) Bind signals inside a regular element instead.

## `unsafeHTML` is an XSS surface

With `unsafeHTML` set, string children are parsed as HTML with `DOMParser` — the equivalent of `innerHTML`, with **no sanitization anywhere**. Only use it with fully trusted content.

## Batching semantics

Inside `sig.startBatch()` / before `sig.commitBatch()`:

- reads return the **pre-batch** values, even after dispatching;
- listeners fire once at commit, and listeners added mid-batch get their initial call at commit time.

If you forget to call `commitBatch()`, nothing is applied.

## Value identity matters in lists

`<Range>` reuses elements by value identity, not by key. Duplicate values in the list can confuse element reuse. For keyed, virtualized lists use `<VirtualList>` with a proper `getKey`.

`$pick` / `$omit` return the **same object instance** when nothing picked/omitted changed — convenient for downstream comparison, but don't treat the result as a fresh object.

## Heuristic attribute-vs-property assignment

Prop names are assigned as DOM attributes or JS properties based on the `html-element-attributes` dataset and element introspection. If a prop ends up applied the wrong way for your case, force it with the `attribute:` or `property:` prefix.

## Environment requirements

- A DOM environment is required — elements are created eagerly, and the library uses `WeakRef`, `DOMParser`, `ResizeObserver`, `queueMicrotask`, `requestAnimationFrame` and (for `$component`) `window.customElements`. There is **no SSR support**; in Node, use a DOM shim such as `happy-dom`.
- Targets modern runtimes (es2022+).

## Known quirks

- Signals cannot be used as direct children of fragments (see above) — this throws by design.
- The `boundSignal` two-way binding only works with the built-in `VSignal` implementation and only on `input`/`textarea` elements.
- With foreign signal implementations (via interops), only the documented interop contract is guaranteed; detection of the provided interops is heuristic.
