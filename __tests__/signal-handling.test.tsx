import { describe, expect, it } from "vitest";
import { ClassName } from "../src";
import { Fragment, jsx } from "../src/jsx-runtime";
import { sig, VSignal } from "../src/signals";
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

    expect(d.outerHTML).toEqual('<div class="foo bar"><span>Lorem Ipsum dolor sit amet</span></div>');

    sigText.dispatch("Hello World!");
    sigClass.dispatch("baz qux");

    expect(d.outerHTML).toEqual('<div class="baz qux"><span>Hello World!</span></div>');
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

    expect(d.outerHTML).toEqual("<span>Hello consectetur adipiscing elit. Praesent at molestie erat.</span>");

    text2.dispatch("World!");

    expect(d.outerHTML).toEqual("<span>Hello World! Praesent at molestie erat.</span>");
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
    const d = s.derive((v) => {
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

    expect(html.outerHTML).toEqual("<body>hello world</body>");

    s.dispatch(1);

    expect(html.outerHTML).toEqual("<body><span>Hello World!</span></body>");

    s.dispatch(0);

    expect(html.outerHTML).toEqual("<body>hello world</body>");

    s.dispatch(2);

    expect(html.outerHTML).toEqual('<body><div><input class="2"></div></body>');

    s.dispatch(3);

    expect(html.outerHTML).toEqual("<body><p>No match</p></body>");
  });

  it("correctly binds to properties", () => {
    const elem1 = (<input value={"hello"} />) as HTMLInputElement;
    expect(elem1.value).toEqual("hello");

    const sigValue = sig("world");
    const elem2 = (<input value={sigValue} />) as HTMLInputElement;
    expect(elem2.value).toEqual("world");

    sigValue.dispatch("foo");
    expect(elem2.value).toEqual("foo");
  });

  it("correctly binds an array of Elements", () => {
    const s = sig(["foo", "bar", "baz"]);

    const elem = (
      <div>
        <p>Before</p>
        {s.derive((v) => v.map((v) => <span>{v}</span>))}
        <p>After</p>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>foo</span><span>bar</span><span>baz</span><p>After</p></div>",
    );

    s.dispatch(["qux", "coorge", "foo", "bar", "baz"]);

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>qux</span><span>coorge</span><span>foo</span><span>bar</span><span>baz</span><p>After</p></div>",
    );

    s.dispatch(["qux", "coorge", "bar", "baz"]);

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>qux</span><span>coorge</span><span>bar</span><span>baz</span><p>After</p></div>",
    );

    s.dispatch(["bar", "qux", "baz", "coorge"]);

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>bar</span><span>qux</span><span>baz</span><span>coorge</span><p>After</p></div>",
    );

    s.dispatch([]);

    expect(elem.outerHTML).toEqual("<div><p>Before</p><p>After</p></div>");

    s.dispatch(["foo", "bar", "baz"]);

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>foo</span><span>bar</span><span>baz</span><p>After</p></div>",
    );
  });

  it("correctly handles derived fragments", () => {
    const s = sig(1);

    const elem = (
      <div>
        <span>Start</span>
        {s.derive((i) => {
          switch (i) {
            case 1:
              return (
                <>
                  <span>FOO</span>
                </>
              );
            case 2:
              return (
                <>
                  <span>FOO</span>
                  <span>BAR</span>
                </>
              );
            case 3:
              return (
                <>
                  <>
                    <span>BAR</span>
                    <span>BAZ</span>
                  </>
                </>
              );
            case 4:
              return (
                <>
                  <span>BAR</span>
                  <span>FOO</span>
                  <span>BAZ</span>
                </>
              );
            case 5:
              return (
                <>
                  <>
                    <span>FOO</span>
                  </>
                </>
              );
            case 6:
              return <></>;
            case 7:
              return (
                <>
                  <>
                    <span></span>
                  </>
                </>
              );
          }
        })}
        <span>End</span>
      </div>
    );

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>FOO</span><span>End</span></div>");

    s.dispatch(2);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>FOO</span><span>BAR</span><span>End</span></div>");

    s.dispatch(3);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>BAR</span><span>BAZ</span><span>End</span></div>");

    s.dispatch(4);

    expect(elem.outerHTML).toEqual(
      "<div><span>Start</span><span>BAR</span><span>FOO</span><span>BAZ</span><span>End</span></div>",
    );

    s.dispatch(5);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>FOO</span><span>End</span></div>");

    s.dispatch(6);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>End</span></div>");

    s.dispatch(7);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span></span><span>End</span></div>");
  });

  it("correctly handles fragments in derived maps", () => {
    const s = sig(1);

    const elem = (
      <div>
        <span>Start</span>
        {s.derive((i) => {
          switch (i) {
            case 1:
              return [
                <>
                  <span>FOO</span>
                </>,
              ];
            case 2:
              return [
                <div />,
                <>
                  <span>FOO</span>
                </>,
                <h1 />,
              ];
            case 3:
              return [
                <div />,
                <>
                  <span>FOO</span>
                  <span>BAR</span>
                  <span>BAZ</span>
                </>,
                <h1 />,
              ];
            case 4:
              return [
                <div />,
                <>
                  <span>FOO</span>
                  <>
                    <span>BAR</span>
                    <span>BAZ</span>
                  </>
                  <span>QUX</span>
                </>,
                <h1 />,
              ];
            case 5:
              return [<div />, <></>, <h1 />];
          }
        })}
        <span>End</span>
      </div>
    );

    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>FOO</span><span>End</span></div>");

    s.dispatch(2);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><div></div><span>FOO</span><h1></h1><span>End</span></div>");

    s.dispatch(3);

    expect(elem.outerHTML).toEqual(
      "<div><span>Start</span><div></div><span>FOO</span><span>BAR</span><span>BAZ</span><h1></h1><span>End</span></div>",
    );

    s.dispatch(4);

    expect(elem.outerHTML).toEqual(
      "<div><span>Start</span><div></div><span>FOO</span><span>BAR</span><span>BAZ</span><span>QUX</span><h1></h1><span>End</span></div>",
    );

    s.dispatch(5);

    expect(elem.outerHTML).toEqual("<div><span>Start</span><div></div><h1></h1><span>End</span></div>");
  });

  it("correctly handles when derived array changes partially", () => {
    const s = sig(1);

    const foo = <span>foo</span>;
    const bar = <span>bar</span>;
    const baz = <span>baz</span>;

    const elem = (
      <div>
        <span>Start</span>
        {s.derive((i) => {
          switch (i) {
            case 1:
              return [foo, bar, baz];
            case 2:
              return [foo, baz];
            case 3:
              return [bar, baz];
            case 4:
              return [bar];
            case 5:
              return [];
            case 6:
              return [foo, bar, baz];
            case 7:
              return foo;
            case 8:
              return bar;
            case 9:
              return [bar, baz];
          }
        })}
        <span>End</span>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><span>Start</span><span>foo</span><span>bar</span><span>baz</span><span>End</span></div>",
    );

    s.dispatch(2);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>foo</span><span>baz</span><span>End</span></div>");

    s.dispatch(3);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>bar</span><span>baz</span><span>End</span></div>");

    s.dispatch(4);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>bar</span><span>End</span></div>");

    s.dispatch(5);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>End</span></div>");

    s.dispatch(6);
    expect(elem.outerHTML).toEqual(
      "<div><span>Start</span><span>foo</span><span>bar</span><span>baz</span><span>End</span></div>",
    );

    s.dispatch(7);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>foo</span><span>End</span></div>");

    s.dispatch(8);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>bar</span><span>End</span></div>");

    s.dispatch(9);
    expect(elem.outerHTML).toEqual("<div><span>Start</span><span>bar</span><span>baz</span><span>End</span></div>");
  });

  it("correctly handles when switching between an Element and an array", () => {
    const s = sig<Text | Element | Array<Text | Element> | undefined>(undefined);

    const elem = (
      <div>
        <p>Before</p>
        {s}
        <p>After</p>
      </div>
    );

    expect(elem.outerHTML).toEqual("<div><p>Before</p><p>After</p></div>");

    s.dispatch(document.createTextNode("Hello World"));

    expect(elem.outerHTML).toEqual("<div><p>Before</p>Hello World<p>After</p></div>");

    s.dispatch([document.createTextNode("Bye"), <span>I am free now</span>]);

    expect(elem.outerHTML).toEqual("<div><p>Before</p>Bye<span>I am free now</span><p>After</p></div>");

    s.dispatch(document.createTextNode("Hello again"));

    expect(elem.outerHTML).toEqual("<div><p>Before</p>Hello again<p>After</p></div>");

    s.dispatch([document.createTextNode("1"), document.createTextNode("2")]);

    expect(elem.outerHTML).toEqual("<div><p>Before</p>12<p>After</p></div>");

    s.dispatch(undefined);

    expect(elem.outerHTML).toEqual("<div><p>Before</p><p>After</p></div>");

    s.dispatch([<div />, <h1 />, document.createTextNode("1"), document.createTextNode("2"), <br />]);

    expect(elem.outerHTML).toEqual("<div><p>Before</p><div></div><h1></h1>12<br><p>After</p></div>");

    s.dispatch(<span>Foo bar baz</span>);

    expect(elem.outerHTML).toEqual("<div><p>Before</p><span>Foo bar baz</span><p>After</p></div>");

    s.dispatch(undefined);

    expect(elem.outerHTML).toEqual("<div><p>Before</p><p>After</p></div>");
  });

  it("should keep a reference to the bound signal", async () => {
    const source = sig(0) as VSignal<number>;

    let elem: Element | null = <div data-test={source.derive((n) => n + 5)}>{source.derive((n) => String(n * 2))}</div>;

    expect(elem!.outerHTML).toEqual('<div data-test="5">0</div>');
    expect(source["derivedSignals"].length).toEqual(2);

    source.dispatch(1);
    expect(elem!.outerHTML).toEqual('<div data-test="6">2</div>');
    expect(source["derivedSignals"].length).toEqual(2);

    // the derived signals should not get collected
    await gc();
    await gc();

    source.dispatch(3);
    expect(elem!.outerHTML).toEqual('<div data-test="8">6</div>');
    expect(source["derivedSignals"].length).toEqual(2);

    await gc();
    await gc();

    source.dispatch(5);
    expect(elem!.outerHTML).toEqual('<div data-test="10">10</div>');
    expect(source["derivedSignals"].length).toEqual(2);

    elem = null;

    // now there should not be any refs to the derived signals anymore
    await gc();
    await gc();

    source.dispatch(7);
    expect(source["derivedSignals"].length).toEqual(0);
  });

  describe("for class name", () => {
    it("object as class name", () => {
      const obj = {
        [Symbol.toPrimitive]() {
          return "foobarcn";
        },
      };

      const elem = <div class={obj} />;

      expect(elem.outerHTML).toEqual('<div class="foobarcn"></div>');
    });

    it("signal object as class name", () => {
      const obj1 = {
        [Symbol.toPrimitive]() {
          return "initial";
        },
      };

      const obj2 = {
        [Symbol.toPrimitive]() {
          return "abcdefgg";
        },
      };

      const s = sig(obj1);

      const elem = <div class={s} />;

      expect(elem.outerHTML).toEqual('<div class="initial"></div>');

      s.dispatch(obj2);

      expect(elem.outerHTML).toEqual('<div class="abcdefgg"></div>');
    });

    describe("arrays", () => {
      it("correctly handles string arrays", () => {
        const elem = <div class={["foo", null, "bar", false, "baz", undefined, 0]} />;
        expect(elem.outerHTML).toEqual('<div class="foo bar baz 0"></div>');
      });

      it("correctly handles signal of array", () => {
        const cnameSig = sig(["foo", null, "bar", false, "baz", undefined, 0, true]);
        const elem = <div class={cnameSig} />;
        expect(elem.outerHTML).toEqual('<div class="foo bar baz 0"></div>');

        cnameSig.dispatch(["bar", "qux", null, "true", true]);
        expect(elem.outerHTML).toEqual('<div class="bar qux true"></div>');
      });

      it("correctly handles array with signals", () => {
        const cname1 = sig<ClassName>("foo");
        const cname2 = sig<ClassName>("baz");
        const elem = <div class={[cname1, "bar", cname2, null, "qux"]} />;
        expect(elem.outerHTML).toEqual('<div class="foo bar baz qux"></div>');

        cname1.dispatch("oof");
        expect(elem.outerHTML).toEqual('<div class="bar baz qux oof"></div>');

        cname2.dispatch(false);
        expect(elem.outerHTML).toEqual('<div class="bar qux oof"></div>');

        cname2.dispatch("zab");
        expect(elem.outerHTML).toEqual('<div class="bar qux oof zab"></div>');
      });

      it("correctly handles array elements containing multiple class names in one string", () => {
        const s = sig("foo bar baz");
        const elem = <div class={[s, "qux coorge"]} />;
        expect(elem.outerHTML).toEqual('<div class="foo bar baz qux coorge"></div>');

        s.dispatch("bar baz");
        expect(elem.outerHTML).toEqual('<div class="qux coorge bar baz"></div>');

        s.dispatch("bar");
        expect(elem.outerHTML).toEqual('<div class="qux coorge bar"></div>');

        s.dispatch("foo baz");
        expect(elem.outerHTML).toEqual('<div class="qux coorge foo baz"></div>');

        const s2 = sig(["foo bar baz"]);
        const elem2 = <div class={s2} />;
        expect(elem2.outerHTML).toEqual('<div class="foo bar baz"></div>');

        s2.dispatch(["bar baz"]);
        expect(elem2.outerHTML).toEqual('<div class="bar baz"></div>');

        s2.dispatch(["bar"]);
        expect(elem2.outerHTML).toEqual('<div class="bar"></div>');

        s2.dispatch(["foo baz"]);
        expect(elem2.outerHTML).toEqual('<div class="foo baz"></div>');
      });

      it("correctly handles arrays with objects", () => {
        const obj1 = {
          [Symbol.toPrimitive]() {
            return "oof";
          },
        };

        const obj2 = {
          [Symbol.toPrimitive]() {
            return "rab";
          },
        };

        const elem = <div class={["foo", obj1, "bar", obj2]} />;
        expect(elem.outerHTML).toEqual('<div class="foo oof bar rab"></div>');
      });

      it("correctly handles arrays with signals of objects", () => {
        const obj1 = {
          [Symbol.toPrimitive]() {
            return "c1";
          },
        };

        const obj2 = {
          [Symbol.toPrimitive]() {
            return "c2";
          },
        };

        const cname1 = sig<ClassName>(obj1);

        const elem = <div class={["foo", cname1]} />;
        expect(elem.outerHTML).toEqual('<div class="foo c1"></div>');

        cname1.dispatch("notaobject");
        expect(elem.outerHTML).toEqual('<div class="foo notaobject"></div>');

        cname1.dispatch(obj2);
        expect(elem.outerHTML).toEqual('<div class="foo c2"></div>');
      });

      it("corretly handle a signal with an array with objects", () => {
        const obj1 = {
          [Symbol.toPrimitive]() {
            return "cn1";
          },
        };

        const obj2 = {
          [Symbol.toPrimitive]() {
            return "cn2";
          },
        };

        const cname1 = sig<ClassName>([obj1]);

        const elem = <div class={cname1} />;
        expect(elem.outerHTML).toEqual('<div class="cn1"></div>');

        cname1.dispatch(["notaobject", obj1]);
        expect(elem.outerHTML).toEqual('<div class="notaobject cn1"></div>');

        cname1.dispatch(["notaobject", obj2]);
        expect(elem.outerHTML).toEqual('<div class="notaobject cn2"></div>');

        cname1.dispatch(["notaobject", obj2, obj1]);
        expect(elem.outerHTML).toEqual('<div class="notaobject cn2 cn1"></div>');

        cname1.dispatch(["notaobject", obj1]);
        expect(elem.outerHTML).toEqual('<div class="notaobject cn1"></div>');

        cname1.dispatch(["notaobject", "obj1"]);
        expect(elem.outerHTML).toEqual('<div class="notaobject obj1"></div>');
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
        expect(elem.outerHTML).toEqual('<div class="foo baz coorg"></div>');
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
        expect(elem.outerHTML).toEqual('<div class="foo baz coorg"></div>');

        cnameSig.dispatch({
          foo: true,
          bar: false,
          baz: 0,
          qux: 1,
          coorg: "lol",
          lol: "",
        });
        expect(elem.outerHTML).toEqual('<div class="foo qux coorg"></div>');

        cnameSig.dispatch({
          bar: true,
          qux: 1,
          lol: true,
        });
        expect(elem.outerHTML).toEqual('<div class="bar qux lol"></div>');

        cnameSig.dispatch({
          bar: true,
          qux: false,
          lol: true,
        });
        expect(elem.outerHTML).toEqual('<div class="bar lol"></div>');

        cnameSig.dispatch({
          foobar: true,
          bar: true,
          lol: true,
        });
        expect(elem.outerHTML).toEqual('<div class="foobar bar lol"></div>');

        cnameSig.dispatch({});
        expect(elem.outerHTML).toEqual('<div class=""></div>');

        cnameSig.dispatch({
          foo: false,
          bar: true,
        });
        expect(elem.outerHTML).toEqual('<div class="bar"></div>');
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
        expect(elem.outerHTML).toEqual('<div class="foo baz"></div>');

        cnames.bar.dispatch(true);
        expect(elem.outerHTML).toEqual('<div class="foo baz bar"></div>');

        cnames.baz.dispatch(0);
        expect(elem.outerHTML).toEqual('<div class="foo bar"></div>');

        cnames.qux.dispatch(1);
        expect(elem.outerHTML).toEqual('<div class="foo bar qux"></div>');

        cnames.baz.dispatch("yes");
        expect(elem.outerHTML).toEqual('<div class="foo bar qux baz"></div>');
      });
    });
  });

  describe("for styles", () => {
    it("signal of object", () => {
      const s = sig<Partial<CSSStyleDeclaration>>({
        color: "red",
        backgroundColor: "blue",
        fontSize: "12px",
      });
      const elem = <div style={s} />;
      expect(elem.outerHTML).toEqual('<div style="color: red; background-color: blue; font-size: 12px;"></div>');

      s.dispatch({
        color: "red",
        backgroundColor: "yellow",
        fontSize: "12px",
      });
      expect(elem.outerHTML).toEqual('<div style="color: red; background-color: yellow; font-size: 12px;"></div>');

      s.dispatch({
        padding: "1px 2px",
        color: "red",
        backgroundColor: "yellow",
        fontSize: "12px",
      });
      expect(elem.outerHTML).toEqual(
        '<div style="padding: 1px 2px; color: red; background-color: yellow; font-size: 12px;"></div>',
      );

      s.dispatch({
        padding: "1px 2px",
        backgroundColor: "yellow",
        fontSize: "16px",
      });
      expect(elem.outerHTML).toEqual(
        '<div style="padding: 1px 2px; background-color: yellow; font-size: 16px;"></div>',
      );
    });

    it("object of signals", () => {
      const colorSig = sig<string | undefined>("red");
      const marginSig = sig<string | undefined>("2em");
      const bgSig = sig<string | undefined>("blue");
      const elem = (
        <div
          style={{
            zIndex: "5",
            color: colorSig,
            margin: marginSig,
            backgroundColor: bgSig,
            fontSize: "12px",
          }}
        />
      );
      expect(elem.outerHTML).toEqual(
        '<div style="z-index: 5; color: red; margin: 2em; background-color: blue; font-size: 12px;"></div>',
      );

      marginSig.dispatch("1em");
      expect(elem.outerHTML).toEqual(
        '<div style="z-index: 5; color: red; margin: 1em; background-color: blue; font-size: 12px;"></div>',
      );

      colorSig.dispatch("green");
      bgSig.dispatch("aliceblue");
      expect(elem.outerHTML).toEqual(
        '<div style="z-index: 5; color: green; margin: 1em; background-color: aliceblue; font-size: 12px;"></div>',
      );

      bgSig.dispatch(undefined);
      expect(elem.outerHTML).toEqual('<div style="z-index: 5; color: green; margin: 1em; font-size: 12px;"></div>');

      marginSig.dispatch(undefined);
      bgSig.dispatch("purple");
      expect(elem.outerHTML).toEqual(
        '<div style="z-index: 5; color: green; font-size: 12px; background-color: purple;"></div>',
      );
    });
  });
});
