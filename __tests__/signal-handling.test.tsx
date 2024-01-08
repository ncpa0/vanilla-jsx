import { setFlagsFromString } from "v8";
import { describe, expect, it } from "vitest";
import { runInNewContext } from "vm";
import { sig } from "../src";
import { Fragment, jsx } from "../src/jsx-runtime";

setFlagsFromString("--expose_gc");
const rawGC = runInNewContext("gc");
async function gc() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  rawGC();
}

describe("signal handling", () => {
  it("correctly binds to attributes and children", () => {
    const sigText = sig("Lorem Ipsum dolor sit amet");
    const sigClass = sig("foo bar");

    const d = (
      <div class={sigClass}>
        <span>{sigText}</span>
      </div>
    );

    expect(d.outerHTML).toEqual(
      "<div class=\"foo bar\"><span>Lorem Ipsum dolor sit amet</span></div>",
    );

    sigText.dispatch("Hello World!");
    sigClass.dispatch("baz qux");

    expect(d.outerHTML).toEqual(
      "<div class=\"baz qux\"><span>Hello World!</span></div>",
    );
  });

  it("correctly binds to multiple consecutive children", () => {
    const text1 = sig("Lorem Ipsum dolor sit amet,");
    const text2 = sig("consectetur adipiscing elit.");
    const text3 = sig("Praesent at molestie erat.");

    const d = (
      <span>
        {text1} {text2} {text3}
      </span>
    );

    expect(d.outerHTML).toEqual(
      "<span>Lorem Ipsum dolor sit amet, consectetur adipiscing elit. Praesent at molestie erat.</span>",
    );

    text1.dispatch("Hello");

    expect(d.outerHTML).toEqual(
      "<span>Hello consectetur adipiscing elit. Praesent at molestie erat.</span>",
    );

    text2.dispatch("World!");

    expect(d.outerHTML).toEqual(
      "<span>Hello World! Praesent at molestie erat.</span>",
    );
  });

  it("should detach the listener after the element was garbage collected", async () => {
    const text = sig("Lorem Ipsum dolor sit amet");
    const id = sig("foo");
    let d: JSX.Element | null = <div id={id}>{text}</div>;

    expect(text.listenerCount()).toEqual(1);
    expect(id.listenerCount()).toEqual(1);

    d = null;
    await gc();

    // Listener won't be removed until the next dispatch
    text.dispatch("");
    id.dispatch("");

    expect(text.listenerCount()).toEqual(0);
    expect(id.listenerCount()).toEqual(0);
  });

  it("correctly handles signal children with JSX.Elements", () => {
    const s = sig(0);
    const d = s.derive(v => {
      switch (v) {
        case 0:
          return "hello world";
        case 1:
          return <span>Hello World!</span>;
        case 2:
          return (
            <div>
              <input value={v} />
            </div>
          );
        default:
          return <p>No match</p>;
      }
    });

    const html = <body>{d}</body>;

    expect(html.outerHTML).toEqual(
      "<body>hello world</body>",
    );

    s.dispatch(1);

    expect(html.outerHTML).toEqual(
      "<body><span>Hello World!</span></body>",
    );

    s.dispatch(0);

    expect(html.outerHTML).toEqual(
      "<body>hello world</body>",
    );

    s.dispatch(2);

    expect(html.outerHTML).toEqual(
      "<body><div><input value=\"2\"></div></body>",
    );

    s.dispatch(3);

    expect(html.outerHTML).toEqual(
      "<body><p>No match</p></body>",
    );
  });
});
