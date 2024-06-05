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

VanillaJSX does not enforce any specific signal implementation, but it does provide one if you wish to use it. For a given signal to be able to be used it needs to be registered with the `SignalsReg`:

```typescript
import { SignalsReg } from "@ncpa0cpl/vanilla-jsx";
import { MySignal } from "./my-signal";

class MySignalInterop {
    is(maybeSignal: unknown): maybeSignal is MySignal<unknown> {
        return maybeSignal instanceof MySignal;
    }
    add(signal: MySignal<any>, listener: (value: any) => void) {
        signal.addListener(listener);
        listener(signal.value);
        return () => signal.removeListener(listener);
    }
}

SignalsReg.register(new MySignalInterop());

declare global {
    namespace JSX {
        interface SupportedSignals<V> {
            mySignal: MySignal<V>;
        }
    }
}
```

#### Provided interops

There's a few interops provided by default that can be imported and registered:


```typescript
import {
    SignalsReg,
    JsSignalInterop,
    MiniSignalInterop,
    PreactSignalInterop,
} from "@ncpa0cpl/vanilla-jsx";

SignalsReg.register(new JsSignalInterop());
SignalsReg.register(new MiniSignalInterop());
SignalsReg.register(new PreactSignalInterop());
```

### VanillaJSX Signals usage example

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