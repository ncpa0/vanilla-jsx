/**
 * Internal mechanism used to temporarily suppress DOM mutations made by
 * signals bound to elements within a given element subtree.
 *
 * How it works:
 *
 * Every DOM mutation caused by a signal goes through a binding callback
 * (registered via `sigProxy().bindTo()`, `VSignal.bindv()` or
 * `VSignal.bindAttribute()`). Right before such callback gets invoked the
 * `DomGate.gate()` method is called - if the bound element is contained
 * within a stopped subtree, the mutation is suppressed and the binding is
 * remembered on a pending list. Once the stopped subtree is resumed, all
 * pending bindings get re-applied with the most recent value of their
 * signal, bringing the DOM back in sync.
 *
 * Since all binding callbacks are idempotent setters, re-applying only
 * the most recent value is enough to catch up with all the changes that
 * happened while the subtree was stopped.
 *
 * Performance characteristics:
 *
 * - `stop()` is O(1) - the element tree is never walked.
 * - while no subtree is stopped, gated bindings run with zero overhead
 *   (a single `Set.size` check per mutation).
 * - while a subtree is stopped, each mutation made by a binding pays for
 *   an O(depth) walk *up* the DOM tree from the bound element towards
 *   the document root.
 * - `resume()` only re-applies the bindings that actually fired while
 *   the subtree was stopped - the element tree is never walked.
 *
 * Limitations:
 *
 * Containment is always evaluated against the *current* position of the
 * element in the DOM tree at the time of the mutation. Bindings attached
 * to elements that are not yet attached to any stopped subtree will not
 * be suppressed until their element becomes a part of one.
 */
export type GatedBinding = {
  /** Weak reference to the element that the signal is bound to. */
  elemRef: WeakRef<object>;
  /**
   * The signal that drives the binding.
   *
   * Note on garbage collection: the binding holds a strong reference to
   * the signal, but this does not affect the signal's lifetime in any
   * meaningful way - live elements already pin their signals through the
   * `ElemMap` registry, and the signal, its listener and the binding
   * reference each other in a cycle that gets collected as a whole once
   * it becomes unreachable. The only case in which the binding extends
   * the signal's lifetime is while it sits in the gate's pending
   * registry (between a suppressed mutation and the next resume of the
   * subtree containing it).
   */
  signal: { get(): any };
  /** The DOM-mutating callback associated with this binding. */
  cb: (elem: any, value: any) => void;
  /** Set to `true` once the binding has been detached from the signal. */
  detached: boolean;
};

class DomGate {
  /** Roots of the subtrees for which all DOM mutations are suppressed. */
  private static stoppedRoots = new Set<Element>();

  /**
   * Bindings that attempted to mutate the DOM while contained within a
   * stopped subtree, those will be re-applied once the subtree containing
   * them gets resumed.
   */
  private static pendingBindings = new Set<GatedBinding>();

  /**
   * Prevents all signals bound to the given element and all of its
   * descendants from making DOM mutations.
   *
   * The signals keep updating their values as usual, only the DOM writes
   * made by the bindings are suppressed. Use `DomGate.resume()` to
   * re-enable the mutations and re-apply all the changes that were made
   * in the meantime.
   *
   * Calls to `stop()` can be nested - resuming an element will also
   * resume all of its descendant subtrees that have been stopped
   * separately.
   */
  public static stop(root: Element): void {
    this.stoppedRoots.add(root);
  }

  /**
   * Re-enables DOM mutations for all signals bound to the given element
   * and all of its descendants and re-applies all the mutations that
   * have been suppressed since the element was stopped.
   *
   * Resuming an element also resumes all of its subtrees that have been
   * stopped separately. Bindings contained within other, still stopped,
   * subtrees remain suppressed.
   */
  public static resume(root: Element): void {
    for (const stoppedRoot of this.stoppedRoots) {
      if (stoppedRoot === root || root.contains(stoppedRoot)) {
        this.stoppedRoots.delete(stoppedRoot);
      }
    }

    for (const binding of this.pendingBindings) {
      const elem = binding.elemRef.deref();

      // the element has been garbage collected or the binding has been
      // detached in the meantime - there is nothing to re-apply.
      if (!elem || binding.detached) {
        this.pendingBindings.delete(binding);
        continue;
      }

      // the binding is contained within another, still stopped, subtree
      // - it will be re-applied once that subtree gets resumed.
      if (this.isStopped(elem)) {
        continue;
      }

      this.pendingBindings.delete(binding);
      try {
        binding.cb(elem, binding.signal.get());
      } catch (e) {
        console.error(e);
      }
    }
  }

  /**
   * Checks whether the given element is contained within any of the
   * stopped subtrees.
   *
   * This is done by walking *up* the DOM tree from the given element
   * (which is bounded by the depth of the tree) rather than walking down
   * any of the stopped subtrees.
   */
  public static isStopped(elem: object): boolean {
    if (this.stoppedRoots.size === 0) {
      return false;
    }

    let node: object | null = elem;
    while (node) {
      if (this.stoppedRoots.has(node as Element)) {
        return true;
      }
      node = (node as Node).parentElement ?? null;
    }
    return false;
  }

  /**
   * Should be called by all binding callbacks right before applying a
   * DOM mutation. Returns `true` if the mutation should be suppressed,
   * in which case the binding is remembered and will be re-applied once
   * the stopped subtree containing the bound element gets resumed.
   *
   * If the element is not contained within a stopped subtree, any
   * pending re-application registered for the binding gets dropped -
   * this can happen when the bound element has been moved out of a
   * stopped subtree in the meantime, in which case the mutation applied
   * here already brings the DOM up to date.
   */
  public static gate(elem: object, binding: GatedBinding): boolean {
    if (this.stoppedRoots.size === 0) {
      return false;
    }
    if (!this.isStopped(elem)) {
      this.pendingBindings.delete(binding);
      return false;
    }
    this.pendingBindings.add(binding);
    return true;
  }

  /**
   * Informs the gate that the given binding has been detached from its
   * signal and should not be re-applied anymore.
   */
  public static discard(binding: GatedBinding): void {
    binding.detached = true;
    this.pendingBindings.delete(binding);
  }
}

export { DomGate };
