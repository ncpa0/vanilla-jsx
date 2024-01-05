import { setFlagsFromString } from "v8";
import { describe, expect, it, vitest } from "vitest";
import { runInNewContext } from "vm";
import { sig, Signal } from "../../src";
import { deriveMany, ReadonlySignal, VanillaJsxSignal } from "../../src/signals/signal";

setFlagsFromString("--expose_gc");
const rawGC = runInNewContext("gc");
async function gc() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  rawGC();
}

describe("VanillaJsxSignal()", () => {
  describe("current()", () => {
    it("should return the current value", () => {
      const signal = sig(1);

      expect(signal.current()).toBe(1);

      signal.dispatch(2);
      expect(signal.current()).toBe(2);

      signal.dispatch(3);
      expect(signal.current()).toBe(3);
    });
  });

  describe("add()", () => {
    it("should add a listener that is immediately called", () => {
      const signal = sig("001");
      const listener = vitest.fn();

      signal.add(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("001");

      signal.dispatch("002");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith("002");

      signal.dispatch("003");
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenCalledWith("003");
    });

    it("should return a detach function", () => {
      const signal = sig("001");
      const listener = vitest.fn();

      const listenerRef = signal.add(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("001");

      listenerRef.detach();
      signal.dispatch("002");
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe("dispatch()", () => {
    it("should call all listeners with the new value", () => {
      const signal = sig("001");
      const listener1 = vitest.fn();
      const listener2 = vitest.fn();
      const listener3 = vitest.fn();

      signal.add(listener1);
      signal.add(listener2);
      signal.add(listener3);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      signal.dispatch("002");
      expect(listener1).toHaveBeenCalledTimes(2);
      expect(listener2).toHaveBeenCalledTimes(2);
      expect(listener3).toHaveBeenCalledTimes(2);
    });

    it("correctly handles dispatch functions", () => {
      const signal = sig("001");
      const listener = vitest.fn();

      signal.add(listener);
      expect(listener).toHaveBeenCalledTimes(1);
      expect(listener).toHaveBeenCalledWith("001");

      signal.dispatch(v => v + "2");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith("0012");

      signal.dispatch(v => v + "3");
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenCalledWith("00123");

      signal.dispatch(v => v);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenCalledWith("00123");
    });
  });

  describe("listenerCount()", () => {
    it("should return the number of listeners", () => {
      const signal = sig("001");

      expect(signal.listenerCount()).toBe(0);

      const lref1 = signal.add(() => {});
      expect(signal.listenerCount()).toBe(1);

      const lref2 = signal.add(() => {});
      expect(signal.listenerCount()).toBe(2);

      const lref3 = signal.add(() => {});
      expect(signal.listenerCount()).toBe(3);

      lref1.detach();
      expect(signal.listenerCount()).toBe(2);

      lref2.detach();
      expect(signal.listenerCount()).toBe(1);

      lref3.detach();
      expect(signal.listenerCount()).toBe(0);
    });
  });

  describe("detachAll()", () => {
    it("should detach all listeners", () => {
      const signal = sig("001");
      const listener1 = vitest.fn();
      const listener2 = vitest.fn();
      const listener3 = vitest.fn();

      signal.add(listener1);
      signal.add(listener2);
      signal.add(listener3);
      expect(signal.listenerCount()).toBe(3);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);

      signal.detachAll();
      signal.dispatch("003");
      expect(signal.listenerCount()).toBe(0);
      expect(listener1).toHaveBeenCalledTimes(1);
      expect(listener2).toHaveBeenCalledTimes(1);
      expect(listener3).toHaveBeenCalledTimes(1);
    });
  });

  describe("derive()", () => {
    it("should return a derived signal", () => {
      const signal = sig("001");
      const dSignal = signal.derive(v => Number(v));

      expect(dSignal.current()).toBe(1);

      signal.dispatch("002");
      expect(dSignal.current()).toBe(2);

      signal.dispatch("003");
      expect(dSignal.current()).toBe(3);
    });

    it("should update all derived signals", () => {
      const signal = sig("010");
      const dSignal1 = signal.derive(v => Number(v));
      const dSignal2 = dSignal1.derive(v => String(v).length);

      expect(dSignal1.current()).toBe(10);
      expect(dSignal2.current()).toBe(2);

      signal.dispatch("020");
      expect(dSignal1.current()).toBe(20);
      expect(dSignal2.current()).toBe(2);

      signal.dispatch("100");
      expect(dSignal1.current()).toBe(100);
      expect(dSignal2.current()).toBe(3);

      signal.dispatch("123456");
      expect(dSignal1.current()).toBe(123456);
      expect(dSignal2.current()).toBe(6);
    });

    it("derived signal should error if dispatched to", () => {
      const signal = sig("001");
      const dSignal = signal.derive(v => Number(v)) as Signal<number>;

      expect(() => dSignal.dispatch(6)).toThrowError();
    });

    it("shouldn't perform derive calculations on signals that are not being observed", () => {
      const getLength = vitest.fn((v) => v.length);

      const s = sig("Lorem Ipsum dolor sit amet");
      const sLen = s.derive(getLength);

      expect(getLength).toHaveBeenCalledTimes(1);
      expect(sLen.current()).toEqual(26);
      expect(getLength).toHaveBeenCalledTimes(1);

      s.dispatch("Hello World!");
      expect(getLength).toHaveBeenCalledTimes(1);
      s.dispatch("foo bar baz qux");
      expect(getLength).toHaveBeenCalledTimes(1);

      expect(sLen.current()).toEqual(15);
      expect(getLength).toHaveBeenCalledTimes(2);
    });

    it("should perform derive calculations on signals that are being observed", () => {
      const getLength = vitest.fn((v) => v.length);
      const onSigChange = vitest.fn();

      const s = sig("Lorem Ipsum dolor sit amet");
      const sLen = s.derive(getLength);

      expect(getLength).toHaveBeenCalledTimes(1);
      expect(sLen.current()).toEqual(26);

      s.dispatch("");
      expect(getLength).toHaveBeenCalledTimes(1);

      sLen.add(onSigChange);
      expect(onSigChange).toHaveBeenCalledTimes(1);
      expect(onSigChange).toHaveBeenLastCalledWith(0);
      expect(getLength).toHaveBeenCalledTimes(2);

      s.dispatch("Hello World!");
      expect(onSigChange).toHaveBeenCalledTimes(2);
      expect(onSigChange).toHaveBeenLastCalledWith(12);
      expect(getLength).toHaveBeenCalledTimes(3);

      s.dispatch("Lorem ipsum dolor sit amet, consectetur adipiscing elit.");
      expect(onSigChange).toHaveBeenCalledTimes(3);
      expect(onSigChange).toHaveBeenLastCalledWith(56);
      expect(getLength).toHaveBeenCalledTimes(4);
    });

    it("should destroy the derived signal when the parent signal is destroyed", () => {
      const signal = sig("foo");
      const dSignal = signal.derive(v => v.repeat(2));
      const destroySpy = vitest.spyOn(dSignal, "destroy");

      expect(dSignal.current()).toBe("foofoo");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      signal.destroy();

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("derived signals should be possible to garbage collect", async () => {
      const s = sig("foo") as VanillaJsxSignal<string>;
      const derivedRefs = s["derivedSignals"];
      let derived: ReadonlySignal<string> | null = s.derive(v => v.repeat(2));

      expect(derived.current()).toBe("foofoo");
      expect(derivedRefs[0]!.deref()).toBeDefined();

      derived = null;
      await gc();

      expect(derivedRefs).toHaveLength(1);
      expect(derivedRefs[0]!.deref()).toBeUndefined();

      // Signal should remove empty references on change
      s.dispatch("bar");

      expect(derivedRefs).toHaveLength(0);
    });
  });

  describe("destroy()", () => {
    it("should detach all listeners", () => {
      const signal = sig("001");
      const listener1 = vitest.fn();
      const listener2 = vitest.fn();
      const listener3 = vitest.fn();

      signal.add(listener1);
      signal.add(listener2);
      signal.add(listener3);
      expect(signal.listenerCount()).toBe(3);

      signal.destroy();
      expect(signal.listenerCount()).toBe(0);
    });

    it("should error on add() call", () => {
      const signal = sig("001");
      signal.destroy();

      expect(() => signal.add(() => {})).toThrowError();
    });

    it("should error on dispatch() call", () => {
      const signal = sig("001");
      signal.destroy();

      expect(() => signal.dispatch("002")).toThrowError();
    });

    it("should error on derive() call", () => {
      const signal = sig("001");
      signal.destroy();

      expect(() => signal.derive(v => v)).toThrowError();
    });

    it("should also destroy all derived signals", () => {
      const signal = sig("001");
      const dSignal = signal.derive(v => Number(v));
      const dSignal2 = dSignal.derive(v => String(v).length);

      signal.destroy();
      expect(() => dSignal.add(() => {})).toThrowError();
      expect(() => dSignal2.add(() => {})).toThrowError();
    });

    it("detaches itself from the parent signal", () => {
      const signal = sig("001");
      const dSignal = signal.derive(v => Number(v));

      dSignal.destroy();
      signal.dispatch("002");
      expect(dSignal.current()).toBe(1);
    });
  });

  describe("deriveMany()", () => {
    it("should correctly derive from 2 sources", () => {
      const sig1 = sig("Hello");
      const sig2 = sig("World");

      const derived = deriveMany(sig1, sig2, (v1, v2) => `${v1} ${v2}`);
      expect(derived.current()).toBe("Hello World");

      sig1.dispatch("Goodbye");
      expect(derived.current()).toBe("Goodbye World");

      sig2.dispatch("Universe");
      expect(derived.current()).toBe("Goodbye Universe");
    });

    it("should correctly derive from 4 sources", () => {
      const sig1 = sig("foo");
      const sig2 = sig("bar");
      const sig3 = sig("baz");
      const sig4 = sig(2);

      const derived = deriveMany(sig1, sig2, sig3, sig4, (v1, v2, v3, v4) => `[${v1} ${v2} ${v3}]`.repeat(v4));
      expect(derived.current()).toBe("[foo bar baz][foo bar baz]");

      sig1.dispatch("OOF");
      expect(derived.current()).toBe("[OOF bar baz][OOF bar baz]");

      sig3.dispatch("ZAB");
      expect(derived.current()).toBe("[OOF bar ZAB][OOF bar ZAB]");

      sig2.dispatch("RAB");
      expect(derived.current()).toBe("[OOF RAB ZAB][OOF RAB ZAB]");

      sig4.dispatch(3);
      expect(derived.current()).toBe("[OOF RAB ZAB][OOF RAB ZAB][OOF RAB ZAB]");
    });

    it("should keep functioning even when some of the sources were destroyed", () => {
      const sig1 = sig("foo");
      const sig2 = sig("bar");
      const sig3 = sig("baz");

      const derived = deriveMany(sig1, sig2, sig3, (v1, v2, v3) => `[${v1} ${v2} ${v3}]`);
      const destroySpy = vitest.spyOn(derived, "destroy");
      expect(derived.current()).toBe("[foo bar baz]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig2.destroy();
      expect(derived.current()).toBe("[foo bar baz]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig1.dispatch("OOF");
      expect(derived.current()).toBe("[OOF bar baz]");

      sig3.dispatch("ZAB");
      expect(derived.current()).toBe("[OOF bar ZAB]");

      sig1.destroy();
      expect(derived.current()).toBe("[OOF bar ZAB]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig3.dispatch("1234");
      expect(derived.current()).toBe("[OOF bar 1234]");
    });

    it("should destroy the derived signal once all sources are destroyed", () => {
      const sig1 = sig("foo");
      const sig2 = sig("bar");
      const sig3 = sig("baz");

      const derived = deriveMany(sig1, sig2, sig3, (v1, v2, v3) => `[${v1} ${v2} ${v3}]`);
      const destroySpy = vitest.spyOn(derived, "destroy");
      expect(derived.current()).toBe("[foo bar baz]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig1.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig2.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig3.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("derived signals should be possible to garbage collect", async () => {
      const s1 = sig("foo") as VanillaJsxSignal<string>;
      const s2 = sig("bar") as VanillaJsxSignal<string>;
      const s3 = sig("baz") as VanillaJsxSignal<string>;
      const derivedRefs1 = s1["derivedSignals"];
      const derivedRefs2 = s2["derivedSignals"];
      const derivedRefs3 = s3["derivedSignals"];
      let derived: ReadonlySignal<string> | null = deriveMany(s1, s2, s3, (v1, v2, v3) => `[${v1} ${v2} ${v3}]`);

      expect(derived.current()).toBe("[foo bar baz]");
      expect(derivedRefs1[0]!.deref()).toBeDefined();
      expect(derivedRefs2[0]!.deref()).toBeDefined();
      expect(derivedRefs3[0]!.deref()).toBeDefined();

      derived = null;
      await gc();

      expect(derivedRefs1).toHaveLength(1);
      expect(derivedRefs2).toHaveLength(1);
      expect(derivedRefs3).toHaveLength(1);
      expect(derivedRefs1[0]!.deref()).toBeUndefined();
      expect(derivedRefs2[0]!.deref()).toBeUndefined();
      expect(derivedRefs3[0]!.deref()).toBeUndefined();

      // Signal should remove empty references on change
      s1.dispatch("");
      s2.dispatch("");
      s3.dispatch("");

      expect(derivedRefs1).toHaveLength(0);
      expect(derivedRefs2).toHaveLength(0);
      expect(derivedRefs3).toHaveLength(0);
    });
  });
});
