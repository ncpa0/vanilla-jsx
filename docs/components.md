# Components

Function components in VanillaJSX are plain functions called once. To build richer building blocks — lifecycle hooks, conditionals, list rendering, virtualization — the library provides a set of base components and helpers described here.

## `<If>`

Conditional rendering with reactive conditions:

```tsx
import { If } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

const someCondition = sig(false);

<If
  condition={someCondition}
  then={() => <p>Condition Met!</p>}
  else={() => <p>Condition Not Met!</p>}
/>
```

Details:

- The condition may be a boolean signal or a signal of any value. `then` receives the **non-nullish value** of the condition, which makes truthiness checks on values ergonomic:

  ```tsx
  <If
    condition={user}
    then={(u) => <p>Hello, {u.name}!</p>}
    else={() => <p>Not logged in.</p>}
  />
  ```

- With `not`, the roles are inverted — `else` becomes the "has value" branch:

  ```tsx
  <If condition={user} not then={() => <p>No user</p>} else={(u) => <p>{u.name}</p>} />
  ```

- The rendered content is placed inside a wrapper element (`<div class="vjsx-if-container">` by default). Use `into` to provide your own container element and `noclass` to skip the class:

  ```tsx
  <If condition={c} into={<section />} noclass then={...} else={...} />
  ```

- `memo` — by default the branches are rendered fresh on every flip. With `memo` the once-rendered elements are cached and reused. While a memoized branch is hidden, its signal bindings are **frozen** (suppressed via the DOM gate) and, when shown again, catch up with the latest signal values. This makes caching safe:

  ```tsx
  <If condition={visible} memo then={() => <ExpensiveList />} else={() => <Placeholder />} />
  ```

## `<Switch>` and `<Case>`

Pattern matching on a signal value:

```tsx
import { Switch, Case } from "@ncpa0cpl/vanilla-jsx";

enum MyEnum { A, B, C }

function displayOneOf(value: JSX.Signal<MyEnum>) {
  return (
    <div>
      <Switch value={value}>
        <Case match={MyEnum.A}>{() => <div>Case A</div>}</Case>
        <Case match={MyEnum.B}>{() => <div>Case B</div>}</Case>
        <Case match={(v) => v > 10}>{(v) => <div>Big: {v}</div>}</Case>
        <Case default>{() => <div>Default case</div>}</Case>
      </Switch>
    </div>
  );
}
```

Details:

- `<Switch>` takes a `value` signal; children must be `<Case>` elements.
- `match` accepts a value (compared with `Object.is`) or a predicate function.
- `<Case default>` renders when nothing matches; if you declare several defaults, the **last** one wins. A default placed before the other cases does not shadow them.
- Supports the same `into`, `noclass` and `memo` props as `<If>` (`memo` caches each case's element the first time it matches and freezes it while hidden).
- `Case` render functions receive the current value.

## `<Range>`

Maps a signal of a list onto elements, reusing existing elements when the list changes:

```tsx
import { Range } from "@ncpa0cpl/vanilla-jsx";

function displayList(list: JSX.Signal<string[]>) {
  return (
    <div>
      <Range data={list} into={<ul />}>
        {(value) => <li>{value}</li>}
      </Range>
    </div>
  );
}
```

Details:

- `data` is a signal of a (readonly) array; the render child receives each item's value.
- On updates, elements whose value is no longer present are removed, unchanged items are left in place, reordered items are **moved** with `insertBefore`, and new items are appended at the end.
- Reuse is based on **value identity** (`indexOf`/equality), not keys — items should be primitives or stable object references. Duplicate values in the list can confuse the reuse logic; prefer `<VirtualList>` with a `getKey` when that matters.
- `into` provides the container element (`<div class="vjsx-range-container">` by default), `noclass` skips the class.

For plain mapping without element reuse you can always use `derive`:

```tsx
{elems.derive((list) => list.map((elem) => <p>{elem}</p>))}
```

## `<VirtualList>`

A windowed (virtualized) scrolling list that only renders rows near the viewport. It supports both fixed and dynamic row heights and recycles row wrappers while scrolling.

```tsx
import { VirtualList } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

type Item = { id: string; label: string };

const list = sig<Item[]>(/* ... */);

const container = (
  <VirtualList
    data={list}
    getKey={(item) => item.id}
    itemHeight={32}
    render={(itemSig, indexSig) => (
      <p>{itemSig.derive((item) => item.label)}</p>
    )}
  />
);
```

Key props:

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `data` | `JSX.Signal<readonly T[]>` | — | The list to render. |
| `render` | `(value: ReadonlySignal<T>, index: ReadonlySignal<number>) => GetElement` | — | Row renderer. Receives **signals** for the item and its index, so recycled rows update reactively. |
| `getKey` | `(value: T) => string` | — | Stable item key; used to cache measured row heights across data changes. |
| `renderEmpty` | `() => GetElement` | — | Rendered when the list is empty. |
| `itemHeight` | `number \| "homogeneous"` | dynamic | Known row height (`number`) or a single shared measured height (`"homogeneous"`). By default each row is measured individually. |
| `estimateItemHeight` | `number` | `32` | Estimate used before a row is measured. |
| `pageSize` | `number` | `32` | Rows rendered per page (min 2). |
| `initialRender` | `number` | — | Rows rendered immediately before scrolling starts. |
| `overscanLeading` / `overscanTrailing` | `number` | `1000` px | Extra pixels rendered ahead of / behind the viewport (the leading one depends on scroll direction). |
| `threshold` | `number` | `1000` px | Default for both overscans. |
| `bailThreshold` | `number` | ¼ of max overscan (min 16 px) | Minimum scroll delta before recalculating. |
| `scrollThrottle` | `number` | `32` ms | Scroll handler throttle. |
| `containerProps` | div props | — | Props for the scroll container (excluding children; `style` may be a signal). |
| `onscroll` | `(ev, topPos: number) => void` | — | Scroll callback. |
| `initialScroll` | number | — | Initial scroll position. |
| `into`, `noclass` | — | — | As on the other components. |

Notes:

- Rows are wrapped in recycled slot elements; your render output is created once per slot and updated through its signals, so rows don't get torn down while scrolling.
- Dynamic row heights are measured with a `ResizeObserver` and indexed in a Fenwick tree, making offset lookup `O(log n)`.
- Public methods: `getItemPosition(index)` (row's pixel offset, `-1` if out of range) and `scrollToItem(index, options?)`. They are accessed through the back-reference the component attaches to its scroll container element:

  ```tsx
  const container = <VirtualList /* ... */ /> as HTMLDivElement & {
    VirtualList: VirtualList<Item>;
  };
  container.VirtualList.scrollToItem(42, { block: "center" });
  ```
- The container is a flex column with `overflow: auto` and the `vjsx-virt-list-container` class (unless `noclass`).

## `$component` and `ComponentApi`

`$component` wraps a function component so it gets lifecycle hooks and an own wrapper element (`<vjsx-component-node>`, styled `display: contents` so it doesn't affect layout):

```tsx
import { $component } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

const Counter = $component((props: { start?: number }, api) => {
  const count = sig(props.start ?? 0);

  api.onMount(() => {
    console.log("mounted");
    return () => console.log("unmounted");
  });

  api.onChange(() => {
    console.log("count changed:", count.get());
  }, [count]);

  return (
    <button onClick={() => count.dispatch((c) => c + 1)}>
      {count}
    </button>
  );
});
```

The `ComponentApi` object:

- **`onMount(listener)`** — fires when the component element is connected to the document. The listener may return a cleanup function, which runs once the element disconnects (mount/unmount can fire repeatedly for reconnecting elements).
- **`onUnmount(listener)`** — fires when the element disconnects.
- **`onChange(cb, deps)`** — subscribes to the given signal(s) **only while mounted**. `cb` runs whenever any dep changes (it takes no arguments; read the dep values inside), and any cleanup function returned by the previous run executes before the next invocation. Multiple deps changing in the same tick coalesce into a single callback (microtask-coalesced).

> ⚠ These methods must be called **synchronously inside the component body** — calling them after the component has been created throws.

## `ClassComponent`

For more structure you can extend the `ClassComponent` base class and implement `render()`:

```tsx
import { ClassComponent } from "@ncpa0cpl/vanilla-jsx";

class MyComponent extends ClassComponent<{ name: string }> {
  render() {
    return <p>Hello, {this.props.name}!</p>;
  }
}

const elem = <MyComponent name="Jane" />;
```

The class is instantiated once with `(props, { reconciler })` and `render()` is called; everything reactive must again be signal-driven.

## `throttle`

A dependency-free throttle/debounce helper (used internally by `<VirtualList>`), exported as the default export of `src/utils.ts`:

```typescript
import throttle from "./utils";

const onScroll = throttle(100, (ev) => { /* ... */ });
onScroll.cancel();            // cancel pending call
onScroll.cancel({ upcomingOnly: true });
```

Options: `{ noTrailing?, noLeading?, debounceMode? }`. A `delay` of `0` short-circuits to a plain passthrough.
