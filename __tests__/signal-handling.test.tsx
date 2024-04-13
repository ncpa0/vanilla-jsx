import { describe, expect, it } from "vitest";
import { ClassName, sig } from "../src";
import { Fragment, jsx } from "../src/jsx-runtime";
import { gc } from "./gc-util";

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
              <input class={v} />
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
      "<body><div><input class=\"2\"></div></body>",
    );

    s.dispatch(3);

    expect(html.outerHTML).toEqual(
      "<body><p>No match</p></body>",
    );
  });

  it("correctly binds to properties", () => {
    const elem1 = <input value={"hello"} /> as HTMLInputElement;
    expect(elem1.value).toEqual("hello");

    const sigValue = sig("world");
    const elem2 = <input value={sigValue} /> as HTMLInputElement;
    expect(elem2.value).toEqual("world");

    sigValue.dispatch("foo");
    expect(elem2.value).toEqual("foo");
  });

  describe("for class name", () => {
    describe("arrays", () => {
      it("correctly handles string arrays", () => {
        const elem = <div class={["foo", null, "bar", false, "baz", undefined, 0]} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz 0\"></div>");
      });

      it("correctly handles signal of array", () => {
        const cnameSig = sig(["foo", null, "bar", false, "baz", undefined, 0, true]);
        const elem = <div class={cnameSig} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz 0\"></div>");

        cnameSig.dispatch(["bar", "qux", null, "true", true]);
        expect(elem.outerHTML).toEqual("<div class=\"bar qux true\"></div>");
      });

      it("correctly handles array with signals", () => {
        const cname1 = sig<ClassName>("foo");
        const cname2 = sig<ClassName>("baz");
        const elem = <div class={[cname1, "bar", cname2, null, "qux"]} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz qux\"></div>");

        cname1.dispatch("oof");
        expect(elem.outerHTML).toEqual("<div class=\"bar baz qux oof\"></div>");

        cname2.dispatch(false);
        expect(elem.outerHTML).toEqual("<div class=\"bar qux oof\"></div>");

        cname2.dispatch("zab");
        expect(elem.outerHTML).toEqual("<div class=\"bar qux oof zab\"></div>");
      });

      it("correctly handles array elements containing multiple class names in one string", () => {
        const s = sig("foo bar baz");
        const elem = <div class={[s, "qux coorge"]} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz qux coorge\"></div>");

        s.dispatch("bar baz");
        expect(elem.outerHTML).toEqual("<div class=\"qux coorge bar baz\"></div>");

        s.dispatch("bar");
        expect(elem.outerHTML).toEqual("<div class=\"qux coorge bar\"></div>");

        s.dispatch("foo baz");
        expect(elem.outerHTML).toEqual("<div class=\"qux coorge foo baz\"></div>");

        const s2 = sig(["foo bar baz"]);
        const elem2 = <div class={s2} />;
        expect(elem2.outerHTML).toEqual("<div class=\"foo bar baz\"></div>");

        s2.dispatch(["bar baz"]);
        expect(elem2.outerHTML).toEqual("<div class=\"bar baz\"></div>");

        s2.dispatch(["bar"]);
        expect(elem2.outerHTML).toEqual("<div class=\"bar\"></div>");

        s2.dispatch(["foo baz"]);
        expect(elem2.outerHTML).toEqual("<div class=\"foo baz\"></div>");
      });
    });

    describe("records", () => {
      it("correctly handles record", () => {
        const elem = (
          <div
            class={{
              foo: true,
              bar: false,
              baz: 1,
              qux: 0,
              coorg: "lol",
              lol: "",
            }}
          />
        );
        expect(elem.outerHTML).toEqual("<div class=\"foo baz coorg\"></div>");
      });

      it("correctly handles signal of record", () => {
        const cnameSig = sig<Record<string, any>>({
          foo: true,
          bar: false,
          baz: 1,
          qux: 0,
          coorg: "lol",
          lol: "",
        });
        const elem = <div class={cnameSig} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo baz coorg\"></div>");

        cnameSig.dispatch({
          foo: true,
          bar: false,
          baz: 0,
          qux: 1,
          coorg: "lol",
          lol: "",
        });
        expect(elem.outerHTML).toEqual("<div class=\"foo qux coorg\"></div>");

        cnameSig.dispatch({
          bar: true,
          qux: 1,
          lol: true,
        });
        expect(elem.outerHTML).toEqual("<div class=\"bar qux lol\"></div>");

        cnameSig.dispatch({
          bar: true,
          qux: false,
          lol: true,
        });
        expect(elem.outerHTML).toEqual("<div class=\"bar lol\"></div>");

        cnameSig.dispatch({
          foobar: true,
          bar: true,
          lol: true,
        });
        expect(elem.outerHTML).toEqual("<div class=\"foobar bar lol\"></div>");

        cnameSig.dispatch({});
        expect(elem.outerHTML).toEqual("<div class=\"\"></div>");

        cnameSig.dispatch({
          foo: false,
          bar: true,
        });
        expect(elem.outerHTML).toEqual("<div class=\"bar\"></div>");
      });

      it("correctly handles record with signals", () => {
        const cnames = {
          foo: true,
          bar: sig<any>(false),
          baz: sig<any>(1),
          qux: sig<any>(0),
          coorg: 0,
        };
        const elem = <div class={cnames} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo baz\"></div>");

        cnames.bar.dispatch(true);
        expect(elem.outerHTML).toEqual("<div class=\"foo baz bar\"></div>");

        cnames.baz.dispatch(0);
        expect(elem.outerHTML).toEqual("<div class=\"foo bar\"></div>");

        cnames.qux.dispatch(1);
        expect(elem.outerHTML).toEqual("<div class=\"foo bar qux\"></div>");

        cnames.baz.dispatch("yes");
        expect(elem.outerHTML).toEqual("<div class=\"foo bar qux baz\"></div>");
      });
    });
  });
});
