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
          <If condition={s}>
            {() => <span id="foo">Foo</span>}
          </If>
        </div>
      );

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");
    });

    it("renders elements when condition is false", () => {
      const s = sig(false);
      const d = (
        <div>
          <If condition={s}>
            {() => <span id="foo">Foo</span>}
          </If>
        </div>
      );

      expect(d.outerHTML).toEqual("<div><template></template></div>");
    });

    it("replaces elements when condition changes", () => {
      const s = sig(true);
      const d = (
        <div>
          <If condition={s}>
            {() => <span id="foo">Foo</span>}
          </If>
        </div>
      );

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><template></template></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><template></template></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");
    });
  });

  describe("with else", () => {
    it("renders elements when condition is true", () => {
      const s = sig(true);
      const d = (
        <div>
          <If condition={s} else={() => <span id="bar">Bar</span>}>
            {() => <span id="foo">Foo</span>}
          </If>
        </div>
      );

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");
    });

    it("renders elements when condition is false", () => {
      const s = sig(false);
      const d = (
        <div>
          <If condition={s} else={() => <span id="bar">Bar</span>}>
            {() => <span id="foo">Foo</span>}
          </If>
        </div>
      );

      expect(d.outerHTML).toEqual("<div><span id=\"bar\">Bar</span></div>");
    });

    it("replaces elements when condition changes", () => {
      const s = sig(true);
      const d = (
        <div>
          <If condition={s} else={() => <span id="bar">Bar</span>}>
            {() => <span id="foo">Foo</span>}
          </If>
        </div>
      );

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><span id=\"bar\">Bar</span></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");

      s.dispatch(false);

      expect(d.outerHTML).toEqual("<div><span id=\"bar\">Bar</span></div>");

      s.dispatch(true);

      expect(d.outerHTML).toEqual("<div><span id=\"foo\">Foo</span></div>");
    });
  });

  it("should detach the listener after the element was garbage collected", async () => {
    const condition = sig(true);
    let d: JSX.Element | null = (
      <div>
        <If condition={condition}>
          {() => <span id="foo">Foo</span>}
        </If>
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
