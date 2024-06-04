*VanillaJSX provides a syntactic sugar for creating HTMLElements*

### Example

These two snippets are equivalent:

```typescript
const container = document.createElement('div');
const header = document.createElement('h1');
header.textContent = 'Hello, world!';
header.classList.add('custom-header');
div.setAttribute('id', 'header-container');
container.appendChild(header);
```

```tsx
const container = (
    <div id="header-container">
        <h1 class="custom-header">Hello, world!</h1>
    </div>
);
```

## TypeScript and build step

To enable TypeScript support set these options in your `tsconfig.json`:

```json
{
    "compilerOptions": {
        "jsx": "react-jsx",
        "jsxImportSource": "@ncpa0cpl/vanilla-jsx"
    }
}
```

Similar options will need to be set in the build tool you are using. For example the following option should be used in `esbuild`:

```javascript
esbuild
  .build({
    jsxImportSource: "jsxte",
    ...rest
  })
```

## Signals

On top of the basic syntax sugar it is also possible to easily bind signals to element attributes, children and listeners.

VanillaJSX does not enforce any specific signal implementation, but it does provide one if you wish to use it. For a given signal to be able to be used it only needs to adhere to one of the following interfaces:

```typescript
interface SignalWithRemove<V> {
    add(listener: (value: V) => void): void;
    remove(listener: (value: V) => void): void;
}

interface SignalWithDetach<V> {
    add(listener: (value: V) => void): void;
    detach(listener: (value: V) => void): void;
}

interface SignalWithDetachRef<V> {
    add(listener: (value: V) => void): { detach(): void };
}
```

It is also assumed that a listener added to a signal will be called once after being added, since signal interfaces don't require for any way to read from the signal, this is necessary to set the initial values.

These interfaces and behavior expectations already align with libraries like [mini-signals](https://www.npmjs.com/package/mini-signals) or [js-signals](https://millermedeiros.github.io/js-signals/), which can be used with VanillaJSX out of the box.

#### Example

```tsx
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

function getCounterComponent() {
    const counter = sig(0);

    const onClick = () => {
        counter.dispatch(current => current + 1);
    };

    return (
        <div>
            <button 
                class={counter.derive(c => `counter_${c}`)} 
                onClick={onClick}
            >
                Click me!
            </button>
            <p>{counter}</p>
        </div>
    );
};
```

### Conditional rendering and maps

It's possible to achieve conditional rendering or maping a list of elements by using the `derive()` method of the provided signal implementation:

```tsx
import { sig, Signal } from "@ncpa0cpl/vanilla-jsx/signals";

function displayElements(elems: Signal<string[]>) {
    return <div>
        {elems.derive(list => {
            if (list.length === 0) {
                return <p>No elements to display</p>;
            }
            return list.map((elem, i) => <p>{elem}</p>);
        })}
    </div>;
}
```

However in case of another signal implementation or for more optimized rendering of lists a few base components are available:

#### <If>

```tsx
import { If } from "@ncpa0cpl/vanilla-jsx";
import { sig } from "@ncpa0cpl/vanilla-jsx/signals";

function conditionComponent() {
    const someCondition = sig(false);

    return <div>
        <If 
            condition={someCondition}
            then={() => <p>Condition Met!</p>}
            else={() => <p>Condition Not Met!</p>}
        />
    </div>;
}
```

#### <Switch>

```tsx
import { Switch, Case } from "@ncpa0cpl/vanilla-jsx";

enum MyEnum {
 A, B, C
}

function displayOneOf(value: JSX.Signal<MyEnum>) {
    return <div>
        <Switch
            value={MyEnum.A}
        >
            <Case match={MyEnum.A}>
                {() => <div>Case A</div>}
            </Case>
            <Case match={MyEnum.B}>
                {() => <div>Case B</div>}
            </Case>
            <Case default>
                {() => <div>Default case</div>}
            </Case>
        </Switch>
    </div>;
}
```

#### <Range>

```tsx
import { Range } from "@ncpa0cpl/vanilla-jsx";

function displayList(list: JSX.Signal<string[]>) {
    return <div>
        <Range
            data={list}
            into={<ul />}
        >
            {(value) => <li>{value}</li>}
        </Range>
    </div>;
}
```