import {
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  Mock,
  vitest,
} from "vitest";
import { sig, Signal } from "../../src/signals";
import {
  ReadonlySignal,
  SignalListenerReference,
  VReadonlySignal,
  VSignal,
} from "../../src/signals/signal";
import { gc } from "../gc-util";
import { sleep } from "../utils";

describe("VSignal()", () => {
  beforeAll(() => {
    vitest.spyOn(console, "error");
  });

  afterEach(() => {
    vitest.clearAllMocks();
  });

  it("sub-type signals are assignable to their super types", () => {
    const acceptStringOrNull = (s: ReadonlySignal<string | null>) => {};

    const stringSig = sig("foo");

    // should not throw type errors
    acceptStringOrNull(stringSig);
  });

  describe("current()", () => {
    it("should return the current value", () => {
      const signal = sig(1);

      expect(signal.get()).toBe(1);

      signal.dispatch(2);
      expect(signal.get()).toBe(2);

      signal.dispatch(3);
      expect(signal.get()).toBe(3);
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

  describe("observe()", () => {
    it("should add a listener that is immediately called", () => {
      const signal = sig("001");
      const listener = vitest.fn();

      signal.observe(listener);
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

      const listenerRef = signal.observe(listener);
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

      signal.dispatch((v) => v + "2");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenCalledWith("0012");

      signal.dispatch((v) => v + "3");
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenCalledWith("00123");

      signal.dispatch((v) => v);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenCalledWith("00123");
    });

    describe("with custom compare fn", () => {
      it("propagets change events only when the compare function returns true", () => {
        const s = sig({ foo: 1, bar: "2" }, {
          compare: (a, b) => a.foo === b.foo && a.bar === b.bar,
        });

        expect(s.get()).toEqual({ foo: 1, bar: "2" });

        const onChange = vitest.fn();
        s.add(onChange);
        onChange.mockClear();

        s.dispatch({ foo: 2, bar: "2" });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ foo: 2, bar: "2" });
        expect(s.get()).toEqual({ foo: 2, bar: "2" });

        onChange.mockClear();

        s.dispatch({ foo: 2, bar: "2" });
        expect(onChange).not.toHaveBeenCalled();

        onChange.mockClear();

        s.dispatch({ foo: 2, bar: "a" });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ foo: 2, bar: "a" });
        expect(s.get()).toEqual({ foo: 2, bar: "a" });

        onChange.mockClear();

        s.dispatch({ foo: 2, bar: "a" });
        expect(onChange).not.toHaveBeenCalled();

        onChange.mockClear();

        // @ts-expect-error
        s.dispatch({ foo: 2, bar: "a", baz: 3 });
        expect(onChange).not.toHaveBeenCalled();
      });

      it("updates sinks only when the compare function returns true", () => {
        const s = sig({ foo: 1, bar: "2" }, {
          compare: (a, b) => a.foo === b.foo && a.bar === b.bar,
        });

        let i = 0;
        const sink = s.derive(() => i++);
        expect(sink.get()).toEqual(0);

        s.dispatch({ foo: 2, bar: "2" });
        expect(sink.get()).toEqual(1);

        s.dispatch({ foo: 2, bar: "2" });
        expect(sink.get()).toEqual(1);

        s.dispatch({ foo: 2, bar: "a" });
        expect(sink.get()).toEqual(2);

        s.dispatch({ foo: 2, bar: "a" });
        expect(sink.get()).toEqual(2);

        // @ts-expect-error
        s.dispatch({ foo: 2, bar: "a", baz: 3 });
        expect(sink.get()).toEqual(2);
      });
    });
  });

  describe("immer()", () => {
    it("correctly partially updates objects", () => {
      const source = sig({
        foo: { a: 1, b: 2 },
        bar: [1, 2, 3],
        baz: "abc",
      });

      let prevValue = source.get();
      expect(prevValue).toEqual({
        foo: { a: 1, b: 2 },
        bar: [1, 2, 3],
        baz: "abc",
      });

      source.immer(draft => {
        draft.foo.a = 999;
      });

      // only foo should change
      let currentValue = source.get();
      expect(currentValue).toEqual({
        foo: { a: 999, b: 2 },
        bar: [1, 2, 3],
        baz: "abc",
      });
      expect(prevValue.bar === currentValue.bar).toBe(true);

      prevValue = currentValue;
      source.immer(draft => {
        draft.baz = "lorem ipsum";
        return draft;
      });

      // only baz should change
      currentValue = source.get();
      expect(currentValue).toEqual({
        foo: { a: 999, b: 2 },
        bar: [1, 2, 3],
        baz: "lorem ipsum",
      });
      expect(prevValue.foo === currentValue.foo).toBe(true);
      expect(prevValue.bar === currentValue.bar).toBe(true);
    });

    it("correctly partially updates arrays", () => {
      const source = sig([
        { v: 1 },
        { v: 2 },
      ]);

      expect(source.get()).toEqual([
        { v: 1 },
        { v: 2 },
      ]);

      let prevValue = source.get();
      source.immer(draft => {
        draft.push({ v: 4 });
      });

      expect(source.get()).toEqual([
        { v: 1 },
        { v: 2 },
        { v: 4 },
      ]);
      expect(prevValue[0] === source.get()[0]).toBe(true);
      expect(prevValue[1] === source.get()[1]).toBe(true);

      prevValue = source.get();
      source.immer(draft => {
        draft[1]!.v = 95;
      });

      expect(source.get()).toEqual([
        { v: 1 },
        { v: 95 },
        { v: 4 },
      ]);
      expect(prevValue[0] === source.get()[0]).toBe(true);
      expect(prevValue[2] === source.get()[2]).toBe(true);
    });

    it("correctly handles values that may be undefined", () => {
      const source = sig<{ foo: number; bar: number }>();

      expect(source.get()).toEqual(undefined);

      source.immer(draft => {
        expect(draft).toBeUndefined();
        return {
          foo: 5,
          bar: 10,
        };
      });

      expect(source.get()).toEqual({
        foo: 5,
        bar: 10,
      });
    });

    it("correctly handles values that may be null", () => {
      const source = sig<{ foo: number; bar: number } | null>(null);

      expect(source.get()).toEqual(null);

      source.immer(draft => {
        expect(draft).toBeNull();
        return {
          foo: 5,
          bar: 10,
        };
      });

      expect(source.get()).toEqual({
        foo: 5,
        bar: 10,
      });

      source.immer(draft => {
        return null;
      });

      expect(source.get()).toEqual(null);
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
      const dSignal = signal.derive((v) => Number(v));

      expect(dSignal.get()).toBe(1);

      signal.dispatch("002");
      expect(dSignal.get()).toBe(2);

      signal.dispatch("003");
      expect(dSignal.get()).toBe(3);
    });

    it("should update all derived signals", () => {
      const signal = sig("010");
      const dSignal1 = signal.derive((v) => Number(v));
      const dSignal2 = dSignal1.derive((v) => String(v).length);

      expect(dSignal1.get()).toBe(10);
      expect(dSignal2.get()).toBe(2);

      signal.dispatch("020");
      expect(dSignal1.get()).toBe(20);
      expect(dSignal2.get()).toBe(2);

      signal.dispatch("100");
      expect(dSignal1.get()).toBe(100);
      expect(dSignal2.get()).toBe(3);

      signal.dispatch("123456");
      expect(dSignal1.get()).toBe(123456);
      expect(dSignal2.get()).toBe(6);
    });

    it("derived signal should error if dispatched to", () => {
      const signal = sig("001");
      const dSignal = signal.derive((v) => Number(v)) as Signal<number>;

      expect(() => dSignal.dispatch(6)).toThrowError();
    });

    it("shouldn't perform derive calculations on signals that are not being observed", () => {
      const getLength = vitest.fn((v) => v.length);

      const s = sig("Lorem Ipsum dolor sit amet");
      const sLen = s.derive(getLength);

      expect(getLength).toHaveBeenCalledTimes(0);
      expect(sLen.get()).toEqual(26);
      expect(getLength).toHaveBeenCalledTimes(1);

      s.dispatch("Hello World!");
      expect(getLength).toHaveBeenCalledTimes(1);
      s.dispatch("foo bar baz qux");
      expect(getLength).toHaveBeenCalledTimes(1);

      expect(sLen.get()).toEqual(15);
      expect(getLength).toHaveBeenCalledTimes(2);
    });

    it("should perform derive calculations on signals that are being observed", () => {
      const getLength = vitest.fn((v) => v.length);
      const onSigChange = vitest.fn();

      const s = sig("Lorem Ipsum dolor sit amet");
      const sLen = s.derive(getLength);

      expect(getLength).toHaveBeenCalledTimes(0);
      expect(sLen.get()).toEqual(26);

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

    it("should update or not down the chain derived signals depending on if they are observed", () => {
      const head = sig(0) as VSignal<number>;

      const d1 = head.derive((v) => v + 1) as VSignal<number>;
      const d2 = d1.derive((v) => v + 1) as VSignal<number>;
      const d3 = d2.derive((v) => v + 1) as VSignal<number>;
      const d4 = d3.derive((v) => v + 1) as VSignal<number>;

      expect(head.get()).toBe(0);
      expect(d1.get()).toBe(1);
      expect(d2.get()).toBe(2);
      expect(d3.get()).toBe(3);
      expect(d4.get()).toBe(4);

      head.dispatch(10);

      // inner value does not re-calculate until it is observed
      expect(head["value"]).toBe(10);
      expect(d1["value"]).toBe(1);
      expect(d2["value"]).toBe(2);
      expect(d3["value"]).toBe(3);
      expect(d4["value"]).toBe(4);

      expect(head.get()).toBe(10);
      expect(d1.get()).toBe(11);
      expect(d2.get()).toBe(12);
      expect(d3.get()).toBe(13);
      expect(d4.get()).toBe(14);

      const onD4Change = vitest.fn();
      // now since d1 is observed, all derived should be recalculated
      d4.add(onD4Change);
      onD4Change.mockClear();

      head.dispatch(26);

      expect(onD4Change).toHaveBeenCalledTimes(1);
      expect(onD4Change).toHaveBeenLastCalledWith(30);

      expect(head["value"]).toBe(26);
      expect(d1["value"]).toBe(27);
      expect(d2["value"]).toBe(28);
      expect(d3["value"]).toBe(29);
      expect(d4["value"]).toBe(30);

      expect(head.get()).toBe(26);
      expect(d1.get()).toBe(27);
      expect(d2.get()).toBe(28);
      expect(d3.get()).toBe(29);
      expect(d4.get()).toBe(30);
    });

    it("should destroy the derived signal when the parent signal is destroyed", () => {
      const signal = sig("foo");
      const dSignal = signal.derive((v) => v.repeat(2));
      const destroySpy = vitest.spyOn(dSignal, "destroy");

      expect(dSignal.get()).toBe("foofoo");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      signal.destroy();

      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("derived signals should be possible to garbage collect", async () => {
      const s = sig("foo") as VSignal<string>;
      const derivedRefs = s["derivedSignals"];
      let derived: ReadonlySignal<string> | null = s.derive((v) => v.repeat(2));

      expect(derived.get()).toBe("foofoo");
      expect(derivedRefs[0]!.deref()).toBeDefined();

      derived = null;
      await gc();

      expect(derivedRefs).toHaveLength(1);
      expect(derivedRefs[0]!.deref()).toBeUndefined();

      // Signal should remove empty references on change
      s.dispatch("bar");

      expect(derivedRefs).toHaveLength(0);
    });

    it("derived signals should not be GCd if they are being observed", async () => {
      const s = sig("foo") as VSignal<string>;
      const getLength = vitest.fn((v: string) => v.length);
      let derived: ReadonlySignal<number> | null = s.derive(getLength);
      const derivedRef = new WeakRef(derived);

      expect(derived.get()).toBe(3);
      expect(derivedRef.deref()).toBeDefined();

      derived.observe(() => {});
      derived = null;

      await gc();
      s.dispatch("foobar");
      expect(s.derivedCount()).toBe(1);
      expect(derivedRef.deref()).toBeDefined();

      await gc();
      await gc();
      s.dispatch("foobar");
      expect(s.derivedCount()).toBe(1);
      expect(derivedRef.deref()).toBeDefined();
    });

    it("deeply derived signals should not be GCd when they are being observed", async () => {
      const head = sig(1);
      let callCount = 0;
      (function() {
        const tail = head
          .derive((v) => v + 1)
          .derive((v) => v + 1)
          .derive((v) => ({
            DERIVED: true,
          }));
        tail.observe(() => {
          callCount++;
        });
      })();

      callCount = 0;
      expect(callCount).toBe(0);
      head.dispatch(5);
      expect(callCount).toBe(1);

      await gc();
      await sleep(100);
      await gc();
      await sleep(100);
      await gc();
      await sleep(100);
      await gc();

      callCount = 0;
      expect(callCount).toBe(0);
      head.dispatch(10);
      expect(callCount).toBe(1);
    });

    it("derived signal which value didn't change avoids calling listeners or updating it's children", () => {
      const calcTail = vitest.fn((v: number) => {
        return v * 2;
      });

      const head = sig(1);
      const d1 = head.derive((v) => v + 1);
      const d2 = d1.derive((v) => v / v);
      const tail = d2.derive(calcTail);

      expect(tail.get()).toBe(2);

      const onD2Change = vitest.fn();
      d2.add(onD2Change);

      calcTail.mockClear();
      onD2Change.mockClear();

      head.dispatch(2);

      expect(tail.get()).toBe(2);
      expect(calcTail).toHaveBeenCalledTimes(0);
      expect(onD2Change).toHaveBeenCalledTimes(0);

      sig.startBatch();
      head.dispatch(3);
      head.dispatch(4);
      head.dispatch(5);
      sig.commitBatch();

      expect(tail.get()).toBe(2);
      expect(calcTail).toHaveBeenCalledTimes(0);
      expect(onD2Change).toHaveBeenCalledTimes(0);
    });

    it("derived from multiple signals shouldn't call listeners or update children if value didn't change", () => {
      const calcTail = vitest.fn((v: number) => {
        return v * 2;
      });

      const h1 = sig(2);
      const h2 = sig(2);
      const d1 = sig.derive(h1, h2, (v1, v2) => v1 - v2);
      const tail = d1.derive(calcTail);

      expect(tail.get()).toBe(0);

      const onD1Change = vitest.fn();
      d1.add(onD1Change);

      calcTail.mockClear();
      onD1Change.mockClear();

      sig.startBatch();
      h1.dispatch(3);
      h2.dispatch(3);
      sig.commitBatch();

      expect(tail.get()).toBe(0);
      expect(calcTail).toHaveBeenCalledTimes(0);
      expect(onD1Change).toHaveBeenCalledTimes(0);
    });

    it("when a derive function throws it's logged and doesn't affect other signals", () => {
      const consoleErrorSpy = vitest.spyOn(console, "error");

      const head = sig(1);
      const sink1 = head.derive((v) => v + 1);
      const sink2 = head.derive((v) => {
        if (v > 1) throw new Error("test error");
        return 100;
      });
      const sink3 = head.derive((v) => v - 1);

      const onSink1Change = vitest.fn();
      const onSink2Change = vitest.fn();
      const onSink3Change = vitest.fn();

      sink1.add(onSink1Change);
      sink2.add(onSink2Change);
      sink3.add(onSink3Change);

      onSink1Change.mockClear();
      onSink2Change.mockClear();
      onSink3Change.mockClear();

      expect(sink1.get()).toBe(2);
      expect(sink2.get()).toBe(100);
      expect(sink3.get()).toBe(0);

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      head.dispatch(2);

      expect(sink1.get()).toBe(3);
      expect(sink2.get()).toBe(100);
      expect(sink3.get()).toBe(1);

      expect(onSink1Change).toHaveBeenCalledTimes(1);
      expect(onSink2Change).toHaveBeenCalledTimes(0);
      expect(onSink3Change).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    describe("complex scenarios", () => {
      describe("diamond", () => {
        it("scenario 1 - reading", () => {
          const head = new VSignal(0);

          const d1 = head.derive((v) => v + 1);
          const d2 = head.derive((v) => v + 2);
          const d3 = head.derive((v) => v + 3);
          const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);

          expect(d4.get()).toBe(6);
          expect(d3.get()).toBe(3);
          expect(d2.get()).toBe(2);
          expect(d1.get()).toBe(1);
          expect(head.get()).toBe(0);

          head.dispatch(10);

          expect(d4.get()).toBe(36);
          expect(d3.get()).toBe(13);
          expect(d2.get()).toBe(12);
          expect(d1.get()).toBe(11);
          expect(head.get()).toBe(10);
        });

        it("scenario 2 - listener", () => {
          const head = new VSignal(0);

          const d1 = head.derive((v) => v + 1);
          const d2 = head.derive((v) => v + 2);
          const d3 = head.derive((v) => v + 3);
          const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);

          const onD4Change = vitest.fn();
          d4.add(onD4Change);
          onD4Change.mockClear();

          head.dispatch(10);

          expect(onD4Change).toHaveBeenLastCalledWith(36);
          expect(d4.get()).toBe(36);
        });

        it("scenario 3 - derived listener", () => {
          const head = new VSignal(0);

          const d1 = head.derive((v) => v + 1);
          const d2 = head.derive((v) => v + 2);
          const d3 = head.derive((v) => v + 3);
          const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);
          const tail = d4.derive((v) => v * 2);

          const onTailChange = vitest.fn();
          tail.add(onTailChange);
          onTailChange.mockClear();

          head.dispatch(10);

          expect(onTailChange).toHaveBeenLastCalledWith(72);
          expect(tail.get()).toBe(72);
        });
      });

      describe("split", () => {
        it("scenario 1 - reading", () => {
          const source1 = new VSignal(0);
          const source2 = new VSignal(2);
          const source3 = new VSignal(3);
          const source4 = new VSignal(5);

          const join = VSignal.derive(
            source1,
            source2,
            source3,
            source4,
            (v1, v2, v3, v4) => v1 + v2 + v3 + v4,
          );

          const r1 = join.derive((v) => v / 4);
          const r2 = join.derive((v) => v / v);
          const r3 = join.derive((v) => v * 2);

          expect(r1.get()).toBe(2.5);
          expect(r2.get()).toBe(1);
          expect(r3.get()).toBe(20);

          source1.dispatch(2);

          expect(r1.get()).toBe(3);
          expect(r2.get()).toBe(1);
          expect(r3.get()).toBe(24);
        });

        it("scenario 2 - listener", () => {
          const source1 = new VSignal(0);
          const source2 = new VSignal(2);
          const source3 = new VSignal(3);
          const source4 = new VSignal(5);

          const join = VSignal.derive(
            source1,
            source2,
            source3,
            source4,
            (v1, v2, v3, v4) => v1 + v2 + v3 + v4,
          );

          const r1 = join.derive((v) => v / 4);
          const r2 = join.derive((v) => v / v);
          const r3 = join.derive((v) => v * 2);

          const onR1Change = vitest.fn();
          const onR2Change = vitest.fn();
          const onR3Change = vitest.fn();

          r1.add(onR1Change);
          r2.add(onR2Change);
          r3.add(onR3Change);

          onR1Change.mockClear();
          onR2Change.mockClear();
          onR3Change.mockClear();

          source1.dispatch(10);

          expect(onR1Change).toHaveBeenLastCalledWith(5);
          expect(onR2Change).toHaveBeenCalledTimes(0);
          expect(onR3Change).toHaveBeenLastCalledWith(40);
        });
      });

      describe("multi-layer", () => {
        /* use small layer number, since without batching it can
           take a long time for too complex relations */
        const layers = 10;

        it("reading", () => {
          const start = {
            s1: new VSignal(0) as VReadonlySignal<number>,
            s2: new VSignal(1) as VReadonlySignal<number>,
            s3: new VSignal(2) as VReadonlySignal<number>,
            s4: new VSignal(3) as VReadonlySignal<number>,
          };

          let control = {
            s1: 0,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d1Control = {
            s1: 10,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d2Control = {
            s1: 10,
            s2: 5,
            s3: 2,
            s4: 3,
          };
          let d3Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: 3,
          };
          let d4Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: -2,
          };

          let c = start;

          for (let i = 0; i <= layers; i++) {
            const next = {
              s1: c.s2.derive((v) => v + 1) as VReadonlySignal<number>,
              s2: VSignal.derive(
                c.s1,
                c.s3,
                (v1, v3) => v1 + v3,
              ) as VReadonlySignal<number>,
              s3: VSignal.derive(
                c.s4,
                c.s1,
                (v4, v1) => v4 - v1,
              ) as VReadonlySignal<number>,
              s4: c.s3.derive((v) => v - 1) as VReadonlySignal<number>,
            };
            c = next;

            control = {
              s1: control.s2 + 1,
              s2: control.s1 + control.s3,
              s3: control.s4 - control.s1,
              s4: control.s3 - 1,
            };
            d1Control = {
              s1: d1Control.s2 + 1,
              s2: d1Control.s1 + d1Control.s3,
              s3: d1Control.s4 - d1Control.s1,
              s4: d1Control.s3 - 1,
            };
            d2Control = {
              s1: d2Control.s2 + 1,
              s2: d2Control.s1 + d2Control.s3,
              s3: d2Control.s4 - d2Control.s1,
              s4: d2Control.s3 - 1,
            };
            d3Control = {
              s1: d3Control.s2 + 1,
              s2: d3Control.s1 + d3Control.s3,
              s3: d3Control.s4 - d3Control.s1,
              s4: d3Control.s3 - 1,
            };
            d4Control = {
              s1: d4Control.s2 + 1,
              s2: d4Control.s1 + d4Control.s3,
              s3: d4Control.s4 - d4Control.s1,
              s4: d4Control.s3 - 1,
            };
          }

          const end = c;

          expect(end.s1.get()).toBe(control.s1);
          expect(end.s2.get()).toBe(control.s2);
          expect(end.s3.get()).toBe(control.s3);
          expect(end.s4.get()).toBe(control.s4);

          start.s1.dispatch(10);

          expect(end.s1.get()).toBe(d1Control.s1);
          expect(end.s2.get()).toBe(d1Control.s2);
          expect(end.s3.get()).toBe(d1Control.s3);
          expect(end.s4.get()).toBe(d1Control.s4);

          start.s2.dispatch(5);

          expect(end.s1.get()).toBe(d2Control.s1);
          expect(end.s2.get()).toBe(d2Control.s2);
          expect(end.s3.get()).toBe(d2Control.s3);
          expect(end.s4.get()).toBe(d2Control.s4);

          start.s3.dispatch(0);

          expect(end.s1.get()).toBe(d3Control.s1);
          expect(end.s2.get()).toBe(d3Control.s2);
          expect(end.s3.get()).toBe(d3Control.s3);
          expect(end.s4.get()).toBe(d3Control.s4);

          start.s4.dispatch(-2);

          expect(end.s1.get()).toBe(d4Control.s1);
          expect(end.s2.get()).toBe(d4Control.s2);
          expect(end.s3.get()).toBe(d4Control.s3);
          expect(end.s4.get()).toBe(d4Control.s4);
        });

        it("listening on tail", () => {
          const start = {
            s1: new VSignal(0) as VReadonlySignal<number>,
            s2: new VSignal(1) as VReadonlySignal<number>,
            s3: new VSignal(2) as VReadonlySignal<number>,
            s4: new VSignal(3) as VReadonlySignal<number>,
          };

          let control = {
            s1: 0,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d1Control = {
            s1: 10,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d2Control = {
            s1: 10,
            s2: 5,
            s3: 2,
            s4: 3,
          };
          let d3Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: 3,
          };
          let d4Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: -2,
          };

          let c = start;

          for (let i = 0; i <= layers; i++) {
            const next = {
              s1: c.s2.derive((v) => v + 1) as VReadonlySignal<number>,
              s2: VSignal.derive(
                c.s1,
                c.s3,
                (v1, v3) => v1 + v3,
              ) as VReadonlySignal<number>,
              s3: VSignal.derive(
                c.s4,
                c.s1,
                (v4, v1) => v4 - v1,
              ) as VReadonlySignal<number>,
              s4: c.s3.derive((v) => v - 1) as VReadonlySignal<number>,
            };
            c = next;

            control = {
              s1: control.s2 + 1,
              s2: control.s1 + control.s3,
              s3: control.s4 - control.s1,
              s4: control.s3 - 1,
            };
            d1Control = {
              s1: d1Control.s2 + 1,
              s2: d1Control.s1 + d1Control.s3,
              s3: d1Control.s4 - d1Control.s1,
              s4: d1Control.s3 - 1,
            };
            d2Control = {
              s1: d2Control.s2 + 1,
              s2: d2Control.s1 + d2Control.s3,
              s3: d2Control.s4 - d2Control.s1,
              s4: d2Control.s3 - 1,
            };
            d3Control = {
              s1: d3Control.s2 + 1,
              s2: d3Control.s1 + d3Control.s3,
              s3: d3Control.s4 - d3Control.s1,
              s4: d3Control.s3 - 1,
            };
            d4Control = {
              s1: d4Control.s2 + 1,
              s2: d4Control.s1 + d4Control.s3,
              s3: d4Control.s4 - d4Control.s1,
              s4: d4Control.s3 - 1,
            };
          }

          const end = c;

          const onS1Change = vitest.fn();
          const onS2Change = vitest.fn();
          const onS3Change = vitest.fn();
          const onS4Change = vitest.fn();

          end.s1.add(onS1Change);
          end.s2.add(onS2Change);
          end.s3.add(onS3Change);
          end.s4.add(onS4Change);

          onS1Change.mockClear();
          onS2Change.mockClear();
          onS3Change.mockClear();
          onS4Change.mockClear();

          start.s1.dispatch(10);

          expect(onS1Change).toHaveBeenLastCalledWith(d1Control.s1);
          expect(onS2Change).toHaveBeenLastCalledWith(d1Control.s2);
          expect(onS3Change).toHaveBeenLastCalledWith(d1Control.s3);
          expect(onS4Change).toHaveBeenLastCalledWith(d1Control.s4);

          start.s2.dispatch(5);

          expect(onS1Change).toHaveBeenLastCalledWith(d2Control.s1);
          expect(onS2Change).toHaveBeenLastCalledWith(d2Control.s2);
          expect(onS3Change).toHaveBeenLastCalledWith(d2Control.s3);
          expect(onS4Change).toHaveBeenLastCalledWith(d2Control.s4);

          start.s3.dispatch(0);

          expect(onS1Change).toHaveBeenLastCalledWith(d3Control.s1);
          expect(onS2Change).toHaveBeenLastCalledWith(d3Control.s2);
          expect(onS3Change).toHaveBeenLastCalledWith(d3Control.s3);
          expect(onS4Change).toHaveBeenLastCalledWith(d3Control.s4);

          start.s4.dispatch(-2);

          expect(onS1Change).toHaveBeenLastCalledWith(d4Control.s1);
          expect(onS2Change).toHaveBeenLastCalledWith(d4Control.s2);
          expect(onS3Change).toHaveBeenLastCalledWith(d4Control.s3);
          expect(onS4Change).toHaveBeenLastCalledWith(d4Control.s4);
        });

        it("listening on each layer", () => {
          const start = {
            s1: new VSignal(0) as VReadonlySignal<number>,
            s2: new VSignal(1) as VReadonlySignal<number>,
            s3: new VSignal(2) as VReadonlySignal<number>,
            s4: new VSignal(3) as VReadonlySignal<number>,
          };

          let control = {
            s1: 0,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d1Control = {
            s1: 10,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d2Control = {
            s1: 10,
            s2: 5,
            s3: 2,
            s4: 3,
          };
          let d3Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: 3,
          };
          let d4Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: -2,
          };

          let c = start;

          const listeners: SignalListenerReference<number>[] = [];
          for (let i = 0; i <= layers; i++) {
            const next = {
              s1: c.s2.derive((v) => v + 1) as VReadonlySignal<number>,
              s2: VSignal.derive(
                c.s1,
                c.s3,
                (v1, v3) => v1 + v3,
              ) as VReadonlySignal<number>,
              s3: VSignal.derive(
                c.s4,
                c.s1,
                (v4, v1) => v4 - v1,
              ) as VReadonlySignal<number>,
              s4: c.s3.derive((v) => v - 1) as VReadonlySignal<number>,
            };
            listeners.push(
              next.s1.add((v) => {
                v;
              }),
              next.s2.add((v) => {
                v;
              }),
              next.s3.add((v) => {
                v;
              }),
              next.s4.add((v) => {
                v;
              }),
            );

            c = next;

            control = {
              s1: control.s2 + 1,
              s2: control.s1 + control.s3,
              s3: control.s4 - control.s1,
              s4: control.s3 - 1,
            };
            d1Control = {
              s1: d1Control.s2 + 1,
              s2: d1Control.s1 + d1Control.s3,
              s3: d1Control.s4 - d1Control.s1,
              s4: d1Control.s3 - 1,
            };
            d2Control = {
              s1: d2Control.s2 + 1,
              s2: d2Control.s1 + d2Control.s3,
              s3: d2Control.s4 - d2Control.s1,
              s4: d2Control.s3 - 1,
            };
            d3Control = {
              s1: d3Control.s2 + 1,
              s2: d3Control.s1 + d3Control.s3,
              s3: d3Control.s4 - d3Control.s1,
              s4: d3Control.s3 - 1,
            };
            d4Control = {
              s1: d4Control.s2 + 1,
              s2: d4Control.s1 + d4Control.s3,
              s3: d4Control.s4 - d4Control.s1,
              s4: d4Control.s3 - 1,
            };
          }

          const end = c;

          expect(end.s1.get()).toBe(control.s1);
          expect(end.s2.get()).toBe(control.s2);
          expect(end.s3.get()).toBe(control.s3);
          expect(end.s4.get()).toBe(control.s4);

          start.s1.dispatch(10);

          expect(end.s1.get()).toBe(d1Control.s1);
          expect(end.s2.get()).toBe(d1Control.s2);
          expect(end.s3.get()).toBe(d1Control.s3);
          expect(end.s4.get()).toBe(d1Control.s4);

          start.s2.dispatch(5);

          expect(end.s1.get()).toBe(d2Control.s1);
          expect(end.s2.get()).toBe(d2Control.s2);
          expect(end.s3.get()).toBe(d2Control.s3);
          expect(end.s4.get()).toBe(d2Control.s4);

          start.s3.dispatch(0);

          expect(end.s1.get()).toBe(d3Control.s1);
          expect(end.s2.get()).toBe(d3Control.s2);
          expect(end.s3.get()).toBe(d3Control.s3);
          expect(end.s4.get()).toBe(d3Control.s4);

          start.s4.dispatch(-2);

          expect(end.s1.get()).toBe(d4Control.s1);
          expect(end.s2.get()).toBe(d4Control.s2);
          expect(end.s3.get()).toBe(d4Control.s3);
          expect(end.s4.get()).toBe(d4Control.s4);
        });
      });
    });

    describe("with custom compare fn", () => {
      it("propagets change events only when the compare function returns true", () => {
        const source = sig({ v: "foo,bar,baz,qux" });
        const sink = source.derive(({ v }) => v.split(",").filter(Boolean), {
          compare: (a, b) => {
            return a.length === b.length
              && a.every((elem, idx) => elem === b[idx]);
          },
        });

        expect(sink.get()).toEqual(["foo", "bar", "baz", "qux"]);

        const onChange = vitest.fn();
        sink.add(onChange);
        onChange.mockClear();

        source.dispatch({ v: "qux,foo,bar" });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith(["qux", "foo", "bar"]);

        onChange.mockClear();

        source.dispatch({ v: "qux,foo,bar" });
        expect(onChange).not.toHaveBeenCalled();
        expect(sink.get()).toEqual(["qux", "foo", "bar"]);

        onChange.mockClear();

        source.dispatch({ v: "qux,,,foo,,bar," });
        expect(onChange).not.toHaveBeenCalled();
        expect(sink.get()).toEqual(["qux", "foo", "bar"]);
      });
    });
  });

  describe("$map()", () => {
    it("correcrtly maps signal array", () => {
      const s = sig([1, 2, 3, 4, 5]);
      const dmapped = s.$map((num) => String(num * num));
      expect(dmapped.get()).toEqual(["1", "4", "9", "16", "25"]);

      s.dispatch([2, 10]);
      expect(dmapped.get()).toEqual(["4", "100"]);
    });

    it("correcrtly maps derived signal array", () => {
      const s = sig(5);
      const arr = s.derive((num) =>
        Array.from({ length: num }, (_, idx) => 2 * idx)
      );
      const dmapped = arr.$map((num) => `|${num}|`);
      expect(dmapped.get()).toEqual(["|0|", "|2|", "|4|", "|6|", "|8|"]);

      s.dispatch(2);
      expect(dmapped.get()).toEqual(["|0|", "|2|"]);

      s.dispatch(4);
      expect(dmapped.get()).toEqual(["|0|", "|2|", "|4|", "|6|"]);
    });

    it("throws if the signal value is not an array", () => {
      const s = sig(1);
      // @ts-expect-error
      const derived = s.$map((e) => e);
      expect(derived.get()).toBeNull();
      expect(console.error).toHaveBeenLastCalledWith(
        new Error("value is not an array"),
      );
    });
  });

  describe("$includes()", () => {
    it("correcrtly maps signal array", () => {
      const s = sig([1, 2, 3, 4, 5]);
      const derived = s.$includes(5);
      expect(derived.get()).toEqual(true);

      s.dispatch([2, 10, 50, 55]);
      expect(derived.get()).toEqual(false);

      s.dispatch([0, 5]);
      expect(derived.get()).toEqual(true);
    });

    it("throws if the signal value is not an array", () => {
      const s = sig(1);
      // @ts-expect-error
      const derived = s.$includes(1);
      expect(derived.get()).toBeNull();
      expect(console.error).toHaveBeenLastCalledWith(
        new Error("value is not an array"),
      );
    });
  });

  describe("$prop()", () => {
    it("correcrtly selects the property", () => {
      const s = sig({
        foo: 1,
        bar: "2",
      });
      const fooSig = s.$prop("foo");
      expect(fooSig.get()).toEqual(1);

      s.dispatch((c) => ({ ...c, foo: 42 }));
      expect(fooSig.get()).toEqual(42);

      s.dispatch((c) => ({ ...c, bar: "asd" }));
      expect(fooSig.get()).toEqual(42);

      s.dispatch((c) => ({ ...c, foo: 123 }));
      expect(fooSig.get()).toEqual(123);
    });

    it("throws if the signal value is not an object", () => {
      const s = sig(1);
      const derived = s.$prop("toString");
      expect(derived.get()).toBeNull();
      expect(console.error).toHaveBeenLastCalledWith(
        new Error("value is not an object"),
      );
    });
  });

  describe("$len()", () => {
    it("correctly derives length from arrays", () => {
      const s = sig([1, 2, 3, 4, 5]);
      const arrLen = s.$len();
      expect(arrLen.get()).toEqual(5);

      s.dispatch([0, 0]);
      expect(arrLen.get()).toEqual(2);

      s.dispatch([]);
      expect(arrLen.get()).toEqual(0);

      s.dispatch([1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5]);
      expect(arrLen.get()).toEqual(15);
    });

    it("correctly derives length from strings", () => {
      const s = sig("");
      const arrLen = s.$len();
      expect(arrLen.get()).toEqual(0);

      s.dispatch("abcdef");
      expect(arrLen.get()).toEqual(6);

      s.dispatch("1");
      expect(arrLen.get()).toEqual(1);
    });

    it("throws if the signal value is not an string or object", () => {
      const s = sig(1);
      const derived = s.$len();
      // @ts-expect-error
      expect(derived.get()).toBeNull();
      expect(console.error).toHaveBeenLastCalledWith(
        new Error("value has no length"),
      );
    });
  });

  describe("$or()", () => {
    it("correctly sets a default value", () => {
      const arr = sig<null | string[]>();
      const str = sig<string | undefined>("abc");
      const num = sig<number | null>(0);
      const obj = sig<object | undefined>();

      const nonNullArr = arr.$or(["default"]);
      const nonNullStr = str.$or("default");
      const nonNullNum = num.$or(-1);
      const nonNullObj = obj.$or({ default: 1 });

      expect(nonNullArr.get()).toEqual(["default"]);
      expect(nonNullStr.get()).toEqual("abc");
      expect(nonNullNum.get()).toEqual(0);
      expect(nonNullObj.get()).toEqual({ default: 1 });

      arr.dispatch([]);
      str.dispatch(undefined);
      num.dispatch(null);
      obj.dispatch({ foo: "bar" });

      expect(nonNullArr.get()).toEqual([]);
      expect(nonNullStr.get()).toEqual("default");
      expect(nonNullNum.get()).toEqual(-1);
      expect(nonNullObj.get()).toEqual({ foo: "bar" });
    });

    it("correctly interracts with other $ function", () => {
      const s = sig<null | number[]>([1, 2, 3]);
      const mapped = s.$or([0]).$map((elem) => `|${elem}|`);
      const len = s.$or([]).$len();
      const has2 = s.$or([]).$includes(2);

      expect(mapped.get()).toEqual(["|1|", "|2|", "|3|"]);
      expect(len.get()).toEqual(3);
      expect(has2.get()).toEqual(true);

      s.dispatch(null);

      expect(mapped.get()).toEqual(["|0|"]);
      expect(len.get()).toEqual(0);
      expect(has2.get()).toEqual(false);

      s.dispatch([2]);

      expect(mapped.get()).toEqual(["|2|"]);
      expect(len.get()).toEqual(1);
      expect(has2.get()).toEqual(true);
    });
  });

  describe("$pick", () => {
    it("correctly created a derived signal", () => {
      const source = sig({
        foo: 1,
        bar: 2,
        baz: 3,
        qux: 4,
        coorge: 5,
      });

      const sink1 = source.$pick("foo");
      expect(sink1.get()).toEqual({ foo: 1 });

      const sink2 = source.$pick("foo", "baz", "coorge");
      expect(sink2.get()).toEqual({ foo: 1, baz: 3, coorge: 5 });

      source.dispatch({
        foo: 9,
        bar: 8,
        baz: 7,
        qux: 6,
        coorge: 0,
      });

      expect(sink1.get()).toEqual({ foo: 9 });
      expect(sink2.get()).toEqual({ foo: 9, baz: 7, coorge: 0 });
    });

    it("derived signal does not update if an inrelated prop changes", () => {
      const source = sig({
        foo: 1,
        bar: 2,
        baz: 3,
        qux: 4,
        coorge: 5,
      });

      const sink = source.$pick("foo", "qux");
      expect(sink.get()).toEqual({ foo: 1, qux: 4 });

      const onChange = vitest.fn();
      sink.add(onChange);
      onChange.mockClear();

      expect(onChange).toHaveBeenCalledTimes(0);
      source.dispatch(c => ({ ...c, coorge: 10 }));
      expect(onChange).toHaveBeenCalledTimes(0);
      source.dispatch(c => ({ ...c, bar: 0, baz: 0 }));
      expect(onChange).toHaveBeenCalledTimes(0);
      source.dispatch(c => ({ ...c, foo: 2 }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        foo: 2,
        qux: 4,
      });
    });

    it("bahaves correctly when used on a derived and having sinks", () => {
      const source = sig("a=1,b=2,c=3");
      const sink1 = source.derive(s =>
        Object.fromEntries(
          s.split(",").map(e => e.split("=")),
        ) as { a: string; b: string; c: string; d?: string }
      );
      const sink2 = sink1.$pick("a", "c");
      const sink3 = sink2.derive(o => `A: ${o.a}; C: ${o.c}`);

      expect(sink3.get()).toEqual("A: 1; C: 3");

      source.dispatch("a=5,b=10,c=15");
      expect(sink3.get()).toEqual("A: 5; C: 15");

      source.dispatch("a=5,b=0,c=15");
      expect(sink3.get()).toEqual("A: 5; C: 15");

      const onSink3Change = vitest.fn();
      sink3.add(onSink3Change);
      expect(onSink3Change).toHaveBeenCalledTimes(1);
      expect(onSink3Change).toHaveBeenCalledWith("A: 5; C: 15");
      onSink3Change.mockClear();

      expect(onSink3Change).toHaveBeenCalledTimes(0);
      source.dispatch("a=5,b=999,c=15,d=1");
      expect(onSink3Change).toHaveBeenCalledTimes(0);

      source.dispatch("a=55,b=999,c=15,d=1");
      expect(onSink3Change).toHaveBeenCalledTimes(1);
      expect(onSink3Change).toHaveBeenCalledWith("A: 55; C: 15");

      source.dispatch("a=55,b=999,c=105,d=1");
      expect(onSink3Change).toHaveBeenCalledTimes(2);
      expect(onSink3Change).toHaveBeenCalledWith("A: 55; C: 105");

      source.dispatch("z=z,a=55,b=0,c=105,d=9");
      expect(onSink3Change).toHaveBeenCalledTimes(2);
    });
  });

  describe("$omit", () => {
    it("correctly created a derived signal", () => {
      const source = sig({
        foo: 1,
        bar: 2,
        baz: 3,
        qux: 4,
        coorge: 5,
      });

      const sink1 = source.$omit("foo");
      expect(sink1.get()).toEqual({ bar: 2, baz: 3, qux: 4, coorge: 5 });

      const sink2 = source.$omit("foo", "baz", "coorge");
      expect(sink2.get()).toEqual({ bar: 2, qux: 4 });

      source.dispatch({
        foo: 9,
        bar: 8,
        baz: 7,
        qux: 6,
        coorge: 0,
      });

      expect(sink1.get()).toEqual({ bar: 8, baz: 7, qux: 6, coorge: 0 });
      expect(sink2.get()).toEqual({ bar: 8, qux: 6 });
    });

    it("derived signal does not update if an inrelated prop changes", () => {
      const source = sig({
        foo: 1,
        bar: 2,
        baz: 3,
        qux: 4,
        coorge: 5,
      });

      const sink = source.$omit("foo", "qux");
      expect(sink.get()).toEqual({ bar: 2, baz: 3, coorge: 5 });

      const onChange = vitest.fn();
      sink.add(onChange);
      onChange.mockClear();

      expect(onChange).toHaveBeenCalledTimes(0);
      source.dispatch(c => ({ ...c, foo: 10 }));
      expect(onChange).toHaveBeenCalledTimes(0);
      source.dispatch(c => ({ ...c, foo: 0, qux: 0 }));
      expect(onChange).toHaveBeenCalledTimes(0);
      source.dispatch(c => ({ ...c, bar: 123 }));
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({
        bar: 123,
        baz: 3,
        coorge: 5,
      });
    });
  });

  describe("readonly()", () => {
    it("should return a readonly version of the current Signal<T>", () => {
      const s = sig("foo");
      const readonlyS = s.readonly();

      expect(readonlyS.get()).toBe("foo");

      s.dispatch("bar");

      expect(readonlyS.get()).toBe("bar");

      // @ts-expect-error
      expect(() => readonlyS.dispatch("bar")).toThrowError();
    });

    it("should return itself when called on a readonly signal", () => {
      const s = sig("foo");
      const readonlyS = s.readonly();
      const readonlyS2 = readonlyS.readonly();

      expect(readonlyS).toBe(readonlyS2);
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

      expect(() => signal.derive((v) => v)).toThrowError();
    });

    it("should also destroy all derived signals", () => {
      const signal = sig("001");
      const dSignal = signal.derive((v) => Number(v));
      const dSignal2 = dSignal.derive((v) => String(v).length);

      signal.destroy();
      expect(() => dSignal.add(() => {})).toThrowError();
      expect(() => dSignal2.add(() => {})).toThrowError();
    });

    it("detaches itself from the parent signal", () => {
      const signal = sig("001");
      const dSignal = signal.derive((v) => Number(v));

      dSignal.destroy();
      signal.dispatch("002");
      expect(dSignal.get()).toBe(1);
    });
  });

  describe("sig.derive()", () => {
    it("should correctly derive from 2 sources", () => {
      const sig1 = sig("Hello");
      const sig2 = sig("World");

      const derived = sig.derive(sig1, sig2, (v1, v2) => `${v1} ${v2}`);
      expect(derived.get()).toBe("Hello World");

      sig1.dispatch("Goodbye");
      expect(derived.get()).toBe("Goodbye World");

      sig2.dispatch("Universe");
      expect(derived.get()).toBe("Goodbye Universe");
    });

    it("should correctly derive from 4 sources", () => {
      const sig1 = sig("foo");
      const sig2 = sig("bar");
      const sig3 = sig("baz");
      const sig4 = sig(2);

      const derived = sig.derive(
        sig1,
        sig2,
        sig3,
        sig4,
        (v1, v2, v3, v4) => `[${v1} ${v2} ${v3}]`.repeat(v4),
      );
      expect(derived.get()).toBe("[foo bar baz][foo bar baz]");

      sig1.dispatch("OOF");
      expect(derived.get()).toBe("[OOF bar baz][OOF bar baz]");

      sig3.dispatch("ZAB");
      expect(derived.get()).toBe("[OOF bar ZAB][OOF bar ZAB]");

      sig2.dispatch("RAB");
      expect(derived.get()).toBe("[OOF RAB ZAB][OOF RAB ZAB]");

      sig4.dispatch(3);
      expect(derived.get()).toBe("[OOF RAB ZAB][OOF RAB ZAB][OOF RAB ZAB]");
    });

    it("should keep functioning even when some of the sources were destroyed", () => {
      const sig1 = sig("foo");
      const sig2 = sig("bar");
      const sig3 = sig("baz");

      const derived = sig.derive(
        sig1,
        sig2,
        sig3,
        (v1, v2, v3) => `[${v1} ${v2} ${v3}]`,
      );
      const destroySpy = vitest.spyOn(derived, "destroy");
      expect(derived.get()).toBe("[foo bar baz]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig2.destroy();
      expect(derived.get()).toBe("[foo bar baz]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig1.dispatch("OOF");
      expect(derived.get()).toBe("[OOF bar baz]");

      sig3.dispatch("ZAB");
      expect(derived.get()).toBe("[OOF bar ZAB]");

      sig1.destroy();
      expect(derived.get()).toBe("[OOF bar ZAB]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig3.dispatch("1234");
      expect(derived.get()).toBe("[OOF bar 1234]");
    });

    it("should destroy the derived signal once all sources are destroyed", () => {
      const sig1 = sig("foo");
      const sig2 = sig("bar");
      const sig3 = sig("baz");

      const derived = sig.derive(
        sig1,
        sig2,
        sig3,
        (v1, v2, v3) => `[${v1} ${v2} ${v3}]`,
      );
      const destroySpy = vitest.spyOn(derived, "destroy");
      expect(derived.get()).toBe("[foo bar baz]");
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig1.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig2.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(0);

      sig3.destroy();
      expect(destroySpy).toHaveBeenCalledTimes(1);
    });

    it("derived signals should be possible to garbage collect", async () => {
      const s1 = sig("foo") as VSignal<string>;
      const s2 = sig("bar") as VSignal<string>;
      const s3 = sig("baz") as VSignal<string>;
      const derivedRefs1 = s1["derivedSignals"];
      const derivedRefs2 = s2["derivedSignals"];
      const derivedRefs3 = s3["derivedSignals"];
      let derived: ReadonlySignal<string> | null = sig.derive(
        s1,
        s2,
        s3,
        (v1, v2, v3) => `[${v1} ${v2} ${v3}]`,
      );

      expect(derived.get()).toBe("[foo bar baz]");
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

    describe("with custom compare fn", () => {
      it("propagets change events only when the compare function returns true", () => {
        const source1 = sig({ v: 1 });
        const source2 = sig({ v: 2 });
        const sink = sig.derive(
          source1,
          source2,
          (s1, s2) => ({ v: s1.v + s2.v }),
          { compare: (a, b) => a.v === b.v },
        );

        expect(sink.get()).toEqual({ v: 3 });

        const onChange = vitest.fn();
        sink.add(onChange);
        onChange.mockClear();

        source1.dispatch({ v: 5 });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ v: 7 });
        expect(sink.get()).toEqual({ v: 7 });

        onChange.mockClear();

        source2.dispatch({ v: 10 });
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ v: 15 });
        expect(sink.get()).toEqual({ v: 15 });

        onChange.mockClear();

        source1.dispatch({ v: 5 });
        expect(onChange).not.toHaveBeenCalled();
        expect(sink.get()).toEqual({ v: 15 });

        onChange.mockClear();

        sig.startBatch();
        source1.dispatch({ v: 10 });
        source2.dispatch({ v: 10 });
        sig.commitBatch();

        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange).toHaveBeenLastCalledWith({ v: 20 });

        onChange.mockClear();

        sig.startBatch();
        source1.dispatch({ v: 2 });
        source2.dispatch({ v: 18 });
        sig.commitBatch();

        expect(onChange).not.toHaveBeenCalled();
        expect(sink.get()).toEqual({ v: 20 });
      });
    });
  });

  describe("sig.bind()", () => {
    it("updates the specified object property whenever the signal changes", () => {
      const obj = { prop: "foo" };
      const s = sig("bar");

      sig.bindv(s, obj, "prop");

      expect(obj.prop).toBe("bar");

      s.dispatch("baz");

      expect(obj.prop).toBe("baz");
    });

    it("works correctly with derived signals", () => {
      const obj = { v: 0 };
      const s1 = sig(1);
      const s2 = sig(2);
      const derived = sig.derive(s1, s2, (v1, v2) => v1 * v2);

      sig.bindv(derived, obj, "v");

      expect(obj.v).toBe(2);

      s1.dispatch(3);

      expect(obj.v).toBe(6);

      s2.dispatch(4);

      expect(obj.v).toBe(12);
    });

    it("bound objects can be garbage collected", async () => {
      let obj: { prop: string } | null = { prop: "foo" };
      const ref = new WeakRef(obj);
      const s = sig("bar");

      sig.bindv(s, obj, "prop");

      expect(obj.prop).toBe("bar");

      obj = null;
      await gc();

      expect(ref.deref()).toBeUndefined();
      expect((s as VSignal<string>)["listeners"]).toHaveLength(1);

      s.dispatch("baz");
      expect((s as VSignal<string>)["listeners"]).toHaveLength(0);
    });

    it("bound signal should never get garbage collected", async () => {
      let obj: { prop: string } | null = { prop: "bar" };
      const source = sig("foo");

      // don't keep ref to the derived signal
      const derivedRef = new WeakRef(source.derive((t) => t.toUpperCase()));
      sig.bindv(derivedRef.deref()!, obj, "prop");

      expect(obj.prop).toBe("FOO");

      // run garbage collection, it should not delete the derived signal
      // despite that we don't hold any references to it
      await gc();

      expect(derivedRef.deref()).toBeDefined();

      source.dispatch("baz");
      expect(obj.prop).toBe("BAZ");

      obj = null;

      // gc should collect the object and the derived signal
      await gc();

      expect(derivedRef.deref()).toBeUndefined();
    });
  });

  describe("sig.bindAttribute()", () => {
    const elemMock = (): Element => {
      const attributes = new Map<string, string>();

      return {
        getAttribute(k: string) {
          return attributes.get(k);
        },
        setAttribute(k: string, v: string) {
          attributes.set(k, v);
        },
        removeAttribute(k: string) {
          attributes.delete(k);
        },
      } as any;
    };

    it("updates the specified object property whenever the signal changes", () => {
      const obj = elemMock();
      const s = sig("bar");

      sig.bindAttribute(s, obj, "data-test");

      expect(obj.getAttribute("data-test")).toBe("bar");

      s.dispatch("baz");

      expect(obj.getAttribute("data-test")).toBe("baz");
    });

    it("works correctly with derived signals", () => {
      const obj = elemMock();
      const s1 = sig(1);
      const s2 = sig(2);
      const derived = sig.derive(s1, s2, (v1, v2) => String(v1 * v2));

      sig.bindAttribute(derived, obj, "data-test");

      expect(obj.getAttribute("data-test")).toBe("2");

      s1.dispatch(3);

      expect(obj.getAttribute("data-test")).toBe("6");

      s2.dispatch(4);

      expect(obj.getAttribute("data-test")).toBe("12");
    });

    it("bound objects can be garbage collected", async () => {
      let obj: Element | null = elemMock();
      const ref = new WeakRef(obj);
      const s = sig("bar");

      sig.bindAttribute(s, obj, "data-test");

      expect(obj.getAttribute("data-test")).toBe("bar");

      obj = null;
      await gc();

      expect(ref.deref()).toBeUndefined();
      expect((s as VSignal<string>)["listeners"]).toHaveLength(1);

      s.dispatch("baz");
      expect((s as VSignal<string>)["listeners"]).toHaveLength(0);
    });

    it("bound signal should never get garbage collected", async () => {
      let obj: Element | null = elemMock();
      const source = sig("foo");

      // don't keep ref to the derived signal
      const derivedRef = new WeakRef(source.derive((t) => t.toUpperCase()));
      sig.bindAttribute(derivedRef.deref()!, obj, "data-test");

      expect(obj.getAttribute("data-test")).toBe("FOO");

      // run garbage collection, it should not delete the derived signal
      // despite that we don't hold any references to it
      await gc();

      expect(derivedRef.deref()).toBeDefined();

      source.dispatch("baz");
      expect(obj.getAttribute("data-test")).toBe("BAZ");

      obj = null;

      // gc should collect the object and the derived signal
      await gc();

      expect(derivedRef.deref()).toBeUndefined();
    });
  });

  describe("sig.literal", () => {
    it("creates a derived signal from templpate literal", () => {
      const arg1 = sig("foo");
      const arg2 = sig("bar");
      const arg3 = sig("baz");

      const result = sig.literal`1: ${arg1}, 2: ${arg2}, 3: ${arg3}`;
      expect(result.get()).toEqual("1: foo, 2: bar, 3: baz");

      arg1.dispatch("FOO");
      expect(result.get()).toEqual("1: FOO, 2: bar, 3: baz");

      arg2.dispatch("BAR");
      expect(result.get()).toEqual("1: FOO, 2: BAR, 3: baz");

      arg3.dispatch("BAZ");
      expect(result.get()).toEqual("1: FOO, 2: BAR, 3: BAZ");
    });
  });

  describe("batching", () => {
    it("should call all listeners after batch commit", () => {
      const s = new VSignal(1);
      const onChange = vitest.fn();
      s.add(onChange);

      expect(s.get()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);

      VSignal.startBatch();

      s.dispatch(2);
      expect(s.get()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      s.dispatch(3);
      expect(s.get()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      s.dispatch(4);
      expect(s.get()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);

      VSignal.commitBatch();

      expect(s.get()).toBe(4);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(4);
    });

    it("should minimize updates to diamond structure", () => {
      const head = new VSignal(0);

      const d1 = head.derive((v) => v + 1);
      const d2 = head.derive((v) => v + 2);
      const d3 = head.derive((v) => v + 3);
      const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);

      const onD4Change = vitest.fn();
      d4.add(onD4Change);
      onD4Change.mockClear();

      VSignal.startBatch();
      head.dispatch(10);
      VSignal.commitBatch();

      expect(onD4Change).toHaveBeenCalledTimes(1);
      expect(onD4Change).toHaveBeenLastCalledWith(36);
    });

    describe("multi-layer", () => {
      describe("multi-layer", () => {
        const layers = 1000;

        it("listening on tail", () => {
          const start = {
            s1: new VSignal(0) as VReadonlySignal<number>,
            s2: new VSignal(1) as VReadonlySignal<number>,
            s3: new VSignal(2) as VReadonlySignal<number>,
            s4: new VSignal(3) as VReadonlySignal<number>,
          };

          let control = {
            s1: 0,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let d2Control = {
            s1: 10,
            s2: 5,
            s3: 2,
            s4: 3,
          };
          let d4Control = {
            s1: 10,
            s2: 5,
            s3: 0,
            s4: -2,
          };

          let c = start;

          for (let i = 0; i <= layers; i++) {
            const next = {
              s1: c.s2.derive((v) => v + 1) as VReadonlySignal<number>,
              s2: VSignal.derive(
                c.s1,
                c.s3,
                (v1, v3) => v1 + v3,
              ) as VReadonlySignal<number>,
              s3: VSignal.derive(
                c.s4,
                c.s1,
                (v4, v1) => v4 - v1,
              ) as VReadonlySignal<number>,
              s4: c.s3.derive((v) => v - 1) as VReadonlySignal<number>,
            };
            c = next;

            control = {
              s1: control.s2 + 1,
              s2: control.s1 + control.s3,
              s3: control.s4 - control.s1,
              s4: control.s3 - 1,
            };
            d2Control = {
              s1: d2Control.s2 + 1,
              s2: d2Control.s1 + d2Control.s3,
              s3: d2Control.s4 - d2Control.s1,
              s4: d2Control.s3 - 1,
            };
            d4Control = {
              s1: d4Control.s2 + 1,
              s2: d4Control.s1 + d4Control.s3,
              s3: d4Control.s4 - d4Control.s1,
              s4: d4Control.s3 - 1,
            };
          }

          const end = c;

          const onS1Change = vitest.fn();
          const onS2Change = vitest.fn();
          const onS3Change = vitest.fn();
          const onS4Change = vitest.fn();

          end.s1.add(onS1Change);
          end.s2.add(onS2Change);
          end.s3.add(onS3Change);
          end.s4.add(onS4Change);

          onS1Change.mockClear();
          onS2Change.mockClear();
          onS3Change.mockClear();
          onS4Change.mockClear();

          VSignal.startBatch();
          start.s1.dispatch(10);
          start.s2.dispatch(5);
          VSignal.commitBatch();

          expect(onS1Change).toHaveBeenCalledTimes(1);
          expect(onS1Change).toHaveBeenLastCalledWith(d2Control.s1);
          expect(onS2Change).toHaveBeenCalledTimes(1);
          expect(onS2Change).toHaveBeenLastCalledWith(d2Control.s2);
          expect(onS3Change).toHaveBeenCalledTimes(1);
          expect(onS3Change).toHaveBeenLastCalledWith(d2Control.s3);
          expect(onS4Change).toHaveBeenCalledTimes(1);
          expect(onS4Change).toHaveBeenLastCalledWith(d2Control.s4);

          VSignal.startBatch();
          start.s3.dispatch(0);
          start.s4.dispatch(-2);
          VSignal.commitBatch();

          expect(onS1Change).toHaveBeenCalledTimes(2);
          expect(onS1Change).toHaveBeenLastCalledWith(d4Control.s1);
          expect(onS2Change).toHaveBeenCalledTimes(2);
          expect(onS2Change).toHaveBeenLastCalledWith(d4Control.s2);
          expect(onS3Change).toHaveBeenCalledTimes(2);
          expect(onS3Change).toHaveBeenLastCalledWith(d4Control.s3);
          expect(onS4Change).toHaveBeenCalledTimes(2);
          expect(onS4Change).toHaveBeenLastCalledWith(d4Control.s4);
        });

        it("listening on each layer", () => {
          const start = {
            s1: new VSignal(0) as VReadonlySignal<number>,
            s2: new VSignal(1) as VReadonlySignal<number>,
            s3: new VSignal(2) as VReadonlySignal<number>,
            s4: new VSignal(3) as VReadonlySignal<number>,
          };

          let control = {
            s1: 0,
            s2: 1,
            s3: 2,
            s4: 3,
          };
          let dControl = {
            s1: 13,
            s2: 7,
            s3: 5,
            s4: 3,
          };

          let c = start;

          const listeners: Mock<[v: number], void>[] = [];
          for (let i = 0; i <= layers; i++) {
            const next = {
              s1: c.s2.derive((v) => v + 1) as VReadonlySignal<number>,
              s2: VSignal.derive(
                c.s1,
                c.s3,
                (v1, v3) => v1 + v3,
              ) as VReadonlySignal<number>,
              s3: VSignal.derive(
                c.s4,
                c.s1,
                (v4, v1) => v4 - v1,
              ) as VReadonlySignal<number>,
              s4: c.s3.derive((v) => v - 1) as VReadonlySignal<number>,
            };
            const m1 = vitest.fn((v: number) => {
              v;
            });
            const m2 = vitest.fn((v: number) => {
              v;
            });
            const m3 = vitest.fn((v: number) => {
              v;
            });
            const m4 = vitest.fn((v: number) => {
              v;
            });
            listeners.push(m1, m2, m3, m4);
            next.s1.add(m1);
            next.s2.add(m2);
            next.s3.add(m3);
            next.s4.add(m4);

            c = next;

            control = {
              s1: control.s2 + 1,
              s2: control.s1 + control.s3,
              s3: control.s4 - control.s1,
              s4: control.s3 - 1,
            };
            dControl = {
              s1: dControl.s2 + 1,
              s2: dControl.s1 + dControl.s3,
              s3: dControl.s4 - dControl.s1,
              s4: dControl.s3 - 1,
            };
          }

          for (const m of listeners) {
            m.mockClear();
          }

          const end = c;

          expect(end.s1.get()).toBe(control.s1);
          expect(end.s2.get()).toBe(control.s2);
          expect(end.s3.get()).toBe(control.s3);
          expect(end.s4.get()).toBe(control.s4);

          VSignal.startBatch();
          start.s1.dispatch(13);
          start.s2.dispatch(7);
          start.s3.dispatch(5);
          start.s4.dispatch(3);
          VSignal.commitBatch();

          expect(end.s1.get()).toBe(dControl.s1);
          expect(end.s2.get()).toBe(dControl.s2);
          expect(end.s3.get()).toBe(dControl.s3);
          expect(end.s4.get()).toBe(dControl.s4);

          const [m1, m2, m3, m4] = listeners.slice(-4);

          expect(m1).toHaveBeenCalledTimes(1);
          expect(m1).toHaveBeenLastCalledWith(dControl.s1);
          expect(m2).toHaveBeenCalledTimes(1);
          expect(m2).toHaveBeenLastCalledWith(dControl.s2);
          expect(m3).toHaveBeenCalledTimes(1);
          expect(m3).toHaveBeenLastCalledWith(dControl.s3);
          expect(m4).toHaveBeenCalledTimes(1);
          expect(m4).toHaveBeenLastCalledWith(dControl.s4);

          for (const m of listeners.slice(0, -4)) {
            expect(m).toHaveBeenCalledTimes(1);
          }
        });
      });
    });
  });

  describe("handling of updates caused by own update", () => {
    it("simple circular dependency", () => {
      const s = sig({
        foo: "bar",
        len: 3,
      });

      s.add((v) => {
        if (v.foo.length !== v.len) {
          s.dispatch({
            foo: v.foo,
            len: v.foo.length,
          });
        }
      });

      s.dispatch({
        foo: "barbaz",
        len: 3,
      });

      expect(s.get()).toEqual({
        foo: "barbaz",
        len: 6,
      });

      s.dispatch({
        foo: "barbazqux",
        len: 6,
      });
      s.dispatch({
        foo: "barbazquxcorge",
        len: 6,
      });

      expect(s.get()).toEqual({
        foo: "barbazquxcorge",
        len: 14,
      });

      s.dispatch({
        foo: "barbazqux",
        len: 14,
      });
      s.dispatch({
        foo: "barbaz",
        len: 14,
      });
      s.dispatch({
        foo: "bar",
        len: 14,
      });

      expect(s.get()).toEqual({
        foo: "bar",
        len: 3,
      });
    });

    it("circular dependency between too signals", () => {
      const sig1 = sig({ value: "foo", sig2Reflection: 3 });
      const sig2 = sig(3);

      sig1.add((v) => {
        if (v.value.length !== sig2.get()) {
          sig2.dispatch(v.value.length);
        }
      });

      sig2.add((v) => {
        if (v !== sig1.get().sig2Reflection) {
          sig1.dispatch({
            value: sig1.get().value,
            sig2Reflection: v,
          });
        }
      });

      sig1.dispatch({ value: "foobar", sig2Reflection: 3 });

      expect(sig1.get()).toEqual({ value: "foobar", sig2Reflection: 6 });
      expect(sig2.get()).toEqual(6);

      sig1.dispatch({ value: "foobarb", sig2Reflection: 6 });
      sig1.dispatch({ value: "foobarba", sig2Reflection: 6 });
      sig1.dispatch({ value: "foobarbaz", sig2Reflection: 6 });

      expect(sig1.get()).toEqual({ value: "foobarbaz", sig2Reflection: 9 });
      expect(sig2.get()).toEqual(9);

      sig1.dispatch({ value: "", sig2Reflection: 9 });
      sig1.dispatch({ value: "ABC", sig2Reflection: 9 });
      sig1.dispatch({ value: "foobarbazquxcorge", sig2Reflection: 9 });

      expect(sig1.get()).toEqual({
        value: "foobarbazquxcorge",
        sig2Reflection: 17,
      });
      expect(sig2.get()).toEqual(17);
    });

    it("circular dependency between derived signals", () => {
      const sig1 = sig({ value: "foo", sig2Reflection: 3 });
      const sig2 = sig1.derive((v) => v.value.length);

      sig2.add((v) => {
        if (v !== sig1.get().sig2Reflection) {
          sig1.dispatch({
            value: sig1.get().value,
            sig2Reflection: v,
          });
        }
      });

      sig1.dispatch({ value: "foobar", sig2Reflection: 3 });

      expect(sig1.get()).toEqual({ value: "foobar", sig2Reflection: 6 });
      expect(sig2.get()).toEqual(6);

      sig1.dispatch({ value: "foobarb", sig2Reflection: 6 });
      sig1.dispatch({ value: "foobarba", sig2Reflection: 6 });
      sig1.dispatch({ value: "foobarbaz", sig2Reflection: 6 });

      expect(sig1.get()).toEqual({ value: "foobarbaz", sig2Reflection: 9 });
      expect(sig2.get()).toEqual(9);

      sig1.dispatch({ value: "", sig2Reflection: 9 });
      sig1.dispatch({ value: "ABCD", sig2Reflection: 9 });
      sig1.dispatch({ value: "ABC", sig2Reflection: 9 });
      sig1.dispatch({ value: "ABCEFH", sig2Reflection: 9 });
      sig1.dispatch({ value: "foobarbazquxcorge", sig2Reflection: 9 });

      expect(sig1.get()).toEqual({
        value: "foobarbazquxcorge",
        sig2Reflection: 17,
      });
      expect(sig2.get()).toEqual(17);
    });
  });

  describe("logical helpers", () => {
    it("sig.or()", () => {
      const s1 = sig<string | undefined>("hello");
      const s2 = sig<string | undefined>("world");
      const r = sig.or(s1, s2, "abc");

      expect(r.get()).toEqual("hello");

      s1.dispatch(undefined);
      expect(r.get()).toEqual("world");

      s2.dispatch(undefined);
      expect(r.get()).toEqual("abc");

      s1.dispatch("foo");
      expect(r.get()).toEqual("foo");

      s1.dispatch("");
      expect(r.get()).toEqual("abc");
    });

    it("sig.nuc()", () => {
      const s1 = sig<string | undefined>("FOO");
      const s2 = sig<number | null>(2);
      const r = sig.nuc(s1, s2, "");

      expect(r.get()).toEqual("FOO");

      s1.dispatch("");
      expect(r.get()).toEqual("");

      s1.dispatch(undefined);
      expect(r.get()).toEqual(2);

      s2.dispatch(0);
      expect(r.get()).toEqual(0);

      s2.dispatch(null);
      expect(r.get()).toEqual("");
    });

    it("sig.and()", () => {
      const s1 = sig<boolean>(false);
      const s2 = sig<string | undefined>("Hello");
      const r = sig.and(s1, s2);

      expect(r.get()).toEqual(undefined);

      s1.dispatch(true);
      expect(r.get()).toEqual("Hello");

      s2.dispatch("BAR");
      expect(r.get()).toEqual("BAR");

      s1.dispatch(false);
      expect(r.get()).toEqual(undefined);

      const s3 = sig(2);
      const r2 = sig.and(s1, s2, s3);

      expect(r2.get()).toEqual(undefined);

      s1.dispatch(true);
      expect(r2.get()).toEqual(2);

      s2.dispatch("");
      expect(r2.get()).toEqual(undefined);

      s3.dispatch(5);
      s2.dispatch("1");
      expect(r2.get()).toEqual(5);
    });
  });

  describe("deriving another signal", () => {
    it("updates correctly", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!);

      expect(d.get()).toBe(2);

      elem2.dispatch(20);
      expect(d.get()).toBe(20);

      head.dispatch([elem2, elem1, elem3]);
      expect(d.get()).toBe(1);

      elem1.dispatch(10);
      expect(d.get()).toBe(10);
    });

    it("notifies the listeners", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!);

      const listener = vitest.fn();
      d.add(listener);
      expect(listener).toHaveBeenCalledTimes(1);

      elem2.dispatch(20);
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith(20);

      head.dispatch([elem2, elem1, elem3]);
      expect(listener).toHaveBeenCalledTimes(3);
      expect(listener).toHaveBeenLastCalledWith(1);

      elem1.dispatch(10);
      expect(listener).toHaveBeenCalledTimes(4);
      expect(listener).toHaveBeenLastCalledWith(10);
    });

    it("updates sinks", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!);

      const sink = d.derive((num) => `Number: ${num}`);

      expect(sink.get()).toBe("Number: 2");

      elem2.dispatch(1234);
      expect(sink.get()).toBe("Number: 1234");

      head.dispatch([elem2, elem3, elem1]);
      expect(sink.get()).toBe("Number: 3");

      elem3.dispatch(333);
      expect(sink.get()).toBe("Number: 333");
    });

    it("should not get destroyed until the dynamically derived is also destroyed", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!) as VSignal<number>;

      expect(d.get()).toBe(2);

      head.destroy();
      expect(d["isdestroyed"]).toBe(false);

      elem2.destroy();
      expect(d["isdestroyed"]).toBe(true);
    });

    it("should not get destroyed until the direct parent is also destroyed", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!) as VSignal<number>;

      expect(d.get()).toBe(2);

      elem2.destroy();
      expect(d["isdestroyed"]).toBe(false);

      head.destroy();
      expect(d["isdestroyed"]).toBe(true);
    });

    it("can still be accessed after the dynamic derived is destroyed", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!) as VSignal<number>;

      expect(d.get()).toBe(2);

      elem2.destroy();
      expect(d.get()).toBe(2);

      head.dispatch([elem1, elem2, elem3]);
      expect(d.get()).toBe(2);
    });

    it("deriving into destroyed signal should work correctly", () => {
      const elem1 = sig(1);
      const elem2 = sig(2);
      const elem3 = sig(3);
      const head = sig([elem1, elem2, elem3]);
      const d = head.derive((list) => list[1]!) as VSignal<number>;

      const listener = vitest.fn();
      d.add(listener);

      expect(listener).toHaveBeenCalledTimes(1);
      expect(d.get()).toBe(2);

      elem1.destroy();
      elem2.destroy();
      elem3.destroy();
      expect(d.get()).toBe(2);

      head.dispatch([elem1, elem3, elem2]);
      expect(d.get()).toBe(3);
      expect(listener).toHaveBeenCalledTimes(2);

      head.dispatch([elem3, elem1, elem2]);
      expect(d.get()).toBe(1);
      expect(listener).toHaveBeenCalledTimes(3);
    });

    it("multi-layer", () => {
      const s1 = sig(1, { name: "head" });
      const layer1 = sig({ s1: s1 }, { name: "layer 1" });
      const layer2 = sig({ layer1: layer1 }, { name: "layer 2" });

      const d = layer2.derive(
        (l2) =>
          l2.layer1.derive(
            (l1) =>
              l1.s1.derive((num) => `Num(${num})`, {
                name: "derived from head",
              }),
            {
              name: "derived from layer 1",
            },
          ),
        { name: "derived from layer 2" },
      );

      expect(d.get()).toBe("Num(1)");

      s1.dispatch(2);
      expect(d.get()).toBe("Num(2)");

      const listener = vitest.fn();
      d.add(listener);

      s1.dispatch(3);
      expect(d.get()).toBe("Num(3)");
      expect(listener).toHaveBeenCalledTimes(2);
      expect(listener).toHaveBeenLastCalledWith("Num(3)");
    });
  });
});
