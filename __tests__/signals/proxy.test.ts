import { describe, expect, it } from "vitest";
import { sig } from "../../src";
import { bindSignal } from "../../src/signals/proxy";
import { gc } from "../gc-util";

describe("signal proxy", () => {
  describe("bindSignal()", () => {
    it("should detach the signal after the element is garbage collected", async () => {
      const s = sig("foo");

      let elem: Element | null = document.createElement("div");

      bindSignal(s, elem, (boundElem: Element, value: string) => {
        boundElem.classList.add(value);
      });

      expect(s.listenerCount()).toBe(1);
      expect(elem.classList.contains("foo")).toBe(true);

      elem = null;
      await gc();

      expect(s.listenerCount()).toBe(1);

      s.dispatch("bar");

      expect(s.listenerCount()).toBe(0);
    });
  });
});
