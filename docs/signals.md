# Signals

VanillaJSX ships with its own tiny, dependency-free signal implementation. Signals are optional — you can use any other signal library (see [Custom signal interops](./interop.md)) — but the built-in ones are the most natural fit and are what the rest of the docs assume.

```typescript
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

const counter = sig(0);
```

`sig` and `signal` are aliases:

```typescript
import { sig, signal } from "@ncpa0cpl/vanilla-jsx/signals";

const a = sig(0);              // Signal<number>
const b = signal<number>();    // Signal<number | undefined>
const c = signal(0, { name: "my-counter" });
```

## Creating and updating

```typescript
const counter = sig(0);

counter.get();          // read the current value
counter.dispatch(5);    // set a value
counter.dispatch((cur) => cur + 1); // or pass an updater function
```

`dispatch` accepts either a value or a function `(current) => next`. By default changes are compared with `Object.is`; dispatching an equal value is a no-op:

```typescript
counter.dispatch(0); // already 0 → listeners are not notified
```

You can customize the comparison per signal:

```typescript
const point = sig({ x: 0, y: 0 }, {
  name: "point",
  compare: (a, b) => a.x === b.x && a.y === b.y,
});
```

### Updating objects with immer

For object values, `immer` gives you a mutable draft and produces the next immutable state:

```typescript
const state = sig({ todos: [] as string[] });

state.immer((draft) => {
  draft.todos.push("new todo");
});
```

Whatever the updater returns is used as the next value directly (returning the draft or `undefined` uses the immer-finished draft).

## Reading and reacting

```typescript
const counter = sig(0);

counter.add((value) => console.log(value));  // logs 0 immediately, then on every change
counter.observe((value) => console.log(value));
```

Both return a listener reference with a `detach()` method:

```typescript
const ref = counter.add(listener);
ref.detach();
```

> **`add` vs `observe`** — `add` registers the listener with a weak reference to the signal. If you attach it to a derived signal you don't keep a reference to, the listener can silently stop firing after garbage collection:
>
> ```typescript
> // ⚠ stops logging once the derived signal is GC'd
> mySignal.derive((v) => v * 2).add(console.log);
>
> // ✅ `observe` pins the signal so it can't be collected while listening
> mySignal.derive((v) => v * 2).observe(console.log);
> ```

Other useful listener methods:

```typescript
counter.listenerCount();   // number of attached listeners
counter.derivedCount();    // number of live derived signals

counter.detachListeners(); // detach all listeners (deep: true also detaches sinks)
counter.detachSinks();     // detach all derived signals
counter.detachAll();       // both of the above

counter.destroy();         // permanently destroy the signal
// after destroy(), add/dispatch/derive throw
```

`readonly()` returns a read-only view of a signal — reading works the same, but `dispatch` throws:

```typescript
const ro = counter.readonly();
ro.get();           // fine
ro.dispatch(1);     // throws
```

## Derived signals

`derive` creates a new signal that recomputes whenever the signals it read change:

```typescript
const counter = sig(0);
const double = counter.derive((c) => c * 2);

double.get(); // 0
counter.dispatch(5);
double.get(); // 10
```

Derivation is lazy and cheap: derived signals that nobody listens to are only marked dirty on change and recomputed the next time they are read.

A derive function can return **another signal**, which makes the derive dynamically re-subscribe:

```typescript
const a = sig(1);
const b = sig(2);
const mode = sig<"a" | "b">("a");
const value = mode.derive((m) => (m === "a" ? a : b));
```

### Deriving from multiple signals

Use the static `sig.derive` when you need more than one source (typed overloads go up to 6 sources):

```typescript
const a = sig(1);
const b = sig(2);

const sum = sig.derive(a, b, (av, bv) => av + bv);
sum.get(); // 3
```

## Convenience derivations

A handful of common derivations are built in:

```typescript
const list = sig([1, 2, 3]);
list.$map((v) => v * 2).get();       // [2, 4, 6]
list.$includes(2).get();             // true
list.$len().get();                   // 3

const obj = sig({ name: "Jane", age: 30 });
obj.$prop("name").get();             // "Jane"
obj.$pick("name").get();             // { name: "Jane" }
obj.$omit("age").get();              // { name: "Jane" }

const maybe = sig<string | null>(null);
maybe.$or("fallback").get();         // "fallback"
```

Notes:

- `$pick` and `$omit` return a **stable reference** — if none of the picked (or omitted) properties changed, you get the same object instance back, which avoids spurious updates downstream.
- `$or` only substitutes the value when it's `null` or `undefined`.

## Combinator helpers

The `sig` object also carries helpers that mirror JavaScript operators for signals:

```typescript
const a = sig(true);
const b = sig(false);

sig.or(a, b).get();       // a || b — first truthy value
sig.nuc(a, b).get();      // a ?? b — first non-nullish value (nullish coalescing)
sig.and(a, b).get();      // a && b — last value if all truthy
sig.not(a).get();         // !a
sig.eq(a, b).get();       // a === b
sig.includes(list, 2).get();      // list contains 2 (value may be a signal)
sig.when(cond, thenSig, elseSig); // ternary for signals
```

String templates are supported via `sig.literal`:

```typescript
const name = sig("World");
const greeting = sig.literal`Hello, ${name}!`;

greeting.get(); // "Hello, World!"
name.dispatch("Jane");
greeting.get(); // "Hello, Jane!"
```

And `sig.as` wraps plain values into constant read-only signals (useful when writing components that accept `T | Signal<T>`):

```typescript
const s = sig.as(42);  // ReadonlySignal<number> (constant)
const t = sig.as(existingSignal); // returned as-is
```

## Binding outside of JSX

Signals can also be bound to plain objects and DOM attributes without JSX:

```typescript
sig.bindv(mySignal, myObject, "property");    // keeps myObject.property in sync
sig.bindAttribute(mySignal, myElement, "id"); // keeps the attribute in sync
```

Both bindings hold the element/object only weakly and detach themselves automatically once it's garbage collected. `null`/`undefined` removes the attribute.

## Batching

Multiple dispatches can be grouped so that listeners only run once, after the whole batch commits:

```typescript
sig.startBatch();
a.dispatch(1);
b.dispatch(2);
// reading signals here returns the pre-batch values
sig.commitBatch();
```

Semantics:

- Inside a batch, reads return the values as they were before the batch started.
- Listeners fire once at `commitBatch()`, receiving the final values.
- Listeners added inside a batch get their initial call as part of the commit.
- Commits loop until no pending work remains, so batches triggered by other batches settle correctly.

## Why signals are cleaned up automatically

VanillaJSX uses garbage collection instead of manual unmount/unsubscribe logic for most bindings:

- Every DOM binding holds its element in a `WeakRef`; when the element is collected, the listener detaches itself on the next dispatch.
- Conversely, signals passed inline into JSX (`<span>{mySignal.derive(...)}</span>`) are kept alive by the element they're bound to, so anonymous derived signals don't disappear under your feet.

The practical consequence: you normally never need to manually clean up listeners bound to elements you throw away. Just don't create strong references to a bound element *inside* the binding callback (see [Gotchas](./gotchas.md)).
