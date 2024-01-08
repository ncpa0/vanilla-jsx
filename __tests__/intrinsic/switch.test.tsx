import { setFlagsFromString } from "v8";
import { describe, expect, it } from "vitest";
import { runInNewContext } from "vm";
import { sig, Switch } from "../../src";
import { Fragment, jsx } from "../../src/jsx-runtime";

setFlagsFromString("--expose_gc");
const rawGC = runInNewContext("gc");
async function gc() {
  await new Promise((resolve) => setTimeout(resolve, 0));
  rawGC();
}

describe("Switch", () => {
  it("renders the first matching render", () => {
    const s = sig<"foo" | "bar" | "baz">("foo");

    const elem = (
      <div>
        <Switch
          value={s}
        >
          {cases =>
            cases
              .match("foo", () => <span id="foo">Foo</span>)
              .match("bar", () => <span id="bar">Bar</span>)
              .match("baz", () => <span id="baz">Baz</span>)
              .match("foo", () => <span>Should never render</span>)}
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span id=\"foo\">Foo</span></div></div>");

    s.dispatch("bar");

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span id=\"bar\">Bar</span></div></div>");

    s.dispatch("baz");

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span id=\"baz\">Baz</span></div></div>");
  });

  it("should render the default case if no match is found", () => {
    const s = sig<0 | 1 | 2 | 3>(0);

    const elem = (
      <div>
        <Switch
          value={s}
        >
          {cases =>
            cases
              .match(0, () => <span id="0">0</span>)
              .match(1, () => <span id="1">1</span>)
              .match(2, () => <span id="2">2</span>)
              .default(() => <span id="default">Default</span>)}
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span id=\"0\">0</span></div></div>");

    s.dispatch(1);

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span id=\"1\">1</span></div></div>");

    s.dispatch(2);

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span id=\"2\">2</span></div></div>");

    s.dispatch(3);

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"default\">Default</span></div></div>",
    );
  });

  it("should correctly resolve function matchers", () => {
    const s = sig("foo");

    const elem = (
      <div>
        <Switch
          value={s}
        >
          {cases =>
            cases
              .match(v => v.length <= 3, () => <span>Short String</span>)
              .match(v => v.length <= 9, () => <span>Medium String</span>)
              .match(v => v.length <= 12, () => <span>Long String</span>)
              .default(() => <span>Very Long String</span>)}
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span>Short String</span></div></div>");

    s.dispatch("foobar");

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span>Medium String</span></div></div>");

    s.dispatch("foobarbazqux");

    expect(elem.outerHTML).toEqual("<div><div class=\"vjsx-switch-container\"><span>Long String</span></div></div>");

    s.dispatch("foobarbazquxcoorge");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span>Very Long String</span></div></div>",
    );
  });
});
