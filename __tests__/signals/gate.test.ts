import { describe, expect, it } from "vitest";
import { sig } from "../../src/signals";
import {
  bindSignal,
  sigProxy,
  SignalsReg,
} from "../../src/sig-proxy/_proxy";
import { SignalInteropInterface } from "../../src/sig-proxy/_interface";
import { createElement } from "../../src/reconciler/reconciler";
import { gc } from "../gc-util";
import { sleep } from "../utils";

describe("SignalsReg stop/resume", () => {
  it("should suppress DOM mutations for signals bound within the stopped subtree", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("b");
  });

  it("should not affect signals bound outside of the stopped subtree", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const outside = document.createElement("div");
    document.body.appendChild(outside);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });
    bindSignal(s, outside, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe("a");
    expect(outside.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");
    expect(outside.getAttribute("data-value")).toBe("b");

    SignalsReg.resume(root);
    // the outside binding was never suppressed so it should not receive
    // an extra callback here
    expect(child.getAttribute("data-value")).toBe("b");
    expect(outside.getAttribute("data-value")).toBe("b");
  });

  it("should re-apply only the most recent value after multiple changes", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    s.dispatch("c");
    s.dispatch("d");

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("d");
  });

  it("should support nested stops", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const leaf = document.createElement("span");
    inner.appendChild(leaf);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const s = sig("a");
    bindSignal(s, leaf, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(outer);
    SignalsReg.stop(inner);

    s.dispatch("b");
    expect(leaf.getAttribute("data-value")).toBe("a");

    // resuming the inner subtree should keep the binding suppressed
    // since it is still contained within the stopped outer subtree
    SignalsReg.resume(inner);

    s.dispatch("c");
    expect(leaf.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(outer);
    expect(leaf.getAttribute("data-value")).toBe("c");
  });

  it("should resume descendant stopped subtrees when resuming a parent", () => {
    const outer = document.createElement("div");
    const inner = document.createElement("div");
    const leaf = document.createElement("span");
    inner.appendChild(leaf);
    outer.appendChild(inner);
    document.body.appendChild(outer);

    const s = sig("a");
    bindSignal(s, leaf, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(outer);
    SignalsReg.stop(inner);

    s.dispatch("b");
    expect(leaf.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(outer);

    s.dispatch("c");
    expect(leaf.getAttribute("data-value")).toBe("c");
  });

  it("should gate bindings created with sig.bindAttribute()", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig<string>("a");
    sig.bindAttribute(s, child, "data-value");

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");

    s.dispatch(undefined);
    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe(null);
  });

  it("should gate bindings created with sig.bindv()", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig<string>("a");
    sig.bindv(s, child, "title");

    expect(child.title).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.title).toBe("a");

    SignalsReg.resume(root);
    expect(child.title).toBe("b");
  });

  it("should gate the initial value of bindings created while stopped", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");

    SignalsReg.stop(root);
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe(null);

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("a");
  });

  it("should not re-apply mutations for bindings detached while stopped", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    const unbind = sigProxy(s).bindTo(child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    unbind();

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("a");
  });

  it("should work for detached subtrees", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("b");
  });

  it("should not leak pending bindings across stop/resume cycles", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    let calls = 0;
    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      calls++;
      elem.setAttribute("data-value", value);
    });

    expect(calls).toBe(1);

    SignalsReg.stop(root);
    s.dispatch("b");
    SignalsReg.resume(root);

    expect(calls).toBe(2);
    expect(child.getAttribute("data-value")).toBe("b");

    SignalsReg.stop(root);
    s.dispatch("c");
    expect(calls).toBe(2);
    SignalsReg.resume(root);

    expect(calls).toBe(3);
    expect(child.getAttribute("data-value")).toBe("c");
  });

  it("should invoke the binding callback only once on resume after multiple gated dispatches", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    let calls = 0;
    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      calls++;
      elem.setAttribute("data-value", value);
    });

    expect(calls).toBe(1);

    SignalsReg.stop(root);

    s.dispatch("b");
    s.dispatch("c");
    s.dispatch("d");
    expect(calls).toBe(1);

    SignalsReg.resume(root);
    expect(calls).toBe(2);
    expect(child.getAttribute("data-value")).toBe("d");
  });

  it("should treat repeated stop() calls on the same element as one stop", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);
    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("b");
  });

  it("should not lift the stop of unrelated subtrees when resuming", () => {
    const rootA = document.createElement("div");
    const childA = document.createElement("span");
    rootA.appendChild(childA);
    document.body.appendChild(rootA);

    const rootB = document.createElement("div");
    const childB = document.createElement("span");
    rootB.appendChild(childB);
    document.body.appendChild(rootB);

    const s = sig("a");
    bindSignal(s, childA, (elem, value) => {
      elem.setAttribute("data-value", value);
    });
    bindSignal(s, childB, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(rootA);

    s.dispatch("b");
    expect(childA.getAttribute("data-value")).toBe("a");
    expect(childB.getAttribute("data-value")).toBe("b");

    // resuming an element that was never stopped should not affect
    // other stopped subtrees
    SignalsReg.resume(rootB);

    s.dispatch("c");
    expect(childA.getAttribute("data-value")).toBe("a");
    expect(childB.getAttribute("data-value")).toBe("c");

    SignalsReg.resume(rootA);
    expect(childA.getAttribute("data-value")).toBe("c");
  });

  it("should ignore resume() of an element nested within a stopped subtree", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");

    // child is inside the stopped root, resuming it is a no-op
    SignalsReg.resume(child);

    s.dispatch("c");
    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("c");
  });

  it("should gate bindings attached to the stopped root element itself", () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, root, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(root.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(root.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(root.getAttribute("data-value")).toBe("b");
  });

  it("should gate bindings on descendants at any depth", () => {
    const root = document.createElement("div");
    const level1 = document.createElement("div");
    const level2 = document.createElement("div");
    const leaf = document.createElement("span");
    level2.appendChild(leaf);
    level1.appendChild(level2);
    root.appendChild(level1);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, leaf, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(leaf.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(leaf.getAttribute("data-value")).toBe("b");
  });

  it("should apply mutations again when the element is moved out of the stopped subtree", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const outside = document.createElement("div");
    document.body.appendChild(outside);

    let calls = 0;
    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      calls++;
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("a");

    // move the element outside of the stopped subtree
    outside.appendChild(child);

    s.dispatch("c");
    expect(calls).toBe(2);
    expect(child.getAttribute("data-value")).toBe("c");

    SignalsReg.resume(root);
    // the binding already applied the latest value before the resume so
    // there should be no extra callback here
    expect(calls).toBe(2);
    expect(child.getAttribute("data-value")).toBe("c");
  });

  it("should gate mutations when the element is moved into a stopped subtree", () => {
    const root = document.createElement("div");
    root.appendChild(document.createElement("div"));
    document.body.appendChild(root);

    const outside = document.createElement("div");
    const child = document.createElement("span");
    outside.appendChild(child);
    document.body.appendChild(outside);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child.getAttribute("data-value")).toBe("b");

    // move the element into the stopped subtree
    root.appendChild(child);

    s.dispatch("c");
    expect(child.getAttribute("data-value")).toBe("b");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("c");
  });

  it("should gate all signals bound to the same element", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s1 = sig("a");
    const s2 = sig("x");
    bindSignal(s1, child, (elem, value) => {
      elem.setAttribute("data-one", value);
    });
    bindSignal(s2, child, (elem, value) => {
      elem.setAttribute("data-two", value);
    });

    SignalsReg.stop(root);

    s1.dispatch("b");
    s2.dispatch("y");
    expect(child.getAttribute("data-one")).toBe("a");
    expect(child.getAttribute("data-two")).toBe("x");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-one")).toBe("b");
    expect(child.getAttribute("data-two")).toBe("y");
  });

  it("should re-apply a signal bound to multiple elements within the subtree", () => {
    const root = document.createElement("div");
    const child1 = document.createElement("span");
    const child2 = document.createElement("span");
    root.appendChild(child1);
    root.appendChild(child2);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, child1, (elem, value) => {
      elem.setAttribute("data-value", value);
    });
    bindSignal(s, child2, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(child1.getAttribute("data-value")).toBe("a");
    expect(child2.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child1.getAttribute("data-value")).toBe("b");
    expect(child2.getAttribute("data-value")).toBe("b");
  });

  it("should gate derived signals", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig(1);
    const derived = s.derive((value) => `v-${value}`);
    bindSignal(derived, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe("v-1");

    SignalsReg.stop(root);

    s.dispatch(2);
    expect(child.getAttribute("data-value")).toBe("v-1");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("v-2");
  });

  it("should gate mutations committed as a part of a batch", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    sig.startBatch();
    s.dispatch("b");
    s.dispatch("c");
    sig.commitBatch();

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("c");
  });

  it("should not crash when the bound element gets garbage collected while stopped", async () => {
    const root = document.createElement("div");
    document.body.appendChild(root);

    const s = sig("a");
    let elem: HTMLSpanElement | null = document.createElement("span");
    root.appendChild(elem);

    bindSignal(s, elem, (boundElem, value) => {
      boundElem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");

    elem.remove();
    elem = null;
    await gc();

    expect(() => SignalsReg.resume(root)).not.toThrow();

    s.dispatch("c");
    expect(s.listenerCount()).toBe(0);
  });

  it("should gate bindings attached to text nodes", () => {
    const root = document.createElement("div");
    const text = document.createTextNode("a");
    root.appendChild(text);
    document.body.appendChild(root);

    const s = sig("a");
    bindSignal(s, text, (boundText, value) => {
      boundText.textContent = value;
    });

    expect(text.textContent).toBe("a");

    SignalsReg.stop(root);

    s.dispatch("b");
    expect(text.textContent).toBe("a");

    SignalsReg.resume(root);
    expect(text.textContent).toBe("b");
  });

  it("should gate signals from any registered interop", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    class FakeSignal<T> {
      private listeners: ((value: T) => void)[] = [];
      constructor(private _value: T) {}
      get(): T {
        return this._value;
      }
      set(value: T) {
        this._value = value;
        for (const listener of this.listeners.slice()) {
          listener(value);
        }
      }
      subscribe(cb: (value: T) => void): () => void {
        this.listeners.push(cb);
        // per the interop contract the listener should be called once
        // immediately after adding it
        cb(this._value);
        return () => {
          const idx = this.listeners.indexOf(cb);
          this.listeners.splice(idx, 1);
        };
      }
    }

    class FakeSignalInterop implements SignalInteropInterface<FakeSignal<any>> {
      is(signal: unknown): signal is FakeSignal<any> {
        return signal instanceof FakeSignal;
      }
      add(signal: FakeSignal<any>, cb: (value: any) => any): () => void {
        return signal.subscribe(cb);
      }
    }

    SignalsReg.register(new FakeSignalInterop());

    const s = new FakeSignal("a");
    bindSignal(s as any, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.stop(root);

    s.set("b");
    expect(child.getAttribute("data-value")).toBe("a");

    SignalsReg.resume(root);
    expect(child.getAttribute("data-value")).toBe("b");
  });

  it("should propagate mutations triggered by a binding callback during resume", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s1 = sig(1);
    const s2 = sig("x");
    bindSignal(s1, child, (elem, value) => {
      elem.setAttribute("data-one", String(value));
      if (value > 1) {
        s2.dispatch("y");
      }
    });
    bindSignal(s2, child, (elem, value) => {
      elem.setAttribute("data-two", value);
    });

    expect(child.getAttribute("data-one")).toBe("1");
    expect(child.getAttribute("data-two")).toBe("x");

    SignalsReg.stop(root);

    s1.dispatch(2);
    expect(child.getAttribute("data-one")).toBe("1");
    expect(child.getAttribute("data-two")).toBe("x");

    SignalsReg.resume(root);
    // re-applying the s1 binding dispatches s2, which is no longer
    // gated at that point, so its mutation should be applied too
    expect(child.getAttribute("data-one")).toBe("2");
    expect(child.getAttribute("data-two")).toBe("y");
  });

  it("should not gate listeners added without an element binding", () => {
    const root = document.createElement("div");
    const child = document.createElement("span");
    root.appendChild(child);
    document.body.appendChild(root);

    const s = sig("a");
    const values: string[] = [];
    sigProxy(s).add((value) => {
      values.push(value);
    });
    bindSignal(s, child, (elem, value) => {
      elem.setAttribute("data-value", value);
    });

    SignalsReg.stop(root);

    s.dispatch("b");
    // plain listeners are not associated with any element so they
    // should keep receiving all values
    expect(values).toEqual(["a", "b"]);

    SignalsReg.resume(root);
  });

  describe("reconciler integration", () => {
    it("should gate class, attribute and child bindings created by the reconciler", () => {
      const root = document.createElement("div");
      root.appendChild(document.createElement("div"));
      document.body.appendChild(root);

      const cls = sig("foo");
      const attr = sig("1");
      const text = sig("hello");

      const div = createElement(
        "div",
        { class: cls, "data-count": attr } as any,
        text,
      );
      root.appendChild(div);

      expect(div.classList.contains("foo")).toBe(true);
      expect(div.getAttribute("data-count")).toBe("1");
      expect(div.textContent).toBe("hello");

      SignalsReg.stop(root);

      cls.dispatch("bar");
      attr.dispatch("2");
      text.dispatch("world");

      expect(div.classList.contains("bar")).toBe(false);
      expect(div.getAttribute("data-count")).toBe("1");
      expect(div.textContent).toBe("hello");

      SignalsReg.resume(root);

      expect(div.classList.contains("foo")).toBe(false);
      expect(div.classList.contains("bar")).toBe(true);
      expect(div.getAttribute("data-count")).toBe("2");
      expect(div.textContent).toBe("world");
    });

    it("should keep signal-driven children in sync after resume", () => {
      const root = document.createElement("div");
      document.body.appendChild(root);

      const names = sig(["foo", "bar"]);
      const div = createElement(
        "div",
        undefined,
        names.derive((list) => list.join(", ")),
      );
      root.appendChild(div);

      expect(div.textContent).toBe("foo, bar");

      SignalsReg.stop(root);

      names.immer((draft) => {
        draft.push("baz");
      });
      expect(div.textContent).toBe("foo, bar");

      SignalsReg.resume(root);
      expect(div.textContent).toBe("foo, bar, baz");
    });

    it("should apply bindings of elements created while detached even when a stop is active (documented limitation)", () => {
      const root = document.createElement("div");
      document.body.appendChild(root);

      const text = sig("hello");

      SignalsReg.stop(root);

      // the element is not attached to any tree while it is being created
      // so its initial bindings are applied immediately - containment is
      // always evaluated against the current position of the element in
      // the DOM tree
      const div = createElement("div", undefined, text);
      root.appendChild(div);

      expect(div.textContent).toBe("hello");

      // from now on the element is contained within the stopped subtree
      text.dispatch("world");
      expect(div.textContent).toBe("hello");

      SignalsReg.resume(root);
      expect(div.textContent).toBe("world");
    });
  });

  describe("garbage collection", () => {
    const registries: FinalizationRegistry<string>[] = [];

    /**
     * Registers a callback that will be called once the given value gets
     * garbage collected.
     *
     * Note: the elements used in the tests below are never attached to
     * the document, this way the GC state is not affected by the DOM
     * implementation potentially retaining removed nodes.
     */
    function track(value: object, onCollected: () => void) {
      const registry = new FinalizationRegistry(() => onCollected());
      registry.register(value, "target");
      registries.push(registry);
    }

    it("should not prevent bound signals from being garbage collected", async () => {
      let collected = false;

      // the whole root/element/signal graph lives outside of the
      // document so that dropping all local references makes all of it
      // unreachable
      let root: HTMLDivElement | null = document.createElement("div");
      let child: HTMLSpanElement | null = document.createElement("span");
      root.appendChild(child);

      let s: any = sig("a");
      track(s, () => {
        collected = true;
      });

      bindSignal(s, child, (elem, value) => {
        elem.setAttribute("data-value", value);
      });

      // the binding holds a strong reference to the signal and the
      // signal's listener holds the binding - this cycle has to be
      // collected as a whole
      child = null;
      root = null;
      s = null;

      await gc();
      await sleep(0);

      expect(collected).toBe(true);
    });

    it("should retain a pending signal only until the subtree is resumed", async () => {
      let collected = false;

      // the root is kept alive since it is needed to resume the subtree,
      // the element and the signal are dropped
      const root = document.createElement("div");
      let child: HTMLSpanElement | null = document.createElement("span");
      root.appendChild(child);

      let s: any = sig("a");
      track(s, () => {
        collected = true;
      });

      bindSignal(s, child, (elem, value) => {
        elem.setAttribute("data-value", value);
      });

      SignalsReg.stop(root);

      // the suppressed mutation puts the binding on the pending list,
      // which holds a strong reference to the signal
      s.dispatch("b");

      child.remove();
      child = null;
      s = null;

      await gc();
      await sleep(0);

      // while the binding is pending the signal is expected to be
      // retained - this is what allows the mutation to be re-applied
      // once the subtree gets resumed
      expect(collected).toBe(false);

      // the flush finds no element so the binding gets dropped from the
      // pending list, making the signal unreachable again
      SignalsReg.resume(root);

      await gc();
      await sleep(0);

      expect(collected).toBe(true);
    });
  });
});