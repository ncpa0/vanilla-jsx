import { describe, expect, it, Mock, vitest } from "vitest";
import { sig, Signal } from "../../src";
import { ReadonlySignal, SignalListenerReference, VReadonlySignal, VSignal } from "../../src/signals/signal";
import { gc } from "../gc-util";
import { sleep } from "../utils";

describe("VSignal()", () => {
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

    it("should update or not down the chain derived signals depending on if they are observed", () => {
      const head = sig(0) as VSignal<number>;

      const d1 = head.derive(v => v + 1) as VSignal<number>;
      const d2 = d1.derive(v => v + 1) as VSignal<number>;
      const d3 = d2.derive(v => v + 1) as VSignal<number>;
      const d4 = d3.derive(v => v + 1) as VSignal<number>;

      expect(head.current()).toBe(0);
      expect(d1.current()).toBe(1);
      expect(d2.current()).toBe(2);
      expect(d3.current()).toBe(3);
      expect(d4.current()).toBe(4);

      head.dispatch(10);

      // inner value does not re-calculate until it is observed
      expect(head["value"]).toBe(10);
      expect(d1["value"]).toBe(1);
      expect(d2["value"]).toBe(2);
      expect(d3["value"]).toBe(3);
      expect(d4["value"]).toBe(4);

      expect(head.current()).toBe(10);
      expect(d1.current()).toBe(11);
      expect(d2.current()).toBe(12);
      expect(d3.current()).toBe(13);
      expect(d4.current()).toBe(14);

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

      expect(head.current()).toBe(26);
      expect(d1.current()).toBe(27);
      expect(d2.current()).toBe(28);
      expect(d3.current()).toBe(29);
      expect(d4.current()).toBe(30);
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
      const s = sig("foo") as VSignal<string>;
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

    it("derived signals should not be GCd if they are being observed", async () => {
      const s = sig("foo") as VSignal<string>;
      const getLength = vitest.fn((v: string) => v.length);
      let derived: ReadonlySignal<number> | null = s.derive(getLength);
      const derivedSig = new WeakRef(derived);

      expect(derived.current()).toBe(3);
      expect(derivedSig.deref()).toBeDefined();

      derived.add(() => {});
      derived = null;

      await gc();
      s.dispatch("foobar");
      expect(s.derivedCount()).toBe(1);
      expect(derivedSig.deref()).toBeDefined();

      await gc();
      await gc();
      s.dispatch("foobar");
      expect(s.derivedCount()).toBe(1);
      expect(derivedSig.deref()).toBeDefined();
    });

    it("deeply derived signals should not be GCd when they are being observed", async () => {
      const head = sig(1);
      let callCount = 0;
      (function() {
        const tail = head.derive(v => v + 1).derive(v => v + 1).derive(v => ({ DERIVED: true }));
        tail.add(() => {
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
      const d1 = head.derive(v => v + 1);
      const d2 = d1.derive(v => v / v);
      const tail = d2.derive(calcTail);

      expect(tail.current()).toBe(2);

      const onD2Change = vitest.fn();
      d2.add(onD2Change);

      calcTail.mockClear();
      onD2Change.mockClear();

      head.dispatch(2);

      expect(tail.current()).toBe(2);
      expect(calcTail).toHaveBeenCalledTimes(0);
      expect(onD2Change).toHaveBeenCalledTimes(0);

      sig.startBatch();
      head.dispatch(3);
      head.dispatch(4);
      head.dispatch(5);
      sig.commitBatch();

      expect(tail.current()).toBe(2);
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

      expect(tail.current()).toBe(0);

      const onD1Change = vitest.fn();
      d1.add(onD1Change);

      calcTail.mockClear();
      onD1Change.mockClear();

      sig.startBatch();
      h1.dispatch(3);
      h2.dispatch(3);
      sig.commitBatch();

      expect(tail.current()).toBe(0);
      expect(calcTail).toHaveBeenCalledTimes(0);
      expect(onD1Change).toHaveBeenCalledTimes(0);
    });

    describe("complex scenarios", () => {
      describe("diamond", () => {
        it("scenario 1 - reading", () => {
          const head = new VSignal(0);

          const d1 = head.derive(v => v + 1);
          const d2 = head.derive(v => v + 2);
          const d3 = head.derive(v => v + 3);
          const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);

          expect(d4.current()).toBe(6);
          expect(d3.current()).toBe(3);
          expect(d2.current()).toBe(2);
          expect(d1.current()).toBe(1);
          expect(head.current()).toBe(0);

          head.dispatch(10);

          expect(d4.current()).toBe(36);
          expect(d3.current()).toBe(13);
          expect(d2.current()).toBe(12);
          expect(d1.current()).toBe(11);
          expect(head.current()).toBe(10);
        });

        it("scenario 2 - listener", () => {
          const head = new VSignal(0);

          const d1 = head.derive(v => v + 1);
          const d2 = head.derive(v => v + 2);
          const d3 = head.derive(v => v + 3);
          const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);

          const onD4Change = vitest.fn();
          d4.add(onD4Change);
          onD4Change.mockClear();

          head.dispatch(10);

          expect(onD4Change).toHaveBeenLastCalledWith(36);
          expect(d4.current()).toBe(36);
        });

        it("scenario 3 - derived listener", () => {
          const head = new VSignal(0);

          const d1 = head.derive(v => v + 1);
          const d2 = head.derive(v => v + 2);
          const d3 = head.derive(v => v + 3);
          const d4 = sig.derive(d1, d2, d3, (v1, v2, v3) => v1 + v2 + v3);
          const tail = d4.derive(v => v * 2);

          const onTailChange = vitest.fn();
          tail.add(onTailChange);
          onTailChange.mockClear();

          head.dispatch(10);

          expect(onTailChange).toHaveBeenLastCalledWith(72);
          expect(tail.current()).toBe(72);
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

          const r1 = join.derive(v => v / 4);
          const r2 = join.derive(v => v / v);
          const r3 = join.derive(v => v * 2);

          expect(r1.current()).toBe(2.5);
          expect(r2.current()).toBe(1);
          expect(r3.current()).toBe(20);

          source1.dispatch(2);

          expect(r1.current()).toBe(3);
          expect(r2.current()).toBe(1);
          expect(r3.current()).toBe(24);
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

          const r1 = join.derive(v => v / 4);
          const r2 = join.derive(v => v / v);
          const r3 = join.derive(v => v * 2);

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
              s1: c.s2.derive(v => v + 1),
              s2: VSignal.derive(c.s1, c.s3, (v1, v3) => v1 + v3),
              s3: VSignal.derive(c.s4, c.s1, (v4, v1) => v4 - v1),
              s4: c.s3.derive(v => v - 1),
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

          expect(end.s1.current()).toBe(control.s1);
          expect(end.s2.current()).toBe(control.s2);
          expect(end.s3.current()).toBe(control.s3);
          expect(end.s4.current()).toBe(control.s4);

          start.s1.dispatch(10);

          expect(end.s1.current()).toBe(d1Control.s1);
          expect(end.s2.current()).toBe(d1Control.s2);
          expect(end.s3.current()).toBe(d1Control.s3);
          expect(end.s4.current()).toBe(d1Control.s4);

          start.s2.dispatch(5);

          expect(end.s1.current()).toBe(d2Control.s1);
          expect(end.s2.current()).toBe(d2Control.s2);
          expect(end.s3.current()).toBe(d2Control.s3);
          expect(end.s4.current()).toBe(d2Control.s4);

          start.s3.dispatch(0);

          expect(end.s1.current()).toBe(d3Control.s1);
          expect(end.s2.current()).toBe(d3Control.s2);
          expect(end.s3.current()).toBe(d3Control.s3);
          expect(end.s4.current()).toBe(d3Control.s4);

          start.s4.dispatch(-2);

          expect(end.s1.current()).toBe(d4Control.s1);
          expect(end.s2.current()).toBe(d4Control.s2);
          expect(end.s3.current()).toBe(d4Control.s3);
          expect(end.s4.current()).toBe(d4Control.s4);
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
              s1: c.s2.derive(v => v + 1),
              s2: VSignal.derive(c.s1, c.s3, (v1, v3) => v1 + v3),
              s3: VSignal.derive(c.s4, c.s1, (v4, v1) => v4 - v1),
              s4: c.s3.derive(v => v - 1),
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
              s1: c.s2.derive(v => v + 1),
              s2: VSignal.derive(c.s1, c.s3, (v1, v3) => v1 + v3),
              s3: VSignal.derive(c.s4, c.s1, (v4, v1) => v4 - v1),
              s4: c.s3.derive(v => v - 1),
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

          expect(end.s1.current()).toBe(control.s1);
          expect(end.s2.current()).toBe(control.s2);
          expect(end.s3.current()).toBe(control.s3);
          expect(end.s4.current()).toBe(control.s4);

          start.s1.dispatch(10);

          expect(end.s1.current()).toBe(d1Control.s1);
          expect(end.s2.current()).toBe(d1Control.s2);
          expect(end.s3.current()).toBe(d1Control.s3);
          expect(end.s4.current()).toBe(d1Control.s4);

          start.s2.dispatch(5);

          expect(end.s1.current()).toBe(d2Control.s1);
          expect(end.s2.current()).toBe(d2Control.s2);
          expect(end.s3.current()).toBe(d2Control.s3);
          expect(end.s4.current()).toBe(d2Control.s4);

          start.s3.dispatch(0);

          expect(end.s1.current()).toBe(d3Control.s1);
          expect(end.s2.current()).toBe(d3Control.s2);
          expect(end.s3.current()).toBe(d3Control.s3);
          expect(end.s4.current()).toBe(d3Control.s4);

          start.s4.dispatch(-2);

          expect(end.s1.current()).toBe(d4Control.s1);
          expect(end.s2.current()).toBe(d4Control.s2);
          expect(end.s3.current()).toBe(d4Control.s3);
          expect(end.s4.current()).toBe(d4Control.s4);
        });
      });
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

  describe("sig.derive()", () => {
    it("should correctly derive from 2 sources", () => {
      const sig1 = sig("Hello");
      const sig2 = sig("World");

      const derived = sig.derive(sig1, sig2, (v1, v2) => `${v1} ${v2}`);
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

      const derived = sig.derive(sig1, sig2, sig3, sig4, (v1, v2, v3, v4) => `[${v1} ${v2} ${v3}]`.repeat(v4));
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

      const derived = sig.derive(sig1, sig2, sig3, (v1, v2, v3) => `[${v1} ${v2} ${v3}]`);
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

      const derived = sig.derive(sig1, sig2, sig3, (v1, v2, v3) => `[${v1} ${v2} ${v3}]`);
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
      const s1 = sig("foo") as VSignal<string>;
      const s2 = sig("bar") as VSignal<string>;
      const s3 = sig("baz") as VSignal<string>;
      const derivedRefs1 = s1["derivedSignals"];
      const derivedRefs2 = s2["derivedSignals"];
      const derivedRefs3 = s3["derivedSignals"];
      let derived: ReadonlySignal<string> | null = sig.derive(s1, s2, s3, (v1, v2, v3) => `[${v1} ${v2} ${v3}]`);

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

  describe("batching", () => {
    it("should call all listeners after batch commit", () => {
      const s = new VSignal(1);
      const onChange = vitest.fn();
      s.add(onChange);

      expect(s.current()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);

      VSignal.startBatch();

      s.dispatch(2);
      expect(s.current()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      s.dispatch(3);
      expect(s.current()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);
      s.dispatch(4);
      expect(s.current()).toBe(1);
      expect(onChange).toHaveBeenCalledTimes(1);

      VSignal.commitBatch();

      expect(s.current()).toBe(4);
      expect(onChange).toHaveBeenCalledTimes(2);
      expect(onChange).toHaveBeenLastCalledWith(4);
    });

    it("should minimize updates to diamond structure", () => {
      const head = new VSignal(0);

      const d1 = head.derive(v => v + 1);
      const d2 = head.derive(v => v + 2);
      const d3 = head.derive(v => v + 3);
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
              s1: c.s2.derive(v => v + 1),
              s2: VSignal.derive(c.s1, c.s3, (v1, v3) => v1 + v3),
              s3: VSignal.derive(c.s4, c.s1, (v4, v1) => v4 - v1),
              s4: c.s3.derive(v => v - 1),
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
              s1: c.s2.derive(v => v + 1),
              s2: VSignal.derive(c.s1, c.s3, (v1, v3) => v1 + v3),
              s3: VSignal.derive(c.s4, c.s1, (v4, v1) => v4 - v1),
              s4: c.s3.derive(v => v - 1),
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
            listeners.push(
              m1,
              m2,
              m3,
              m4,
            );
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

          expect(end.s1.current()).toBe(control.s1);
          expect(end.s2.current()).toBe(control.s2);
          expect(end.s3.current()).toBe(control.s3);
          expect(end.s4.current()).toBe(control.s4);

          VSignal.startBatch();
          start.s1.dispatch(13);
          start.s2.dispatch(7);
          start.s3.dispatch(5);
          start.s4.dispatch(3);
          VSignal.commitBatch();

          expect(end.s1.current()).toBe(dControl.s1);
          expect(end.s2.current()).toBe(dControl.s2);
          expect(end.s3.current()).toBe(dControl.s3);
          expect(end.s4.current()).toBe(dControl.s4);

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
});
