
# Freezing parts of the DOM: `SignalsReg.stop` / `resume`

Signal bindings attached to a subtree can be temporarily **suppressed** and later resumed. While stopped, binding callbacks do not mutate the DOM; on resume each suppressed binding re-applies its latest value. Because binding callbacks are idempotent setters, the hidden subtree catches up with the current signal values exactly as if nothing happened.

```typescript
import { SignalsReg } from "@ncpa0cpl/vanilla-jsx";

SignalsReg.stop(subtreeRoot); // freeze all bindings within the subtree
SignalsReg.resume(subtreeRoot); // re-apply pending bindings, unfreeze
```

This is the mechanism behind the `memo` option of `<If>` and `<Switch>`: hidden memoized branches are stopped, shown branches resumed. You can use it directly to keep "cold" parts of the UI mounted but inert.

Implementation notes:

- Containment is evaluated by walking up `parentElement` from the mutated element, so it reflects the element's *current* tree position at the time of each mutation. Elements moved out of a stopped subtree resume mutating immediately.
- `stop()` is `O(1)` and has zero overhead while nothing is stopped.
