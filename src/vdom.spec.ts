import { vi } from "vitest";
import { html, memo, patch, setHook, setInViewExecution, VNode } from "./vdom";

const { ul } = html;

describe("memo", () => {
  describe("returned function", () => {
    it("produces a VNode with the correct selector", () => {
      const memoized = memo((): VNode => ul(".list"));
      expect(memoized({}).sel).toBe("ul.list");
    });

    it("stableWrapper is the same reference across calls", () => {
      const memoized = memo((): VNode => ul(".list"));
      const vnode1 = memoized({ filter: "a" });
      const vnode2 = memoized({ filter: "b" });
      expect(vnode1.data?.fn).toBe(vnode2.data?.fn);
    });

    it("args contain prop values in key-insertion order", () => {
      const memoized = memo((): VNode => ul(".list"));
      const vnode = memoized({ filter: "hello", count: 5, active: true });
      expect(vnode.data?.args).toEqual(["hello", 5, true]);
    });
  });

  describe("key", () => {
    it("sets vnode.key when provided", () => {
      const memoized = memo((): VNode => ul(".list"), "my-key");
      expect(memoized({}).key).toBe("my-key");
    });

    it("vnode.key is undefined when not provided", () => {
      const memoized = memo((): VNode => ul(".list"));
      expect(memoized({}).key).toBeUndefined();
    });
  });

  describe("module-level guard", () => {
    afterEach(() => setInViewExecution(false));

    it("throws when called inside a view execution", () => {
      setInViewExecution(true);
      expect(() => memo((): VNode => ul(".list"))).toThrow(
        "memo() must be called at module level, not inside a view function"
      );
    });

    it("does not throw when called outside a view execution", () => {
      expect(() => memo((): VNode => ul(".list"))).not.toThrow();
    });
  });

  describe("selector derivation", () => {
    it("throws when renderFn returns a VNode without a selector", () => {
      // @ts-expect-error — intentionally incomplete VNode to test the runtime sel guard
      const memoized = memo((): VNode => ({ data: {} }));
      expect(() => memoized({})).toThrow("memo: renderFn must return a VNode with a selector");
    });
  });

  describe("renderFn invocation", () => {
    it("passes named props object to renderFn", () => {
      type Props = { filter: string; count: number };
      let receivedProps: Props | undefined;
      const memoized = memo((props: Props): VNode => {
        receivedProps = props;
        return ul(".list");
      });
      const vnode = memoized({ filter: "hello", count: 5 });
      vnode.data?.fn?.();
      expect(receivedProps).toEqual({ filter: "hello", count: 5 });
    });

    it("renderFn sees the latest props when stableWrapper is invoked", () => {
      type Props = { filter: string };
      let receivedProps: Props | undefined;
      const memoized = memo((props: Props): VNode => {
        receivedProps = props;
        return ul(".list");
      });
      memoized({ filter: "first" });
      const vnode = memoized({ filter: "second" });
      vnode.data?.fn?.();
      expect(receivedProps?.filter).toBe("second");
    });
  });

  describe("prop keys", () => {
    it("ignores keys introduced after the first call", () => {
      const memoized = memo((): VNode => ul(".list"));
      const vnode1 = memoized({ filter: "a" });
      const vnode2 = memoized({ filter: "b", extra: "ignored" });
      expect(vnode1.data?.args).toEqual(["a"]);
      expect(vnode2.data?.args).toEqual(["b"]);
    });
  });

  describe("memoization via patch", () => {
    let container: Element;

    beforeEach(() => {
      document.body.innerHTML = "";
      container = document.createElement("div");
      document.body.appendChild(container);
    });

    it("skips renderFn when props are unchanged", () => {
      const renderFn = vi.fn((): VNode => ul(".list", []));
      const memoized = memo(renderFn);
      const props = { filter: "a", count: 1 };

      const patched = patch(container, memoized(props));
      expect(renderFn).toHaveBeenCalledTimes(1);

      patch(patched, memoized(props));
      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it("calls renderFn when a primitive prop changes", () => {
      const renderFn = vi.fn((): VNode => ul(".list", []));
      const memoized = memo(renderFn);

      const patched = patch(container, memoized({ filter: "a", count: 1 }));
      expect(renderFn).toHaveBeenCalledTimes(1);

      patch(patched, memoized({ filter: "b", count: 1 }));
      expect(renderFn).toHaveBeenCalledTimes(2);
    });

    it("skips renderFn when a function prop reference is unchanged", () => {
      const renderFn = vi.fn((): VNode => ul(".list", []));
      const memoized = memo(renderFn);
      const stableHandler = (): void => {};

      const patched = patch(container, memoized({ onClick: stableHandler }));
      expect(renderFn).toHaveBeenCalledTimes(1);

      patch(patched, memoized({ onClick: stableHandler }));
      expect(renderFn).toHaveBeenCalledTimes(1);
    });

    it("calls renderFn when a function prop reference changes", () => {
      const renderFn = vi.fn((): VNode => ul(".list", []));
      const memoized = memo(renderFn);

      const patched = patch(container, memoized({ onClick: (): void => {} }));
      expect(renderFn).toHaveBeenCalledTimes(1);

      patch(patched, memoized({ onClick: (): void => {} }));
      expect(renderFn).toHaveBeenCalledTimes(2);
    });

    it("calls renderFn exactly once on first patch (no double-render for selector derivation)", () => {
      const renderFn = vi.fn((): VNode => ul(".list", []));
      const memoized = memo(renderFn);

      patch(container, memoized({ filter: "a" }));
      expect(renderFn).toHaveBeenCalledTimes(1);
    });
  });
});

describe("setHook", () => {
  it("attaches a hook callback to a vnode", () => {
    const callback = vi.fn();
    const vnode = ul(".list");
    setHook(vnode, "insert", callback);
    expect(vnode.data?.hook?.insert).toBe(callback);
  });

  it("creates data.hook if absent", () => {
    const callback = vi.fn();
    const vnode = ul(".list");
    delete vnode.data?.hook;
    setHook(vnode, "destroy", callback);
    expect(vnode.data?.hook?.destroy).toBe(callback);
  });

  it("does not throw for a falsy vnode", () => {
    // @ts-expect-error test null
    expect(() => setHook(null, "insert", vi.fn())).not.toThrow();
  });
});
