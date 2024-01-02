import { describe, expect, it, jest } from "@jest/globals";
import { sig, Signal } from "../../src";

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
      const listener = jest.fn();

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
      const listener = jest.fn();

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
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

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
      const listener = jest.fn();

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
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

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
  });

  describe("destroy()", () => {
    it("should detach all listeners", () => {
      const signal = sig("001");
      const listener1 = jest.fn();
      const listener2 = jest.fn();
      const listener3 = jest.fn();

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
});
