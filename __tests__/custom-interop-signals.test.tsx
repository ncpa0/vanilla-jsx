import {
  computed,
  ReadonlySignal as PreactReadonlySignal,
  Signal as PreactSignal,
  signal,
} from "@preact/signals-core";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ClassName } from "../src";
import { Fragment, jsx } from "../src/jsx-runtime";
import { SignalInteropInterface } from "../src/sig-proxy/_interface";
import { SignalsReg } from "../src/sig-proxy/_proxy";
import { gc } from "./gc-util";

declare global {
  namespace JSX {
    interface SupportedSignals<V> {
      preact: PreactSignal<V> | PreactReadonlySignal<V>;
    }
  }
}

let subsCount = 0;

class PreactSignalInterop
  implements
    SignalInteropInterface<PreactSignal<any> | PreactReadonlySignal<any>>
{
  is(signal: unknown): signal is PreactSignal<any> | PreactReadonlySignal<any> {
    return signal instanceof PreactSignal;
  }
  add(
    signal: PreactSignal<any> | PreactReadonlySignal<any>,
    cb: (value: any) => any,
  ): () => void {
    // cb(signal.value);
    const detach = signal.subscribe(cb);
    subsCount++;
    return () => {
      detach();
      subsCount--;
    };
  }
}

describe("Custom interop signals", () => {
  beforeAll(() => {
    SignalsReg.register(new PreactSignalInterop());
  });

  afterEach(() => {
    subsCount = 0;
  });

  it("correctly binds to attributes and children", () => {
    const sigText = signal("Lorem Ipsum dolor sit amet");
    const sigClass = signal("foo bar");

    const d = (
      <div class={sigClass}>
        <span>{sigText}</span>
      </div>
    );

    expect(d.outerHTML).toEqual(
      "<div class=\"foo bar\"><span>Lorem Ipsum dolor sit amet</span></div>",
    );

    sigText.value = "Hello World!";
    sigClass.value = "baz qux";

    expect(d.outerHTML).toEqual(
      "<div class=\"baz qux\"><span>Hello World!</span></div>",
    );
  });

  it("correctly binds to multiple consecutive children", () => {
    const text1 = signal("Lorem Ipsum dolor sit amet,");
    const text2 = signal("consectetur adipiscing elit.");
    const text3 = signal("Praesent at molestie erat.");

    const d = (
      <span>
        {text1} {text2} {text3}
      </span>
    );

    expect(d.outerHTML).toEqual(
      "<span>Lorem Ipsum dolor sit amet, consectetur adipiscing elit. Praesent at molestie erat.</span>",
    );

    text1.value = "Hello";

    expect(d.outerHTML).toEqual(
      "<span>Hello consectetur adipiscing elit. Praesent at molestie erat.</span>",
    );

    text2.value = "World!";

    expect(d.outerHTML).toEqual(
      "<span>Hello World! Praesent at molestie erat.</span>",
    );
  });

  it("should detach the listener after the element was garbage collected", async () => {
    const text = signal("Lorem Ipsum dolor sit amet");
    const id = signal("foo");
    let d: JSX.Element | null = <div id={id}>{text}</div>;

    expect(subsCount).toEqual(2);

    d = null;
    await gc();

    // Listener won't be removed until the next dispatch
    text.value = "";
    id.value = "";

    expect(subsCount).toEqual(0);
  });

  it("correctly handles signal children with JSX.Elements", () => {
    const s = signal(0);
    const d = computed(() => {
      switch (s.value) {
        case 0:
          return "hello world";
        case 1:
          return <span>Hello World!</span>;
        case 2:
          return (
            <div>
              <input class={s.value} />
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

    s.value = 1;

    expect(html.outerHTML).toEqual(
      "<body><span>Hello World!</span></body>",
    );

    s.value = 0;

    expect(html.outerHTML).toEqual(
      "<body>hello world</body>",
    );

    s.value = 2;

    expect(html.outerHTML).toEqual(
      "<body><div><input class=\"2\"></div></body>",
    );

    s.value = 3;

    expect(html.outerHTML).toEqual(
      "<body><p>No match</p></body>",
    );
  });

  it("correctly binds to properties", () => {
    const elem1 = <input value={"hello"} /> as HTMLInputElement;
    expect(elem1.value).toEqual("hello");

    const sigValue = signal("world");
    const elem2 = <input value={sigValue} /> as HTMLInputElement;
    expect(elem2.value).toEqual("world");

    sigValue.value = "foo";
    expect(elem2.value).toEqual("foo");
  });

  it("correctly binds an array of Elements", () => {
    const s = signal(["foo", "bar", "baz"]);

    const elem = (
      <div>
        <p>Before</p>
        {computed(() => s.value.map((v) => <span>{v}</span>))}
        <p>After</p>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>foo</span><span>bar</span><span>baz</span><p>After</p></div>",
    );

    s.value = ["qux", "coorge", "foo", "bar", "baz"];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>qux</span><span>coorge</span><span>foo</span><span>bar</span><span>baz</span><p>After</p></div>",
    );

    s.value = ["qux", "coorge", "bar", "baz"];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>qux</span><span>coorge</span><span>bar</span><span>baz</span><p>After</p></div>",
    );

    s.value = ["bar", "qux", "baz", "coorge"];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>bar</span><span>qux</span><span>baz</span><span>coorge</span><p>After</p></div>",
    );

    s.value = [];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><p>After</p></div>",
    );

    s.value = ["foo", "bar", "baz"];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>foo</span><span>bar</span><span>baz</span><p>After</p></div>",
    );
  });

  it("correctly handles when switching between an Element and an array", () => {
    const s = signal<Text | Element | Array<Text | Element> | undefined>(
      undefined,
    );

    const elem = (
      <div>
        <p>Before</p>
        {s}
        <p>After</p>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><p>After</p></div>",
    );

    s.value = document.createTextNode("Hello World");

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p>Hello World<p>After</p></div>",
    );

    s.value = [document.createTextNode("Bye"), <span>I am free now</span>];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p>Bye<span>I am free now</span><p>After</p></div>",
    );

    s.value = document.createTextNode("Hello again");

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p>Hello again<p>After</p></div>",
    );

    s.value = [document.createTextNode("1"), document.createTextNode("2")];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p>12<p>After</p></div>",
    );

    s.value = undefined;

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><p>After</p></div>",
    );

    s.value = [
      <div />,
      <h1 />,
      document.createTextNode("1"),
      document.createTextNode("2"),
      <br />,
    ];

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><div></div><h1></h1>12<br><p>After</p></div>",
    );

    s.value = <span>Foo bar baz</span>;

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><span>Foo bar baz</span><p>After</p></div>",
    );

    s.value = undefined;

    expect(elem.outerHTML).toEqual(
      "<div><p>Before</p><p>After</p></div>",
    );
  });

  it("should keep a reference to the bound signal", async () => {
    const source = signal(0);

    let elem: Element | null = (
      <div data-test={computed(() => source.value + 5)}>
        {computed(() =>
          String(source.value * 2)
        )}
      </div>
    );

    expect(elem!.outerHTML).toEqual("<div data-test=\"5\">0</div>");

    source.value = 1;
    expect(elem!.outerHTML).toEqual("<div data-test=\"6\">2</div>");

    // the derived signals should not get collected
    await gc();
    await gc();

    source.value = 3;
    expect(elem!.outerHTML).toEqual("<div data-test=\"8\">6</div>");

    await gc();
    await gc();

    source.value = 5;
    expect(elem!.outerHTML).toEqual("<div data-test=\"10\">10</div>");
  });

  describe("for class name", () => {
    describe("arrays", () => {
      it("correctly handles string arrays", () => {
        const elem = (
          <div class={["foo", null, "bar", false, "baz", undefined, 0]} />
        );
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz 0\"></div>");
      });

      it("correctly handles signal of array", () => {
        const cnameSig = signal([
          "foo",
          null,
          "bar",
          false,
          "baz",
          undefined,
          0,
          true,
        ]);
        const elem = <div class={cnameSig} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz 0\"></div>");

        cnameSig.value = ["bar", "qux", null, "true", true];
        expect(elem.outerHTML).toEqual("<div class=\"bar qux true\"></div>");
      });

      it("correctly handles array with signals", () => {
        const cname1 = signal<ClassName>("foo");
        const cname2 = signal<ClassName>("baz");
        const elem = <div class={[cname1, "bar", cname2, null, "qux"]} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar baz qux\"></div>");

        cname1.value = "oof";
        expect(elem.outerHTML).toEqual("<div class=\"bar baz qux oof\"></div>");

        cname2.value = false;
        expect(elem.outerHTML).toEqual("<div class=\"bar qux oof\"></div>");

        cname2.value = "zab";
        expect(elem.outerHTML).toEqual("<div class=\"bar qux oof zab\"></div>");
      });

      it("correctly handles array elements containing multiple class names in one string", () => {
        const s = signal("foo bar baz");
        const elem = <div class={[s, "qux coorge"]} />;
        expect(elem.outerHTML).toEqual(
          "<div class=\"foo bar baz qux coorge\"></div>",
        );

        s.value = "bar baz";
        expect(elem.outerHTML).toEqual(
          "<div class=\"qux coorge bar baz\"></div>",
        );

        s.value = "bar";
        expect(elem.outerHTML).toEqual("<div class=\"qux coorge bar\"></div>");

        s.value = "foo baz";
        expect(elem.outerHTML).toEqual(
          "<div class=\"qux coorge foo baz\"></div>",
        );

        const s2 = signal(["foo bar baz"]);
        const elem2 = <div class={s2} />;
        expect(elem2.outerHTML).toEqual("<div class=\"foo bar baz\"></div>");

        s2.value = ["bar baz"];
        expect(elem2.outerHTML).toEqual("<div class=\"bar baz\"></div>");

        s2.value = ["bar"];
        expect(elem2.outerHTML).toEqual("<div class=\"bar\"></div>");

        s2.value = ["foo baz"];
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
        const cnameSig = signal<Record<string, any>>({
          foo: true,
          bar: false,
          baz: 1,
          qux: 0,
          coorg: "lol",
          lol: "",
        });
        const elem = <div class={cnameSig} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo baz coorg\"></div>");

        cnameSig.value = {
          foo: true,
          bar: false,
          baz: 0,
          qux: 1,
          coorg: "lol",
          lol: "",
        };
        expect(elem.outerHTML).toEqual("<div class=\"foo qux coorg\"></div>");

        cnameSig.value = {
          bar: true,
          qux: 1,
          lol: true,
        };
        expect(elem.outerHTML).toEqual("<div class=\"bar qux lol\"></div>");

        cnameSig.value = {
          bar: true,
          qux: false,
          lol: true,
        };
        expect(elem.outerHTML).toEqual("<div class=\"bar lol\"></div>");

        cnameSig.value = {
          foobar: true,
          bar: true,
          lol: true,
        };
        expect(elem.outerHTML).toEqual("<div class=\"foobar bar lol\"></div>");

        cnameSig.value = {};
        expect(elem.outerHTML).toEqual("<div class=\"\"></div>");

        cnameSig.value = {
          foo: false,
          bar: true,
        };
        expect(elem.outerHTML).toEqual("<div class=\"bar\"></div>");
      });

      it("correctly handles record with signals", () => {
        const cnames = {
          foo: true,
          bar: signal<any>(false),
          baz: signal<any>(1),
          qux: signal<any>(0),
          coorg: 0,
        };
        const elem = <div class={cnames} />;
        expect(elem.outerHTML).toEqual("<div class=\"foo baz\"></div>");

        cnames.bar.value = true;
        expect(elem.outerHTML).toEqual("<div class=\"foo baz bar\"></div>");

        cnames.baz.value = 0;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar\"></div>");

        cnames.qux.value = 1;
        expect(elem.outerHTML).toEqual("<div class=\"foo bar qux\"></div>");

        cnames.baz.value = "yes";
        expect(elem.outerHTML).toEqual("<div class=\"foo bar qux baz\"></div>");
      });
    });
  });
});
