import { describe, expect, it } from "vitest";
import { Range } from "../../src";
import { Fragment, jsx } from "../../src/jsx-runtime";
import { sig } from "../../src/signals";

describe("Map", () => {
  it("renders elements", () => {
    const s = sig(["foo", "bar", "baz", "qux"]);

    const d = (
      <div>
        <Range
          data={s}
          into={<ul id="list" />}
        >
          {(elem) => {
            return <li>Element: {elem}</li>;
          }}
        </Range>
      </div>
    );

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );
  });

  it("re-renders elements that changed", () => {
    const s = sig(["foo", "bar", "baz", "qux"]);

    const d = (
      <div>
        <Range
          data={s}
          into={<ul id="list" />}
        >
          {(elem) => {
            return <li>Element: {elem}</li>;
          }}
        </Range>
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    s.dispatch(["oof", "bar", "baz", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: oof</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    s.dispatch(["oof", "rab", "baz", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: oof</li><li>Element: rab</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    s.dispatch(["oof", "rab", "zab", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: oof</li><li>Element: rab</li><li>Element: zab</li><li>Element: qux</li></ul></div>",
    );

    s.dispatch(["oof", "rab", "zab", "xuq"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: oof</li><li>Element: rab</li><li>Element: zab</li><li>Element: xuq</li></ul></div>",
    );
  });

  it("removes elements that are no longer in", () => {
    const s = sig(["foo", "bar", "baz", "qux", "coorg"]);

    const d = (
      <div>
        <Range
          data={s}
          into={<ul id="list" />}
        >
          {(elem) => {
            return <li>Element: {elem}</li>;
          }}
        </Range>
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li><li>Element: coorg</li></ul></div>",
    );

    s.dispatch(["bar", "baz", "qux", "coorg"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li><li>Element: coorg</li></ul></div>",
    );

    s.dispatch(["bar", "baz", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    s.dispatch(["bar", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: bar</li><li>Element: qux</li></ul></div>",
    );

    s.dispatch(["qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: qux</li></ul></div>",
    );

    s.dispatch([]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"></ul></div>",
    );
  });

  it("renders new added elements", () => {
    const s = sig(["foo", "bar", "baz", "qux", "corge"]);

    const d = (
      <div>
        <Range
          data={s}
          into={<ul id="list" />}
        >
          {(elem) => {
            return <li>Element: {elem}</li>;
          }}
        </Range>
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li></ul></div>",
    );

    s.dispatch(["foo", "bar", "123", "baz", "qux", "corge"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: bar</li><li>Element: 123</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li></ul></div>",
    );

    s.dispatch(["010101", "foo", "bar", "123", "baz", "qux", "corge"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: 010101</li><li>Element: foo</li><li>Element: bar</li><li>Element: 123</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li></ul></div>",
    );

    s.dispatch(["010101", "foo", "bar", "123", "baz", "qux", "corge", "...."]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: 010101</li><li>Element: foo</li><li>Element: bar</li><li>Element: 123</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li><li>Element: ....</li></ul></div>",
    );
  });

  describe("complex scenario", () => {
    it("scenario 1", () => {
      const initVal = [1, 2, 3, 4, 5, 6];
      const s = sig(initVal);

      const d = (
        <div>
          <Range
            data={s}
            into={<ul id="list" />}
          >
            {(elem) => {
              return <li>{elem}</li>;
            }}
          </Range>
        </div>
      ) as HTMLDivElement;

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li></ul></div>",
      );

      s.dispatch(initVal.slice().sort((a, b) => b - a));

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>6</li><li>5</li><li>4</li><li>3</li><li>2</li><li>1</li></ul></div>",
      );

      s.dispatch(
        initVal.slice().sort((a, b) => {
          if (a % 2 === 0 && b % 2 === 0) {
            return 0;
          } else if (a % 2 === 0) {
            return 1;
          }
          return -1;
        }),
      );

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>5</li><li>3</li><li>1</li><li>2</li><li>4</li><li>6</li></ul></div>",
      );
    });

    it("scenario 2", () => {
      const s = sig(["aaa", "bbb", "ccc", "ddd", "eee", "fff"]);

      const d = (
        <Range
          data={s}
        >
          {v => <p>{v}</p>}
        </Range>
      ) as HTMLDivElement;

      expect(d.outerHTML).toEqual(
        "<div class=\"vjsx-range-container\"><p>aaa</p><p>bbb</p><p>ccc</p><p>ddd</p><p>eee</p><p>fff</p></div>",
      );

      s.dispatch(["aaa", "bbb", "ddd", "eee", "fff", "ccc"]);

      expect(d.outerHTML).toEqual(
        "<div class=\"vjsx-range-container\"><p>aaa</p><p>bbb</p><p>ddd</p><p>eee</p><p>fff</p><p>ccc</p></div>",
      );

      s.dispatch(["ccc", "aaa", "bbb", "ddd", "eee", "fff"]);

      expect(d.outerHTML).toEqual(
        "<div class=\"vjsx-range-container\"><p>ccc</p><p>aaa</p><p>bbb</p><p>ddd</p><p>eee</p><p>fff</p></div>",
      );
    });
  });

  describe("signal with array of signals", () => {
    it("renders elements", () => {
      const s = sig([
        sig("foo"),
        sig("bar"),
        sig("baz"),
        sig("qux"),
      ]);

      const d = (
        <div>
          <Range
            data={s}
            into={<ul id="list" />}
          >
            {(elem) => {
              return <li>Element: {elem}</li>;
            }}
          </Range>
        </div>
      );

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
      );

      s.get()[1]!.dispatch("Hello");

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: foo</li><li>Element: Hello</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
      );

      s.dispatch(current => {
        return current.slice().reverse();
      });

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: qux</li><li>Element: baz</li><li>Element: Hello</li><li>Element: foo</li></ul></div>",
      );

      s.get()[3]!.dispatch("World");

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\" class=\"vjsx-range-container\"><li>Element: qux</li><li>Element: baz</li><li>Element: Hello</li><li>Element: World</li></ul></div>",
      );
    });
  });
});
