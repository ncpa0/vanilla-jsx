# VanillaJSX

*VanillaJSX provides a syntactic sugar for creating HTMLElements.*

It is a JSX render library that compiles JSX **directly to real DOM elements** — no virtual DOM, no diffing, no re-render loop. JSX runs once, eagerly building real `HTMLElement`s, and all dynamic behavior is driven by [signals](./docs/signals.md) bound to element attributes, children and event listeners at creation time.

These two snippets are equivalent:

```typescript
const container = document.createElement('div');
const header = document.createElement('h1');
header.textContent = 'Hello, world!';
header.classList.add('custom-header');
container.setAttribute('id', 'header-container');
container.appendChild(header);
```

```tsx
const container = (
    <div id="header-container">
        <h1 class="custom-header">Hello, world!</h1>
    </div>
);
```

## Installation

```bash
yarn add @ncpa0cpl/vanilla-jsx
```

Enable the JSX transform in your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@ncpa0cpl/vanilla-jsx"
    }
}
```

Set the same option in your bundler, e.g. for `esbuild`:

```javascript
esbuild
  .build({
    jsxImportSource: "@ncpa0cpl/vanilla-jsx",
    ...rest
  })
```

## Quick example

```tsx
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

function getCounterComponent() {
    const counter = sig(0);

    return (
        <div>
            <button
                class={counter.derive(c => `counter_${c}`)}
                onClick={() => counter.dispatch(current => current + 1)}
            >
                Click me!
            </button>
            <p>{counter}</p>
        </div>
    );
}
```

The built-in signal library is optional — interops are provided for [JS Signals, mini-signals and @preact/signals-core](./docs/interop.md#provided-interop), and any other implementation can be plugged in via `SignalsReg`.

## Documentation

| Document | Contents |
| --- | --- |
| [Signals](./docs/signals.md) | The built-in signal library: `sig`, derive, combinators, batching, GC-based cleanup. |
| [Signal Freezing](./docs/singal-freezing.md) | Stopping signal driven DOM mutation in selected sub-trees. |
| [Working with JSX](./docs/jsx.md) | Setup, elements, fragments, props, events, reactive attributes, `class`/`style`, `boundSignal`, `unsafeHTML`, components. |
| [Components](./docs/components.md) | `<If>`, `<Switch>`/`<Case>`, `<Range>`, `<VirtualList>`, `$component` lifecycle, `ClassComponent`. |
| [Interop](./docs/interop.md) | Registering other signal implementations, swapping the DOM layer. |
| [Gotchas and limitations](./docs/gotchas.md) | Rendering model, GC cleanup rules, XSS notes, batching semantics, environment requirements. |

## License

MIT
