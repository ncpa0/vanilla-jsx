import { describe, expect, it } from "vitest";
import { Case, Switch } from "../../src";
// @ts-ignore
import { Fragment, jsx } from "../../src/jsx-runtime";
import { sig } from "../../src/signals";

describe("Switch", () => {
  it("renders the first matching render", () => {
    const s = sig<"foo" | "bar" | "baz">("foo");

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={"foo"}>
            {() => <span id="foo">Foo</span>}
          </Case>
          <Case match={"bar"}>
            {() => <span id="bar">Bar</span>}
          </Case>
          <Case match={"baz"}>
            {() => <span id="baz">Baz</span>}
          </Case>
          <Case match={"foo"}>
            {() => <span>Should never render</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"foo\">Foo</span></div></div>",
    );

    s.dispatch("bar");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"bar\">Bar</span></div></div>",
    );

    s.dispatch("baz");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"baz\">Baz</span></div></div>",
    );
  });

  it("should render the default case if no match is found", () => {
    const s = sig<0 | 1 | 2 | 3>(0);

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={0}>
            {() => <span id="0">0</span>}
          </Case>
          <Case match={1}>
            {() => <span id="1">1</span>}
          </Case>
          <Case match={2}>
            {() => <span id="2">2</span>}
          </Case>
          <Case default>
            {() => <span id="default">Default</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"0\">0</span></div></div>",
    );

    s.dispatch(1);

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"1\">1</span></div></div>",
    );

    s.dispatch(2);

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"2\">2</span></div></div>",
    );

    s.dispatch(3);

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"default\">Default</span></div></div>",
    );
  });

  it("should correctly resolve function matchers", () => {
    const s = sig("foo");

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={(v: string) => v.length <= 3}>
            {() => <span>Short String</span>}
          </Case>
          <Case match={(v: string) => v.length <= 9}>
            {() => <span>Medium String</span>}
          </Case>
          <Case match={(v: string) => v.length <= 12}>
            {() => <span>Long String</span>}
          </Case>
          <Case default>
            {() => <span>Very Long String</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span>Short String</span></div></div>",
    );

    s.dispatch("foobar");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span>Medium String</span></div></div>",
    );

    s.dispatch("foobarbazqux");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span>Long String</span></div></div>",
    );

    s.dispatch("foobarbazquxcoorge");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span>Very Long String</span></div></div>",
    );
  });

  it("should not let a default case declared before the matchers shadow them", () => {
    const s = sig<"foo" | "bar" | "qux">("foo");

    const elem = (
      <div>
        <Switch value={s}>
          <Case default>
            {() => <span id="default">Default</span>}
          </Case>
          <Case match={"foo"}>
            {() => <span id="foo">Foo</span>}
          </Case>
          <Case match={"bar"}>
            {() => <span id="bar">Bar</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"foo\">Foo</span></div></div>",
    );

    s.dispatch("bar");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"bar\">Bar</span></div></div>",
    );

    s.dispatch("qux");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"default\">Default</span></div></div>",
    );
  });

  it("should find matchers declared after a default case placed in the middle", () => {
    const s = sig<0 | 1 | 2>(0);

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={0}>
            {() => <span id="0">0</span>}
          </Case>
          <Case default>
            {() => <span id="default">Default</span>}
          </Case>
          <Case match={1}>
            {() => <span id="1">1</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"0\">0</span></div></div>",
    );

    s.dispatch(1);

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"1\">1</span></div></div>",
    );

    s.dispatch(2);

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"default\">Default</span></div></div>",
    );
  });

  it("should use the last declared default case when multiple defaults are present", () => {
    const s = sig<"foo" | "qux">("foo");

    const elem = (
      <div>
        <Switch value={s}>
          <Case default>
            {() => <span id="default-1">Default 1</span>}
          </Case>
          <Case match={"foo"}>
            {() => <span id="foo">Foo</span>}
          </Case>
          <Case default>
            {() => <span id="default-2">Default 2</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"foo\">Foo</span></div></div>",
    );

    s.dispatch("qux");

    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"default-2\">Default 2</span></div></div>",
    );
  });

  it("should re-render non-memoized case children on every match", () => {
    const s = sig<"a" | "b">("a");
    let renderCount = 0;

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={"a"}>
            {() => {
              renderCount++;
              return <span id="a">A</span>;
            }}
          </Case>
          <Case match={"b"}>
            {() => <span id="b">B</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"a\">A</span></div></div>",
    );

    s.dispatch("b");

    expect(renderCount).toEqual(1);

    s.dispatch("a");

    expect(renderCount).toEqual(2);

    s.dispatch("b");
    s.dispatch("a");

    expect(renderCount).toEqual(3);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"a\">A</span></div></div>",
    );
  });

  it("should render memoized case children only once", () => {
    const s = sig<"a" | "b">("a");
    let renderCount = 0;
    let renderedElem: Element | undefined;

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={"a"} memo>
            {() => {
              renderCount++;
              renderedElem = <span id="a">A</span>;
              return renderedElem;
            }}
          </Case>
          <Case match={"b"}>
            {() => <span id="b">B</span>}
          </Case>
        </Switch>
      </div>
    );

    const container = elem.querySelector(".vjsx-switch-container")!;

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"a\">A</span></div></div>",
    );

    s.dispatch("b");

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"b\">B</span></div></div>",
    );

    s.dispatch("a");

    // the children should not have been re-rendered
    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"a\">A</span></div></div>",
    );
    // and the previously rendered element should be reused in the DOM
    expect(container.firstElementChild).toBe(renderedElem);

    s.dispatch("b");
    s.dispatch("a");

    expect(renderCount).toEqual(1);
    expect(container.firstElementChild).toBe(renderedElem);
  });

  it("should memoize each case independently", () => {
    const s = sig<"a" | "b" | "c">("a");
    const renderCounts = { a: 0, b: 0, c: 0 };

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={"a"} memo>
            {() => {
              renderCounts.a++;
              return <span id="a">A</span>;
            }}
          </Case>
          <Case match={"b"} memo>
            {() => {
              renderCounts.b++;
              return <span id="b">B</span>;
            }}
          </Case>
          <Case match={"c"}>
            {() => {
              renderCounts.c++;
              return <span id="c">C</span>;
            }}
          </Case>
        </Switch>
      </div>
    );

    expect(renderCounts).toEqual({ a: 1, b: 0, c: 0 });

    s.dispatch("b");
    expect(renderCounts).toEqual({ a: 1, b: 1, c: 0 });

    s.dispatch("c");
    expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });

    // re-matching memoized cases should not re-render them
    s.dispatch("a");
    expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });

    s.dispatch("b");
    expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });

    s.dispatch("a");
    expect(renderCounts).toEqual({ a: 1, b: 1, c: 1 });

    // the non-memoized case re-renders on every match
    s.dispatch("c");
    expect(renderCounts).toEqual({ a: 1, b: 1, c: 2 });
  });

  it("should never render memoized case children that never match", () => {
    const s = sig<"a" | "b">("a");
    let renderCount = 0;

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={"a"} memo>
            {() => <span id="a">A</span>}
          </Case>
          <Case match={"b"} memo>
            {() => {
              renderCount++;
              return <span id="b">B</span>;
            }}
          </Case>
        </Switch>
      </div>
    );

    expect(renderCount).toEqual(0);

    s.dispatch("b");

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"b\">B</span></div></div>",
    );
  });

  it("should reuse the first rendered result of a memoized case even when a different value matches", () => {
    const s = sig("abc");
    let renderCount = 0;

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={(v: string) => v.length <= 3} memo>
            {() => {
              renderCount++;
              return <span id="short">{s.get()}</span>;
            }}
          </Case>
          <Case default>
            {() => <span id="long">Long</span>}
          </Case>
        </Switch>
      </div>
    );

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"short\">abc</span></div></div>",
    );

    // a different value, that still matches the same case, should not
    // trigger a re-render of the memoized case children
    s.dispatch("xyz");

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"short\">abc</span></div></div>",
    );

    // leaving the case and coming back should also reuse the memoized result
    s.dispatch("toolong");

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"long\">Long</span></div></div>",
    );

    s.dispatch("abc");

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"short\">abc</span></div></div>",
    );
  });

  it("should render memoized default case children only once", () => {
    const s = sig<0 | 1 | 2>(0);
    let renderCount = 0;

    const elem = (
      <div>
        <Switch value={s}>
          <Case match={0}>
            {() => <span id="0">0</span>}
          </Case>
          <Case default memo>
            {() => {
              renderCount++;
              return <span id="default">Default</span>;
            }}
          </Case>
        </Switch>
      </div>
    );

    expect(renderCount).toEqual(0);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"0\">0</span></div></div>",
    );

    s.dispatch(1);

    expect(renderCount).toEqual(1);

    s.dispatch(2);
    s.dispatch(1);

    expect(renderCount).toEqual(1);
    expect(elem.outerHTML).toEqual(
      "<div><div class=\"vjsx-switch-container\"><span id=\"default\">Default</span></div></div>",
    );
  });
});
