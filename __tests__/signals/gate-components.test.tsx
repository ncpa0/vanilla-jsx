import { describe, expect, it } from "vitest";
import { If } from "../../src/base-components/if";
import { Case, Switch } from "../../src/base-components/switch";
import { sig } from "../../src/signals";
import { jsx } from "../../src/reconciler/reconciler";

describe("If component stop/resume", () => {
  it("should render the then branch when the condition is truthy and the else branch otherwise", () => {
    const condition = sig(true);
    const container = (
      <If
        condition={condition}
        then={() => <div>then</div>}
        else={() => <div>else</div>}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("then");

    condition.dispatch(false);
    expect(container.textContent).toBe("else");

    condition.dispatch(true);
    expect(container.textContent).toBe("then");
  });

  it("should stop updating a memoized then branch while hidden and catch up when shown again", () => {
    const condition = sig(true);
    const text = sig("one");
    let thenElem: Element | undefined;

    const container = (
      <If
        condition={condition}
        memo
        then={() => {
          thenElem = <div>{text}</div>;
          return thenElem;
        }}
        else={() => <div>else</div>}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("one");
    expect(thenElem?.textContent).toBe("one");

    // switching to the else branch stops the memoized then branch
    condition.dispatch(false);
    expect(container.textContent).toBe("else");

    // signals bound within the stopped branch keep updating their values
    // but no longer mutate the hidden DOM
    text.dispatch("two");
    expect(thenElem?.textContent).toBe("one");

    // switching back resumes the branch and re-applies all the mutations
    // that happened in the meantime
    condition.dispatch(true);
    expect(container.textContent).toBe("two");
    expect(container.firstElementChild).toBe(thenElem);

    // while visible the branch keeps updating normally again
    text.dispatch("three");
    expect(container.textContent).toBe("three");
  });

  it("should stop updating a memoized else branch while hidden and catch up when shown again", () => {
    const condition = sig(false);
    const text = sig("one");
    let elseElem: Element | undefined;

    const container = (
      <If
        condition={condition}
        memo
        then={() => <div>then</div>}
        else={() => {
          elseElem = <div>{text}</div>;
          return elseElem;
        }}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("one");

    condition.dispatch(true);
    expect(container.textContent).toBe("then");

    text.dispatch("two");
    expect(elseElem?.textContent).toBe("one");

    condition.dispatch(false);
    expect(container.textContent).toBe("two");
    expect(container.firstElementChild).toBe(elseElem);
  });

  it("should keep both memoized branches in sync across multiple condition flips", () => {
    const condition = sig(true);
    const thenText = sig("t1");
    const elseText = sig("e1");

    const container = (
      <If
        condition={condition}
        memo
        then={() => <div>{thenText}</div>}
        else={() => <div>{elseText}</div>}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("t1");

    condition.dispatch(false);
    expect(container.textContent).toBe("e1");

    // the hidden then branch gets suppressed, the visible else branch
    // keeps updating normally
    thenText.dispatch("t2");
    elseText.dispatch("e2");
    expect(container.textContent).toBe("e2");

    condition.dispatch(true);
    expect(container.textContent).toBe("t2");

    condition.dispatch(false);
    // the else branch was already up to date, resuming it should not
    // produce any visible change
    expect(container.textContent).toBe("e2");

    thenText.dispatch("t3");
    elseText.dispatch("e3");
    condition.dispatch(true);
    expect(container.textContent).toBe("t3");
  });

  it("should render fresh elements with current values when not memoized", () => {
    const condition = sig(true);
    const text = sig("one");
    const rendered: Element[] = [];

    const container = (
      <If
        condition={condition}
        then={() => {
          const e = <div>{text}</div>;
          rendered.push(e);
          return e;
        }}
        else={() => <div>else</div>}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("one");

    condition.dispatch(false);
    text.dispatch("two");
    condition.dispatch(true);

    // without memo a fresh element is rendered each time, so it picks up
    // the current signal value on its own
    expect(container.textContent).toBe("two");
    expect(rendered.length).toBe(2);
    expect(container.firstElementChild).not.toBe(rendered[0]);
  });
});

describe("Switch component stop/resume", () => {
  it("should render the case matching the value", () => {
    const value = sig<"a" | "b">("a");
    const container = (
      <Switch value={value}>
        <Case match="a">{() => <div>a</div>}</Case>
        <Case match="b">{() => <div>b</div>}</Case>
      </Switch>
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("a");

    value.dispatch("b");
    expect(container.textContent).toBe("b");

    value.dispatch("a");
    expect(container.textContent).toBe("a");
  });

  it("should stop updating a memoized case while not matched and catch up when matched again", () => {
    const value = sig<"a" | "b">("a");
    const textA = sig("one");
    let elemA: Element | undefined;

    const container = (
      <Switch value={value}>
        <Case match="a" memo>
          {() => {
            elemA = <div>{textA}</div>;
            return elemA;
          }}
        </Case>
        <Case match="b">{() => <div>b</div>}</Case>
      </Switch>
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("one");
    expect(elemA?.textContent).toBe("one");

    // switching to another case stops the memoized case element
    value.dispatch("b");
    expect(container.textContent).toBe("b");

    textA.dispatch("two");
    expect(elemA?.textContent).toBe("one");

    // switching back resumes the case element and catches it up
    value.dispatch("a");
    expect(container.textContent).toBe("two");
    expect(container.firstElementChild).toBe(elemA);

    textA.dispatch("three");
    expect(container.textContent).toBe("three");
  });

  it("should resume a memoized case even after a no-match detour", () => {
    const value = sig<string>("a");
    const textA = sig("one");
    let elemA: Element | undefined;

    const container = (
      <Switch value={value}>
        <Case match="a" memo>
          {() => {
            elemA = <div>{textA}</div>;
            return elemA;
          }}
        </Case>
      </Switch>
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("one");

    // no matching case - an empty element gets rendered instead
    value.dispatch("c");
    expect(container.textContent).toBe("");

    textA.dispatch("two");
    expect(elemA?.textContent).toBe("one");

    value.dispatch("a");
    expect(container.textContent).toBe("two");
  });

  it("should keep multiple memoized cases in sync across switches", () => {
    const value = sig<"a" | "b">("a");
    const textA = sig("a1");
    const textB = sig("b1");

    const container = (
      <Switch value={value}>
        <Case match="a" memo>
          {() => <div>{textA}</div>}
        </Case>
        <Case match="b" memo>
          {() => <div>{textB}</div>}
        </Case>
      </Switch>
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("a1");

    value.dispatch("b");
    expect(container.textContent).toBe("b1");

    // hidden case suppressed, visible case updates normally
    textA.dispatch("a2");
    textB.dispatch("b2");
    expect(container.textContent).toBe("b2");

    value.dispatch("a");
    expect(container.textContent).toBe("a2");

    value.dispatch("b");
    expect(container.textContent).toBe("b2");
  });

  it("should render fresh case elements with current values when not memoized", () => {
    const value = sig<string>("a");
    const textA = sig("one");
    const rendered: Element[] = [];

    const container = (
      <Switch value={value}>
        <Case match="a">
          {() => {
            const e = <div>{textA}</div>;
            rendered.push(e);
            return e;
          }}
        </Case>
      </Switch>
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("one");

    value.dispatch("b");
    textA.dispatch("two");
    value.dispatch("a");

    expect(container.textContent).toBe("two");
    expect(rendered.length).toBe(2);
    expect(container.firstElementChild).not.toBe(rendered[0]);
  });
});

describe("nested component stop/resume", () => {
  it("should catch up an inner If nested within a stopped outer branch", () => {
    const outerCondition = sig(true);
    const innerCondition = sig(true);
    const innerText = sig("i1");

    let outerThenElem: Element | undefined;
    let innerElseElem: Element | undefined;

    const container = (
      <If
        condition={outerCondition}
        memo
        then={() => {
          const e = (
            <If
              condition={innerCondition}
              memo
              then={() => <div>inner-then</div>}
              else={() => {
                innerElseElem = <div>{innerText}</div>;
                return innerElseElem;
              }}
            />
          );
          outerThenElem = e;
          return e;
        }}
        else={() => <div>outer-else</div>}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("inner-then");

    // hiding the outer branch stops the inner If along with it
    outerCondition.dispatch(false);
    expect(container.textContent).toBe("outer-else");

    // the inner If's condition changes while the outer branch is hidden,
    // but the inner If is gated as a part of the outer subtree so it does
    // not react at all - its DOM stays frozen on the last rendered branch
    innerCondition.dispatch(false);
    expect(outerThenElem?.textContent).toBe("inner-then");
    expect(innerElseElem).toBeUndefined();

    innerText.dispatch("i2");

    // resuming the outer branch flushes the inner If's binding, which
    // makes the inner If switch to its else branch and pick up the
    // current value of innerText in the process
    outerCondition.dispatch(true);
    expect(container.textContent).toBe("i2");
    expect(container.firstElementChild).toBe(outerThenElem);
    expect(innerElseElem?.textContent).toBe("i2");

    // from now on the inner If keeps updating normally again
    innerText.dispatch("i3");
    expect(container.textContent).toBe("i3");
  });

  it("should catch up a Switch nested within a stopped outer If branch", () => {
    const outerCondition = sig(true);
    const switchValue = sig<"a" | "b">("a");
    const textA = sig("a1");

    let switchElem: Element | undefined;
    let elemA: Element | undefined;

    const container = (
      <If
        condition={outerCondition}
        memo
        then={() => {
          const e = (
            <Switch value={switchValue}>
              <Case match="a" memo>
                {() => {
                  elemA = <div>{textA}</div>;
                  return elemA;
                }}
              </Case>
              <Case match="b">{() => <div>b</div>}</Case>
            </Switch>
          );
          switchElem = e;
          return e;
        }}
        else={() => <div>outer-else</div>}
      />
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("a1");

    // hiding the outer branch stops the Switch along with it
    outerCondition.dispatch(false);
    expect(container.textContent).toBe("outer-else");

    // the Switch's value changes while hidden, but the Switch is gated as
    // a part of the outer subtree so its DOM stays frozen on case "a"
    switchValue.dispatch("b");
    expect(switchElem?.textContent).toBe("a1");

    // the hidden memoized case's signal changes as well
    textA.dispatch("a2");
    expect(elemA?.textContent).toBe("a1");

    // resuming the outer branch flushes the Switch's binding, making it
    // switch to case "b"
    outerCondition.dispatch(true);
    expect(container.textContent).toBe("b");

    // switching back to case "a" resumes its memoized element, which
    // catches up to the latest signal value
    switchValue.dispatch("a");
    expect(container.textContent).toBe("a2");
    expect(container.firstElementChild?.firstElementChild).toBe(elemA);
  });

  it("should catch up an If nested within a stopped memoized Switch case", () => {
    const switchValue = sig<"a" | "b">("a");
    const innerCondition = sig(true);
    const innerText = sig("x1");

    let elemA: Element | undefined;
    let innerElseElem: Element | undefined;

    const container = (
      <Switch value={switchValue}>
        <Case match="a" memo>
          {() => {
            elemA = (
              <If
                condition={innerCondition}
                memo
                then={() => <div>it</div>}
                else={() => {
                  innerElseElem = <div>{innerText}</div>;
                  return innerElseElem;
                }}
              />
            );
            return elemA;
          }}
        </Case>
        <Case match="b">{() => <div>b</div>}</Case>
      </Switch>
    );
    document.body.appendChild(container);

    expect(container.textContent).toBe("it");

    // switching to case "b" stops the memoized case "a" element, which
    // contains the inner If
    switchValue.dispatch("b");
    expect(container.textContent).toBe("b");

    // the inner If's condition changes while its parent case is stopped,
    // but the inner If is gated as a part of the stopped case subtree so
    // its DOM stays frozen on the then branch
    innerCondition.dispatch(false);
    expect(elemA?.textContent).toBe("it");
    expect(innerElseElem).toBeUndefined();

    innerText.dispatch("x2");

    // switching back to case "a" resumes the case element, which flushes
    // the inner If's binding and makes it switch to its else branch with
    // the current value of innerText
    switchValue.dispatch("a");
    expect(container.textContent).toBe("x2");
    expect(container.firstElementChild).toBe(elemA);
    expect(innerElseElem?.textContent).toBe("x2");
  });
});