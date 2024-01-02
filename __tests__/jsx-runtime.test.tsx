import { describe, expect, it } from "@jest/globals";
import { sig } from "../src";
import { jsx } from "../src/jsx-runtime";

describe("jsx-runtime", () => {
  it("creates a div element", () => {
    const d = <div />;

    expect(d.outerHTML).toEqual("<div></div>");
  });

  it("creates a div element with a child", () => {
    const d = (
      <div>
        <span>Hello World!</span>
      </div>
    );

    expect(d.outerHTML).toEqual("<div><span>Hello World!</span></div>");
  });

  it("creates a div element with a child and an attribute", () => {
    const d = (
      <div id="root" class="foo bar">
        <span class="text">Hello World!</span>
      </div>
    );

    expect(d.outerHTML).toEqual(
      "<div id=\"root\" class=\"foo bar\"><span class=\"text\">Hello World!</span></div>",
    );
  });

  it("correctly handles children arrays", () => {
    const nums = Array(6).fill(0).map((_, i) => i);
    const d = (
      <div>
        <span>Hello</span>
        <span>World</span>
        {nums.map((n) => <span>{n}</span>)}
      </div>
    );

    expect(d.outerHTML).toEqual(
      "<div><span>Hello</span><span>World</span><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>",
    );
  });

  it("signals correctly update the content of the element", () => {
    const sig1 = sig("Hello World!");
    const sig2 = sig("bar baz");

    const d = (
      <div>
        <span>{sig1}</span>
        <span>foo {sig2} qux</span>
      </div>
    );

    expect(d.outerHTML).toEqual("<div><span>Hello World!</span><span>foo bar baz qux</span></div>");

    sig1.dispatch("Goodbye World!");

    expect(d.outerHTML).toEqual("<div><span>Goodbye World!</span><span>foo bar baz qux</span></div>");

    sig2.dispatch("...");

    expect(d.outerHTML).toEqual("<div><span>Goodbye World!</span><span>foo ... qux</span></div>");
  });

  it("signals correctly update the element attributes", () => {
    const classNames = sig("foo bar");
    const id = sig<string | undefined>("root");

    const d = (
      <div class={classNames} id={id}>
        <p>Hi</p>
      </div>
    );

    expect(d.outerHTML).toEqual("<div class=\"foo bar\" id=\"root\"><p>Hi</p></div>");

    classNames.dispatch("bar baz");

    expect(d.outerHTML).toEqual("<div class=\"bar baz\" id=\"root\"><p>Hi</p></div>");

    id.dispatch(undefined);

    expect(d.outerHTML).toEqual("<div class=\"bar baz\"><p>Hi</p></div>");

    id.dispatch("main");

    expect(d.outerHTML).toEqual("<div class=\"bar baz\" id=\"main\"><p>Hi</p></div>");
  });

  it("correctly handles functional components", () => {
    const Layout = ({ children }: JSX.PropsWithChildren) => {
      return (
        <html>
          <head>
            <title>Test</title>
          </head>
          <body>
            <div id="root">
              {children}
            </div>
          </body>
        </html>
      );
    };

    const Header = ({ text }: { text: string }) => {
      return <h1 class="header">{text}</h1>;
    };

    const d = (
      <Layout>
        <Header text="Hello World!" />
      </Layout>
    );

    expect(d.outerHTML).toEqual(
      "<html><head><title>Test</title></head><body><div id=\"root\"><h1 class=\"header\">Hello World!</h1></div></body></html>",
    );
  });
});
