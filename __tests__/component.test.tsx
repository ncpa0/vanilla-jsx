import { describe, expect, it } from "vitest";
import { $component, If } from "../src";
import { Fragment, jsx } from "../src/jsx-runtime";
import { sig } from "../src/signals";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("component", () => {
  it("renders component", () => {
    const TestComp = $component(() => {
      return <div class="$comp" />;
    });

    const elem = (
      <div>
        <TestComp />
      </div>
    );

    window.document.body.appendChild(elem);

    expect(
      elem.outerHTML,
    ).toMatchInlineSnapshot(
      /*html*/ `"<div><vjsx-component-node style="display: contents;"><div class="$comp"></div></vjsx-component-node></div>"`,
    );
  });

  it("fires mount handlers when element is connected", () => {
    let mountCount = 0;
    let cleanupCount = 0;

    const TestComp = $component((_, api) => {
      api.onMount(() => {
        mountCount++;
        return (() => {
          cleanupCount++;
        });
      });

      return <div />;
    });

    const s = sig(true);

    const elem = (
      <div>
        <If
          condition={s}
          then={() => <TestComp />}
          else={() => <></>}
        />
      </div>
    );

    expect(mountCount).toBe(0);
    expect(cleanupCount).toBe(0);

    window.document.body.appendChild(elem);

    expect(mountCount).toBe(1);
    expect(cleanupCount).toBe(0);

    s.dispatch(false);

    expect(mountCount).toBe(1);
    expect(cleanupCount).toBe(1);

    s.dispatch(true);

    expect(mountCount).toBe(2);
    expect(cleanupCount).toBe(1);
  });

  it("fires unmount handlers when element is disconnected", () => {
    let unmountCount = 0;

    const TestComp = $component((_, api) => {
      api.onUnmount(() => {
        unmountCount++;
      });

      return <div />;
    });

    const s = sig(true);

    const elem = (
      <div>
        <If
          condition={s}
          then={() => <TestComp />}
          else={() => <></>}
        />
      </div>
    );

    expect(unmountCount).toBe(0);

    window.document.body.appendChild(elem);

    expect(unmountCount).toBe(0);

    s.dispatch(false);

    expect(unmountCount).toBe(1);

    s.dispatch(true);

    expect(unmountCount).toBe(1);

    s.dispatch(false);

    expect(unmountCount).toBe(2);
  });

  it("fires change handlers when any signal dependency changes", async () => {
    let changeCount = 0;

    const s1 = sig(0);
    const s2 = sig("");
    const s3 = sig({});

    const TestComp = $component((_, api) => {
      api.onChange(() => {
        changeCount++;
      }, [s1, s2, s3]);

      return <div />;
    });

    const elem = (
      <div>
        <TestComp />
      </div>
    );

    // elem is not yet connected
    await sleep(0);
    expect(changeCount).toBe(0);

    window.document.body.appendChild(elem);

    // elem is now connected
    await sleep(0);
    expect(changeCount).toBe(1);

    s2.dispatch("hello");
    await sleep(0);

    expect(changeCount).toBe(2);

    s1.dispatch(1);
    s2.dispatch("world");
    await sleep(0);

    expect(changeCount).toBe(3);

    s1.dispatch(100);
    s2.dispatch("foobarbaz");
    s3.dispatch({ foo: "bar" });
    await sleep(0);

    expect(changeCount).toBe(4);
  });

  it("does not fire change handlers after the element was disconnected", async () => {
    let changeCount = 0;

    const s1 = sig(0);
    const s2 = sig("");

    const TestComp = $component((_, api) => {
      api.onChange(() => {
        changeCount++;
      }, [s1, s2]);

      return <div />;
    });

    const elem = (
      <div>
        <TestComp />
      </div>
    );

    window.document.body.appendChild(elem);

    await sleep(0);
    expect(changeCount).toBe(1);

    window.document.body.removeChild(elem);

    s1.dispatch(1);
    s2.dispatch("world");
    await sleep(0);

    expect(changeCount).toBe(1);
  });

  it("fires change handlers after the element was reconnected", async () => {
    let changeCount = 0;

    const s1 = sig(0);
    const s2 = sig("");

    const TestComp = $component((_, api) => {
      api.onChange(() => {
        changeCount++;
      }, [s1, s2]);

      return <div />;
    });

    const elem = (
      <div>
        <TestComp />
      </div>
    );

    window.document.body.appendChild(elem);
    await sleep(0);
    window.document.body.removeChild(elem);
    await sleep(0);

    changeCount = 0;
    window.document.body.appendChild(elem);

    await sleep(0);
    expect(changeCount).toBe(1);

    s1.dispatch(1);
    s2.dispatch("world");
    await sleep(0);
    expect(changeCount).toBe(2);
  });
});
