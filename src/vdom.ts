import {
  init,
  h,
  classModule,
  attributesModule,
  propsModule,
  eventListenersModule,
  styleModule
} from "snabbdom";
import hyperscriptHelpers from "hyperscript-helpers";
import type { VNode, Hooks } from "snabbdom";
import { thunk } from "snabbdom";
export type { VNode };

let inViewExecution = false;

export function setInViewExecution(value: boolean): void {
  inViewExecution = value;
}

/*
  Memoize a render function by creating a thunk that only re-renders when its dependencies change
  Use when you have a self contained sub-tree with expensive rendering (e.g. mapping a large collection) that is independent of some frequently-changing parent state
  See `/examples/spa/src/components/datesList.ts` for a working example
*/
export function memo<TProps extends Record<string, unknown>>(
  renderFn: (props: TProps) => VNode,
  key?: string | number
): (props: TProps) => VNode {
  if (inViewExecution) {
    throw new Error("memo() must be called at module level, not inside a view function");
  }

  let propKeys: string[] | null = null;
  let latestProps: TProps;
  let cachedSelector: string | undefined;
  let firstVNode: VNode | undefined;

  // Returns the cached first VNode on the initial snabbdom `init` hook call to avoid a double-render,
  // then delegates to renderFn for all subsequent calls
  const stableRenderFn = (): VNode => {
    if (firstVNode) {
      const vnode = firstVNode;
      firstVNode = undefined;
      return vnode;
    }
    return renderFn(latestProps);
  };

  return (props: TProps): VNode => {
    if (!propKeys) {
      propKeys = Object.keys(props);
    }
    latestProps = props;
    const dependencies = propKeys.map((k) => props[k]);

    if (!cachedSelector) {
      firstVNode = renderFn(props);
      if (!firstVNode.sel) {
        throw new Error("memo: renderFn must return a VNode with a selector (e.g. ul, div#id)");
      }
      cachedSelector = firstVNode.sel;
    } else if (firstVNode) {
      // Props updated again before snabbdom consumed firstVNode — discard the stale cached render
      firstVNode = undefined;
    }

    // thunk(selector, key, renderFn, [stateArguments])
    // https://github.com/snabbdom/snabbdom?tab=readme-ov-file#thunks
    // `selector` e.g. `div#container.bar.baz` – A div element with the id container and the classes bar and baz
    // `key` is optional, it should be supplied when the selector is not unique among the thunk's siblings
    // `renderFn` is invoked only if the renderFn is changed or stateArguments change
    // `stateArguments` is an array of dependencies that are used to determine if the thunk should be re-rendered
    return thunk(cachedSelector, key, stableRenderFn, dependencies);
  };
}

export const patch = init([
  classModule,
  attributesModule,
  propsModule,
  eventListenersModule,
  styleModule
]);

export const html = hyperscriptHelpers(h);

export function setHook(vnode: VNode, hookName: keyof Hooks, callback: () => void): VNode {
  // See https://github.com/snabbdom/snabbdom#hooks
  if (vnode) {
    vnode.data = vnode.data || {};
    vnode.data.hook = vnode.data.hook || {};
    const existing = vnode.data.hook[hookName];
    if (existing) {
      // Compose with any previously set hook on the same name.
      // Hooks have varying arity (0–2 args) so we forward arguments dynamically.
      const prev = existing;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
      (vnode.data.hook[hookName] as any) = function (this: unknown): void {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/consistent-type-assertions
        (prev as any).apply(this, arguments);
        callback();
      };
    } else {
      vnode.data.hook[hookName] = callback;
    }
  }
  return vnode;
}
