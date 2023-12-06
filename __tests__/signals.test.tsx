import { describe, expect, it } from "@jest/globals";
import { disconnectElement } from "../src";
import { jsx } from "../src/jsx-runtime";

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

describe("signals", () => {
  it("correctly binds to attributes and children", () => {
    const sigText = new Signal("Lorem Ipsum dolor sit amet");
    const sigClass = new Signal("foo bar");

    const d = (
      <div class={sigClass}>
        <span>{sigText}</span>
      </div>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<div class=\"foo bar\"><span>Lorem Ipsum dolor sit amet</span></div>",
    );

    sigText.dispatch("Hello World!");
    sigClass.dispatch("baz qux");

    expect(d.outerHTML).toEqual(
      "<div class=\"baz qux\"><span>Hello World!</span></div>",
    );
  });

  it("correctly unbinds from the element tree when disconnect is called", () => {
    const sigText = new Signal("Lorem Ipsum dolor sit amet");
    const sigClass = new Signal("foo bar");

    const d = (
      <body>
        <div class={sigClass}>
          <span>{sigText}</span>
        </div>
      </body>
    ) as HTMLDivElement;

    expect(d.outerHTML).toEqual(
      "<body><div class=\"foo bar\"><span>Lorem Ipsum dolor sit amet</span></div></body>",
    );

    disconnectElement(d);

    sigText.dispatch("Hello World!");
    sigClass.dispatch("baz qux");

    expect(d.outerHTML).toEqual(
      "<body><div class=\"foo bar\"><span>Lorem Ipsum dolor sit amet</span></div></body>",
    );
  });

  it("doesn't unbind from outside the element", () => {
    const sigText = new Signal("Lorem Ipsum dolor sit amet");
    const sigClass = new Signal("foo bar");

    const elem1 = (
      <span class={sigClass}>
        <h2>{sigText}</h2>
      </span>
    );

    const sigContainerClass = new Signal("container");
    const sigHeader = new Signal("Title");

    const container = (
      <div class={sigContainerClass}>
        <div>
          <h1>{sigHeader}</h1>
        </div>
        <div class="main">
          {elem1}
        </div>
      </div>
    ) as HTMLDivElement;

    expect(container.outerHTML).toEqual(
      "<div class=\"container\"><div><h1>Title</h1></div><div class=\"main\"><span class=\"foo bar\"><h2>Lorem Ipsum dolor sit amet</h2></span></div></div>",
    );

    sigText.dispatch("Hello World!");
    sigClass.dispatch("baz qux");
    sigContainerClass.dispatch("container-fluid");
    sigHeader.dispatch("Other Title");

    expect(container.outerHTML).toEqual(
      "<div class=\"container-fluid\"><div><h1>Other Title</h1></div><div class=\"main\"><span class=\"baz qux\"><h2>Hello World!</h2></span></div></div>",
    );

    disconnectElement(elem1);

    sigText.dispatch("Lorem Ipsum dolor sit amet");
    sigClass.dispatch("do not change");
    sigContainerClass.dispatch("block");
    sigHeader.dispatch("Boba");

    expect(container.outerHTML).toEqual(
      "<div class=\"block\"><div><h1>Boba</h1></div><div class=\"main\"><span class=\"baz qux\"><h2>Hello World!</h2></span></div></div>",
    );
  });
});
