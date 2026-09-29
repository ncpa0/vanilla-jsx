import { describe, expect, it } from "vitest";
import { If } from "../../src/base-components/if";
import { Case, Switch } from "../../src/base-components/switch";
import { VirtualList } from "../../src/base-components/virtual-list/virtual-list";
import { sig } from "../../src/signals";
import { jsx } from "../../src/reconciler/reconciler";
import { sleep } from "../utils";

describe("VirtualList", () => {
  it("should render rows for the data signal and update them when the data changes", async () => {
    const data = sig<readonly string[]>(["a", "b", "c"]);
    const container = (
      <VirtualList
        data={data}
        render={(value) => <div>{value}</div>}
        getKey={(v) => v}
        itemHeight={20}
        initialRender={4}
        pageSize={4}
      />
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("abc");

    // same-length data change - slots get recycled via their signals
    data.dispatch(["x", "y", "z"]);
    expect(container.textContent).toBe("xyz");
  });

  it("should switch to the empty state and back as the data changes", async () => {
    const data = sig<readonly string[]>(["a", "b"]);
    const container = (
      <VirtualList
        data={data}
        render={(value) => <div>{value}</div>}
        getKey={(v) => v}
        itemHeight={20}
        initialRender={4}
        pageSize={4}
        renderEmpty={() => <div>nothing here</div>}
      />
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("ab");

    data.dispatch([]);
    expect(container.textContent).toBe("nothing here");

    data.dispatch(["q"]);
    expect(container.textContent).toBe("q");
  });
});

describe("VirtualList under If", () => {
  it("should freeze a list nested in a hidden memoized branch and catch up when shown again", async () => {
    const condition = sig(true);
    const data = sig<readonly string[]>(["a", "b", "c"]);
    let listElem: Element | undefined;

    const container = (
      <If
        condition={condition}
        memo
        then={() => {
          listElem = (
            <VirtualList
              data={data}
              render={(value) => <div>{value}</div>}
              getKey={(v) => v}
              itemHeight={20}
              initialRender={4}
              pageSize={4}
            />
          );
          return listElem;
        }}
        else={() => <div>else</div>}
      />
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("abc");

    // hiding the branch stops the list along with it
    condition.dispatch(false);
    expect(container.textContent).toBe("else");

    // the data signal changes while the list is hidden, but the list's
    // data binding is gated so the rows stay frozen
    data.dispatch(["x", "y", "z"]);
    expect(listElem?.textContent).toBe("abc");

    // showing the branch again resumes the list, the suppressed data
    // binding gets re-applied and the rows catch up
    condition.dispatch(true);
    expect(container.textContent).toBe("xyz");
    expect(container.firstElementChild).toBe(listElem);
  });

  it("should catch up the empty state of a list nested in a stopped branch", async () => {
    const condition = sig(true);
    const data = sig<readonly string[]>(["a", "b"]);

    const container = (
      <If
        condition={condition}
        memo
        then={() => (
          <VirtualList
            data={data}
            render={(value) => <div>{value}</div>}
            getKey={(v) => v}
            itemHeight={20}
            initialRender={4}
            pageSize={4}
            renderEmpty={() => <div>nothing here</div>}
          />
        )}
        else={() => <div>else</div>}
      />
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("ab");

    condition.dispatch(false);
    expect(container.textContent).toBe("else");

    // the list gets emptied while hidden - nothing happens yet
    data.dispatch([]);

    // resuming the branch flushes the data binding, which switches the
    // list into the empty state
    condition.dispatch(true);
    expect(container.textContent).toBe("nothing here");

    // data coming back while visible renders rows normally again
    data.dispatch(["q"]);
    expect(container.textContent).toBe("q");
  });
});

describe("VirtualList under Switch", () => {
  it("should freeze a list nested in a hidden memoized case and catch up when shown again", async () => {
    const switchValue = sig<"list" | "text">("list");
    const data = sig<readonly string[]>(["a", "b", "c"]);
    let listElem: Element | undefined;

    const container = (
      <Switch value={switchValue}>
        <Case match="list" memo>
          {() => {
            listElem = (
              <VirtualList
                data={data}
                render={(value) => <div>{value}</div>}
                getKey={(v) => v}
                itemHeight={20}
                initialRender={4}
                pageSize={4}
              />
            );
            return listElem;
          }}
        </Case>
        <Case match="text">{() => <div>text view</div>}</Case>
      </Switch>
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("abc");

    // switching to the other case stops the list
    switchValue.dispatch("text");
    expect(container.textContent).toBe("text view");

    // data changes while the list's case is hidden are gated
    data.dispatch(["x", "y"]);
    expect(listElem?.textContent).toBe("abc");

    // switching back resumes the list and catches it up
    switchValue.dispatch("list");
    expect(container.textContent).toBe("xy");
    expect(container.firstElementChild).toBe(listElem);
  });
});

describe("VirtualList rows containing If/Switch", () => {
  it("should update row-level If branches when slots get recycled", async () => {
    const data = sig<readonly { id: string; on: boolean }[]>([
      { id: "1", on: true },
      { id: "2", on: false },
    ]);

    const container = (
      <VirtualList
        data={data}
        getKey={(item) => item.id}
        itemHeight={20}
        initialRender={4}
        pageSize={4}
        render={(value) => (
          <If
            condition={value.$prop("on") as any}
            memo
            then={() => <div>on</div>}
            else={() => <div>off</div>}
          />
        )}
      />
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("onoff");

    // recycling the slots dispatches new items on the row value signals,
    // which flips the row-level If branches (with their stop/resume
    // handling for the memoized elements)
    data.dispatch([
      { id: "1", on: false },
      { id: "2", on: true },
    ]);
    expect(container.textContent).toBe("offon");
  });

  it("should update row-level Switch cases when slots get recycled", async () => {
    const data = sig<readonly { id: string; kind: "a" | "b" }[]>([
      { id: "1", kind: "a" },
      { id: "2", kind: "b" },
    ]);

    const container = (
      <VirtualList
        data={data}
        getKey={(item) => item.id}
        itemHeight={20}
        initialRender={4}
        pageSize={4}
        render={(value) => (
          <Switch value={value.$prop("kind") as any}>
            <Case match="a">{() => <div>A</div>}</Case>
            <Case match="b">{() => <div>B</div>}</Case>
          </Switch>
        )}
      />
    );
    document.body.appendChild(container);
    await sleep(0);

    expect(container.textContent).toBe("AB");

    data.dispatch([
      { id: "1", kind: "b" },
      { id: "2", kind: "a" },
    ]);
    expect(container.textContent).toBe("BA");
  });
});