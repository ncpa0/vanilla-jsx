import { setFlagsFromString } from "v8";
import { describe, expect, it } from "vitest";
import { runInNewContext } from "vm";
import { If, sig } from "../../src";
import { Fragment, jsx } from "../../src/jsx-runtime";

setFlagsFromString("--expose_gc");
const rawGC = runInNewContext("gc");
async function gc() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  rawGC();
}

describe("If", () => {
  describe("without else", () => {
    it("renders elements when condition is true", () => {
      const s = sig(true);
      const d = (
        <div>
          <If
            condition={s}
            then={() => <span id="foo">Foo</span>}
          />
        </div>
      );

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");
    });

    it("renders elements when condition is false", () => {
      const s = sig(false);
      const d = (
        <div>
          <If
            condition={s}
            then={() => <span id="foo">Foo</span>}
          />
        </div>
      );

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"></div></div>");
    });

    it("replaces elements when condition changes", () => {
      const s = sig(true);
      const d = (
        <div>
          <If
            condition={s}
            then={() => <span id="foo">Foo</span>}
          />
        </div>
      );

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"></div></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"></div></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");
    });
  });

  describe("with else", () => {
    it("renders elements when condition is true", () => {
      const s = sig(true);
      const d = (
        <div>
          <If
            condition={s}
            then={() => <span id="foo">Foo</span>}
            else={() => <span id="bar">Bar</span>}
          />
        </div>
      );

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");
    });

    it("renders elements when condition is false", () => {
      const s = sig(false);
      const d = (
        <div>
          <If
            condition={s}
            then={() => <span id="foo">Foo</span>}
            else={() => <span id="bar">Bar</span>}
          />
        </div>
      );

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"bar\">Bar</span></div></div>");
    });

    it("replaces elements when condition changes", () => {
      const s = sig(true);
      const d = (
        <div>
          <If
            condition={s}
            then={() => <span id="foo">Foo</span>}
            else={() => <span id="bar">Bar</span>}
          />
        </div>
      );

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"bar\">Bar</span></div></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"bar\">Bar</span></div></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><div class=\"vjsx-if-container\"><span id=\"foo\">Foo</span></div></div>");
    });
  });

  it("should detach the listener after the element was garbage collected", async () => {
    const condition = sig(true);
    let d: JSX.Element | null = (
      <div>
        <If
          condition={condition}
          then={() => <span id="foo">Foo</span>}
        />
      </div>
    );

    expect(condition.listenerCount()).toEqual(1);

    d = null;
    await gc();

    // Listener won't be removed until the next dispatch
    condition.dispatch(false);

    expect(condition.listenerCount()).toEqual(0);
  });
});