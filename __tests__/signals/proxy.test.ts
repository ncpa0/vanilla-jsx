import { setFlagsFromString } from "v8";
import { describe, expect, it } from "vitest";
import { runInNewContext } from "vm";
import { sig } from "../../src";
import { bindSignal } from "../../src/signals/proxy";

setFlagsFromString("--expose_gc");
const rawGC = runInNewContext("gc");
async function gc() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  rawGC();
}

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
