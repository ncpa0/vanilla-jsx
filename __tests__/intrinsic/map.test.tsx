import { describe, expect, it } from "@jest/globals";
import { Map } from "../../src";
import { jsx } from "../../src/jsx-runtime";

class Signal<T> {
  private listeners: ((value: T) => void)[] = [];
  private value: T;

  constructor(value: T) {
    this.value = value;
  }

  public add(listener: (value: T) => void): { detach(): void } {
    this.listeners.push(listener);
    listener(this.value);

    return {
      detach: () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      },
    };
  }

  public dispatch(value: T): void {
    this.value = value;
    this.listeners.forEach((l) => l(value));
  }

  public getCurrent(): T {
    return this.value;
  }
}

describe("Map", () => {
  it("renders elements", () => {
    const sig = new Signal(["foo", "bar", "baz", "qux"]);

    const d = (
      <div>
        <Map
          data={sig}
          parent={<ul id="list" />}
          render={(elem) => {
            return <li>Element: {elem}</li> as Element;
          }}
        />
      </div>
    );

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );
  });

  it("re-renders elements that changed", () => {
    const sig = new Signal(["foo", "bar", "baz", "qux"]);

    const d = (
      <div>
        <Map
          data={sig}
          parent={<ul id="list" /> as Element}
          render={(elem) => {
            return <li>Element: {elem}</li> as Element;
          }}
        />
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    sig.dispatch(["oof", "bar", "baz", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: oof</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    sig.dispatch(["oof", "rab", "baz", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: oof</li><li>Element: rab</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    sig.dispatch(["oof", "rab", "zab", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: oof</li><li>Element: rab</li><li>Element: zab</li><li>Element: qux</li></ul></div>",
    );

    sig.dispatch(["oof", "rab", "zab", "xuq"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: oof</li><li>Element: rab</li><li>Element: zab</li><li>Element: xuq</li></ul></div>",
    );
  });

  it("removes elements that are no longer in", () => {
    const sig = new Signal(["foo", "bar", "baz", "qux", "coorg"]);

    const d = (
      <div>
        <Map
          data={sig}
          parent={<ul id="list" /> as Element}
          render={(elem) => {
            return <li>Element: {elem}</li> as Element;
          }}
        />
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li><li>Element: coorg</li></ul></div>",
    );

    sig.dispatch(["bar", "baz", "qux", "coorg"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li><li>Element: coorg</li></ul></div>",
    );

    sig.dispatch(["bar", "baz", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li></ul></div>",
    );

    sig.dispatch(["bar", "qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: bar</li><li>Element: qux</li></ul></div>",
    );

    sig.dispatch(["qux"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: qux</li></ul></div>",
    );

    sig.dispatch([]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"></ul></div>",
    );
  });

  it("renders new added elements", () => {
    const sig = new Signal(["foo", "bar", "baz", "qux", "corge"]);

    const d = (
      <div>
        <Map
          data={sig}
          parent={<ul id="list" /> as Element}
          render={(elem) => {
            return <li>Element: {elem}</li> as Element;
          }}
        />
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: foo</li><li>Element: bar</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li></ul></div>",
    );

    sig.dispatch(["foo", "bar", "123", "baz", "qux", "corge"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: foo</li><li>Element: bar</li><li>Element: 123</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li></ul></div>",
    );

    sig.dispatch(["010101", "foo", "bar", "123", "baz", "qux", "corge"]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: 010101</li><li>Element: foo</li><li>Element: bar</li><li>Element: 123</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li></ul></div>",
    );

    sig.dispatch(["010101", "foo", "bar", "123", "baz", "qux", "corge", "...."]);

    expect(d.outerHTML).toEqual(
      "<div><ul id=\"list\"><li>Element: 010101</li><li>Element: foo</li><li>Element: bar</li><li>Element: 123</li><li>Element: baz</li><li>Element: qux</li><li>Element: corge</li><li>Element: ....</li></ul></div>",
    );
  });

  describe("complex scenario", () => {
    it("scenario 1", () => {
      const initVal = [1, 2, 3, 4, 5, 6];
      const sig = new Signal(initVal);

      const d = (
        <div>
          <Map
            data={sig}
            parent={<ul id="list" /> as Element}
            render={(elem) => {
              return <li>{elem}</li> as Element;
            }}
          />
        </div>
      ) as HTMLDivElement;

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\"><li>1</li><li>2</li><li>3</li><li>4</li><li>5</li><li>6</li></ul></div>",
      );

      sig.dispatch(initVal.slice().sort((a, b) => b - a));

      expect(d.outerHTML).toEqual(
        "<div><ul id=\"list\"><li>6</li><li>5</li><li>4</li><li>3</li><li>2</li><li>1</li></ul></div>",
      );

      sig.dispatch(
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
        "<div><ul id=\"list\"><li>5</li><li>3</li><li>1</li><li>2</li><li>4</li><li>6</li></ul></div>",
      );
    });

    it("scenario 2", () => {
      const sig = new Signal(["aaa", "bbb", "ccc", "ddd", "eee", "fff"]);

      const d = (
        <Map
          data={sig}
          render={v => <p>{v}</p> as Element}
        >
        </Map>
      ) as HTMLDivElement;

      expect(d.outerHTML).toEqual(
        "<div><p>aaa</p><p>bbb</p><p>ccc</p><p>ddd</p><p>eee</p><p>fff</p></div>",
      );

      sig.dispatch(["aaa", "bbb", "ddd", "eee", "fff", "ccc"]);

      expect(d.outerHTML).toEqual(
        "<div><p>aaa</p><p>bbb</p><p>ddd</p><p>eee</p><p>fff</p><p>ccc</p></div>",
      );

      sig.dispatch(["ccc", "aaa", "bbb", "ddd", "eee", "fff"]);

      expect(d.outerHTML).toEqual(
        "<div><p>ccc</p><p>aaa</p><p>bbb</p><p>ddd</p><p>eee</p><p>fff</p></div>",
      );
    });
  });
});
