import { vi } from "vitest";
import {
  _setTestKey,
  _resetForTest,
  ActionThunk,
  component,
  GetConfig,
  html,
  mount,
  componentRegistry,
  renderComponent
} from "./cr-26";
import { log } from "./log";
import * as vdom from "./vdom";
const { div } = html;
const testKey = _setTestKey({});

const patchSpy = vi.spyOn(vdom, "patch");
const renderSpy = vi.spyOn(log, "render");

describe("Component Lifecycle & State Management", () => {
  beforeEach(() => {
    patchSpy.mockClear();
    renderSpy.mockClear();
    _resetForTest();

    // Initialize app element
    const appEl = document.createElement("div");
    appEl.setAttribute("id", "app");
    document.body.innerHTML = "";
    document.body.appendChild(appEl);
  });

  describe("Thunk Caching & Memoization", () => {
    it("should return same action thunk for identical params", () => {
      let action: Function = () => {};

      const comp = component<{
        Props: { value: number };
        State: { count: number };
        ActionPayloads: { Increment: { step: number } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (data, ctx) => {
              const state = ctx?.state ?? { count: 0 };
              const step = data?.step ?? 0;
              return { state: { ...state, count: state.count + step } };
            }
          },
          view: (ctx) => div(`#${ctx.id}`, `${ctx.state?.count ?? 0}`)
        };
      });

      mount({ app: comp, props: { value: 1 } });

      const thunk1 = action("Increment", { step: 1 });
      const thunk2 = action("Increment", { step: 1 });
      const thunk3 = action("Increment", { step: 2 }); // Different data

      expect(thunk1).toBe(thunk2); // Same cache
      expect(thunk1).not.toBe(thunk3); // Different cache
    });

    it("should return same task thunk for identical params", () => {
      let task: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { result: number };
        TaskPayloads: { FetchData: { id: number } };
      }>(({ task: t }) => {
        task = t;
        return {
          state: () => ({ result: 0 }),
          tasks: {
            FetchData: (data) => ({
              perform: () => Promise.resolve((data?.id ?? 0) * 2),
              success: () => undefined
            })
          },
          view: (ctx) => div(`#${ctx.id}`, `${ctx.state?.result ?? 0}`)
        };
      });

      mount({ app: comp, props: {} });

      const thunk1 = task("FetchData", { id: 1 });
      const thunk2 = task("FetchData", { id: 1 });
      const thunk3 = task("FetchData", { id: 2 });

      expect(thunk1).toBe(thunk2);
      expect(thunk1).not.toBe(thunk3);
    });

    it("should invalidate thunk cache on component cleanup", () => {
      let parentAction: Function = () => {};
      let childAction: Function = () => {};
      let cachedChildThunk;

      const child = component<{
        Props: Record<string, never>;
        State: { count: number };
        ActionPayloads: { Increment: undefined };
      }>(({ action: a }) => {
        childAction = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => {
              const state = ctx?.state ?? { count: 0 };
              return { state: { ...state, count: state.count + 1 } };
            }
          },
          view: (ctx) => div(`#${ctx.id}`, `Child: ${ctx.state?.count ?? 0}`)
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { showChild: boolean };
        ActionPayloads: { Toggle: undefined };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ showChild: true }),
          actions: {
            Toggle: (_, ctx) => {
              const state = ctx?.state ?? { showChild: true };
              return { state: { showChild: !state.showChild } };
            }
          },
          view: (ctx) =>
            div(`#${ctx.id}`, (ctx.state?.showChild ?? true) ? [child("#child", {})] : [])
        };
      });

      mount({ app: parent, props: {} });

      // Cache child action thunk
      cachedChildThunk = childAction("Increment");
      expect(cachedChildThunk).toBeDefined();

      expect(componentRegistry.has("child")).toBe(true);

      // Toggle to unmount child
      parentAction("Toggle")(testKey);

      expect(componentRegistry.has("child")).toBe(false);

      // Re-mount child
      parentAction("Toggle")(testKey);

      // Get new action thunk - should be different instance (cache invalidated)
      const newChildThunk = childAction("Increment");
      expect(newChildThunk).not.toBe(cachedChildThunk);

      // Verify new component has fresh state
      const newChild = componentRegistry.get("child");
      expect(newChild?.state).toEqual({ count: 0 });
    });
  });

  describe("Props Management", () => {
    it("should freeze props deeply and prevent mutation", () => {
      let action: Function = () => {};
      let capturedProps: { data: { value?: number } } = { data: {} };

      const comp = component<{
        Props: { data: { value: number } };
        State: Record<string, never>;
        ActionPayloads: { MutateProps: undefined };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({}),
          actions: {
            MutateProps: (_, ctx) => {
              capturedProps = ctx?.props;
              return { state: ctx?.state ?? {} };
            }
          },
          view: ({ id }) => div(`#${id}`, "test")
        };
      });

      mount({ app: comp, props: { data: { value: 42 } } });

      action("MutateProps")(testKey);

      // Props should be frozen at all levels
      expect(Object.isFrozen(capturedProps)).toBe(true);
      expect(Object.isFrozen(capturedProps?.data)).toBe(true);

      // Attempting to mutate should throw
      expect(() => {
        capturedProps.data.value = 99;
      }).toThrow();
    });

    it("should track prevProps correctly across renders", () => {
      let action: Function = () => {};

      const child = component<{
        Props: { value: number };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: (ctx) => div(`#${ctx.id}`, `${ctx.props?.value ?? 0}`)
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { childValue: number };
        ActionPayloads: { UpdateChild: undefined };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ childValue: 1 }),
          actions: {
            UpdateChild: (_, ctx) => {
              const childValue = (ctx?.state?.childValue ?? 1) + 1;
              return { state: { childValue } };
            }
          },
          view: (ctx) => div(`#${ctx.id}`, [child("#child", { value: ctx.state?.childValue ?? 1 })])
        };
      });

      mount({ app: parent, props: {} });

      let childInstance = componentRegistry.get("child");
      expect(childInstance?.props).toEqual({ value: 1 });
      expect(childInstance?.prevProps).toEqual({ value: 1 });

      // Update child props
      action("UpdateChild")(testKey);

      childInstance = componentRegistry.get("child");
      expect(childInstance?.props).toEqual({ value: 2 });
      expect(childInstance?.prevProps).toEqual({ value: 2 });
    });
  });

  describe("Component Registry", () => {
    it("should cleanup registry when component unmounts", () => {
      let action: Function = () => {};

      const child = component<{
        Props: Record<string, never>;
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id }) => div(`#${id}`, "child")
        };
      });

      const grandchild = component<{
        Props: Record<string, never>;
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id }) => div(`#${id}`, "grandchild")
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { show: boolean };
        ActionPayloads: { Toggle: undefined };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ show: true }),
          actions: {
            Toggle: (_, ctx) => {
              const show = !(ctx?.state?.show ?? true);
              return { state: { show } };
            }
          },
          view: (ctx) =>
            div(
              `#${ctx.id}`,
              (ctx.state?.show ?? true) ? [child("#child", {}), grandchild("#grandchild", {})] : []
            )
        };
      });

      mount({ app: parent, props: {} });

      expect(componentRegistry.size).toBe(3); // parent + child + grandchild
      expect(componentRegistry.has("app")).toBe(true);
      expect(componentRegistry.has("child")).toBe(true);
      expect(componentRegistry.has("grandchild")).toBe(true);

      // Unmount children
      action("Toggle")(testKey);

      expect(componentRegistry.size).toBe(1); // parent only
      expect(componentRegistry.has("child")).toBe(false);
      expect(componentRegistry.has("grandchild")).toBe(false);
    });

    it("should call config destroy callback on unmount", () => {
      let parentAction: Function = () => {};
      const destroyCallback = vi.fn();

      const child = component<{
        Props: Record<string, never>;
      }>(() => ({
        destroy: destroyCallback,
        view: ({ id }) => div(`#${id}`, "child")
      }));

      const parent = component<{
        Props: Record<string, never>;
        State: { showChild: boolean };
        ActionPayloads: { Toggle: undefined };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ showChild: true }),
          actions: {
            Toggle: (_, ctx) => {
              const state = ctx?.state ?? { showChild: true };
              return { state: { showChild: !state.showChild } };
            }
          },
          view: (ctx) =>
            div(`#${ctx.id}`, (ctx.state?.showChild ?? true) ? [child("#child", {})] : [])
        };
      });

      mount({ app: parent, props: {} });
      expect(destroyCallback).not.toHaveBeenCalled();

      // Unmount child — should call destroy AND framework cleanup
      parentAction("Toggle")(testKey);

      expect(destroyCallback).toHaveBeenCalledOnce();
      expect(componentRegistry.has("child")).toBe(false);
    });

    it("should compose user-defined destroy hooks with framework cleanup", () => {
      let parentAction: Function = () => {};
      const userDestroyHook = vi.fn();

      const child = component<{
        Props: Record<string, never>;
      }>(() => ({
        view: ({ id }) => {
          const vnode = div(`#${id}`, "child");
          vdom.setHook(vnode, "destroy", userDestroyHook);
          return vnode;
        }
      }));

      const parent = component<{
        Props: Record<string, never>;
        State: { showChild: boolean };
        ActionPayloads: { Toggle: undefined };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ showChild: true }),
          actions: {
            Toggle: (_, ctx) => {
              const state = ctx?.state ?? { showChild: true };
              return { state: { showChild: !state.showChild } };
            }
          },
          view: (ctx) =>
            div(`#${ctx.id}`, (ctx.state?.showChild ?? true) ? [child("#child", {})] : [])
        };
      });

      mount({ app: parent, props: {} });
      expect(componentRegistry.has("child")).toBe(true);
      expect(userDestroyHook).not.toHaveBeenCalled();

      // Unmount child — should call user hook AND framework cleanup
      parentAction("Toggle")(testKey);

      expect(userDestroyHook).toHaveBeenCalledOnce();
      expect(componentRegistry.has("child")).toBe(false);
    });

    it("should reset inCurrentRender flag after patch", () => {
      let action: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { count: number };
        ActionPayloads: { Increment: undefined };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => {
              const count = (ctx?.state?.count ?? 0) + 1;
              return { state: { count } };
            }
          },
          view: (ctx) => div(`#${ctx.id}`, `${ctx.state?.count ?? 0}`)
        };
      });

      mount({ app: comp, props: {} });

      const instance = componentRegistry.get("app");

      // After mount, flag should be reset
      expect(instance?.inCurrentRender).toBe(false);

      // Trigger update
      action("Increment")(testKey);

      // After update, flag should be reset
      expect(instance?.inCurrentRender).toBe(false);
    });
  });

  describe("State Optimization", () => {
    it("should skip render when state reference unchanged", () => {
      let action: Function = () => {};
      let renderCount = 0;

      const comp = component<{
        Props: Record<string, never>;
        State: { count: number };
        ActionPayloads: { NoChange: undefined; Change: undefined };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            NoChange: (_, ctx) => ({ state: ctx?.state ?? { count: 0 } }), // Same reference
            Change: (_, ctx) => {
              const state = ctx?.state ?? { count: 0 };
              return { state: { ...state, count: state.count + 1 } };
            }
          },
          view: (ctx) => {
            renderCount++;
            return div(`#${ctx.id}`, `${ctx.state?.count ?? 0}`);
          }
        };
      });

      mount({ app: comp, props: {} });
      const afterMountRenderCount = renderCount;
      patchSpy.mockClear();

      // No change - should not render (state reference is same)
      action("NoChange")(testKey);
      expect(renderCount).toBe(afterMountRenderCount); // View not called
      expect(patchSpy).not.toHaveBeenCalled(); // No patch

      // With change - should render
      action("Change")(testKey);
      expect(renderCount).toBe(afterMountRenderCount + 1);
      expect(patchSpy).toHaveBeenCalled();

      patchSpy.mockClear();

      // After a change, NoChange should still not render
      action("NoChange")(testKey);
      expect(patchSpy).not.toHaveBeenCalled();
    });
  });

  describe("Initialization", () => {
    it("should execute init actions", () => {
      let initExecuted = false;

      const comp = component<{
        Props: Record<string, never>;
        State: { initialized: boolean };
        ActionPayloads: { Init: undefined };
      }>(({ action: a }) => {
        return {
          state: () => ({ initialized: false }),
          init: a("Init"),
          actions: {
            Init: () => {
              initExecuted = true;
              return { state: { initialized: true } };
            }
          },
          view: (ctx) => div(`#${ctx.id}`, `${ctx.state?.initialized ?? false}`)
        };
      });

      mount({ app: comp, props: {} });

      expect(initExecuted).toBe(true);

      const instance = componentRegistry.get("app");
      expect(instance?.state).toEqual({ initialized: true });
    });

    it("should execute init tasks from component's own tasks", async () => {
      let performCalled = false;
      let successCalled = false;

      const comp = component<{
        Props: Record<string, never>;
        State: { data: string };
        ActionPayloads: { SetData: { value: string } };
        TaskPayloads: { LoadData: undefined };
      }>(({ action: a, task: t }) => {
        return {
          state: () => ({ data: "" }),
          init: t("LoadData"),
          actions: {
            SetData: (payload) => {
              successCalled = true;
              return { state: { data: payload?.value ?? "" } };
            }
          },
          tasks: {
            LoadData: () => ({
              perform: async (): Promise<string> => {
                performCalled = true;
                return Promise.resolve("loaded data");
              },
              success: (result: string) => {
                return a("SetData", { value: result });
              }
            })
          },
          view: (ctx) => div(`#${ctx.id}`, ctx.state?.data ?? "")
        };
      });

      mount({ app: comp, props: {} });

      // Task perform should be called immediately
      expect(performCalled).toBe(true);

      // Wait for async task to complete
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Success handler should have run and updated state
      expect(successCalled).toBe(true);

      const instance = componentRegistry.get("app");
      expect(instance?.state).toEqual({ data: "loaded data" });
    });
  });

  describe("Props Changes & Re-rendering", () => {
    it("should re-render when props change via direct renderComponent call", () => {
      // Track child view calls to verify it's being called with updated props
      const childViewCalls: string[] = [];
      let componentId = 0;
      const getId = () => `_${componentId++}`;
      const childId = getId();

      const getConfig: GetConfig<{
        Props: { message: string };
        State: { internalState: number };
      }> = () => ({
        state: () => ({ internalState: 0 }),
        view: ({ id, props }) => {
          const msg = props?.message || "";
          childViewCalls.push(msg);
          return div(`#${id}.child`, msg);
        }
      });

      // Initial render with props
      const initialVnode = renderComponent(childId, getConfig, { message: "initial" });
      expect(childViewCalls).toEqual(["initial"]);

      // Patch initial vnode to DOM
      const container = document.createElement("div");
      document.body.appendChild(container);
      vdom.patch(container, initialVnode);

      // Re-render the same component with different props
      renderComponent(childId, getConfig, { message: "updated" });

      // Child view should have been called again with "updated"
      expect(childViewCalls).toEqual(["initial", "updated"]);
    });

    it("should re-render child when parent state changes child props", () => {
      let childRenderCount = 0;
      let action: Function = () => {};

      const child = component<{
        Props: { message: string };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id, props }) => {
            childRenderCount++;
            return div(`#${id}.child`, props?.message || "");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { message: string };
        ActionPayloads: { UpdateMessage: { text: string } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ message: "initial" }),
          actions: {
            UpdateMessage: (data, ctx) => ({
              state: { ...(ctx?.state ?? { message: "" }), message: data?.text ?? "" }
            })
          },
          view: ({ id, state }) => {
            return div(`#${id}.parent`, [child("#child", { message: state?.message || "" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      const afterMountCount = childRenderCount;

      // Update parent state which changes child props
      action("UpdateMessage", { text: "updated" })(testKey);

      // Child should re-render with new props from parent
      expect(childRenderCount).toBe(afterMountCount + 1);
    });

    it("should handle action thunks passed as props", () => {
      const parentActionCalls: string[] = [];
      let parentAction: Function = () => {};

      const child = component<{
        Props: { onAction: ActionThunk };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id }) => {
            return div(`#${id}.child`, "child");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { value: number };
        ActionPayloads: { ParentAction: { value: string } };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ value: 0 }),
          actions: {
            ParentAction: (data, ctx) => {
              parentActionCalls.push(data?.value ?? "");
              return { state: ctx?.state ?? { value: 0 } };
            }
          },
          view: ({ id }) => {
            return div(`#${id}.parent`, [
              child("#child", {
                onAction: parentAction("ParentAction", { value: "from-child" })
              })
            ]);
          }
        };
      });

      mount({ app: parent, props: {} });

      // Get child instance and trigger the action thunk
      const childInstance = componentRegistry.get("child");
      expect(childInstance).toBeDefined();

      // Simulate child calling parent action
      const onAction = childInstance?.props?.onAction;
      if (onAction && typeof onAction === "function") {
        onAction(testKey);
      }

      expect(parentActionCalls).toEqual(["from-child"]);
    });

    it("should handle props change AND state change in same component", () => {
      const viewCalls: Array<{ props: string; state: number }> = [];
      let parentAction: Function = () => {};
      let childAction: Function = () => {};

      const child = component<{
        Props: { message: string };
        State: { count: number };
        ActionPayloads: { Increment: undefined };
      }>(({ action: a }) => {
        childAction = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => ({
              state: { ...(ctx?.state ?? { count: 0 }), count: (ctx?.state?.count ?? 0) + 1 }
            })
          },
          view: ({ id, props, state }) => {
            viewCalls.push({
              props: props?.message || "",
              state: state?.count || 0
            });
            return div(`#${id}`, `${props?.message}-${state?.count}`);
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { message: string };
        ActionPayloads: { UpdateMessage: { text: string } };
      }>(({ action: a }) => {
        parentAction = a;
        return {
          state: () => ({ message: "v1" }),
          actions: {
            UpdateMessage: (data, ctx) => ({
              state: { ...(ctx?.state ?? { message: "" }), message: data?.text ?? "" }
            })
          },
          view: ({ id, state }) => {
            return div(`#${id}.parent`, [child("#child", { message: state?.message || "" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls).toEqual([{ props: "v1", state: 0 }]);

      // Change child state
      childAction("Increment")(testKey);
      expect(viewCalls).toEqual([
        { props: "v1", state: 0 },
        { props: "v1", state: 1 }
      ]);

      // Change props from parent
      parentAction("UpdateMessage", { text: "v2" })(testKey);
      expect(viewCalls).toEqual([
        { props: "v1", state: 0 },
        { props: "v1", state: 1 },
        { props: "v2", state: 1 }
      ]);
    });
  });

  describe("Component Lifecycle Edge Cases", () => {
    it("should handle rapid sequential prop changes", () => {
      const viewCalls: string[] = [];
      let action: Function = () => {};

      const child = component<{
        Props: { value: string };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id, props }) => {
            viewCalls.push(props?.value || "");
            return div(`#${id}`, props?.value || "");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { value: string };
        ActionPayloads: { SetValue: { value: string } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ value: "v1" }),
          actions: {
            SetValue: (data, ctx) => ({
              state: { ...(ctx?.state ?? { value: "" }), value: data?.value ?? "" }
            })
          },
          view: ({ id, state }) => {
            return div(`#${id}.parent`, [child("#child", { value: state?.value || "" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls).toEqual(["v1"]);

      // Rapid prop changes
      action("SetValue", { value: "v2" })(testKey);
      action("SetValue", { value: "v3" })(testKey);
      action("SetValue", { value: "v4" })(testKey);

      expect(viewCalls).toEqual(["v1", "v2", "v3", "v4"]);
    });

    it("should handle undefined props becoming defined", () => {
      const viewCalls: Array<{ value?: string }> = [];
      let action: Function = () => {};

      const child = component<{
        Props: { value?: string };
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id, props }) => {
            viewCalls.push(props);
            return div(`#${id}`, props?.value || "empty");
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: { childProps: { value?: string } | undefined };
        ActionPayloads: { SetProps: { props: { value?: string } | undefined } };
      }>(({ action: a }) => {
        action = a;
        return {
          state: () => ({ childProps: undefined }),
          actions: {
            SetProps: (data, ctx) => ({
              state: { ...(ctx?.state ?? { childProps: undefined }), childProps: data?.props }
            })
          },
          view: ({ id, state }) => {
            return div(`#${id}.parent`, [child("#child", state?.childProps)]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls[0]).toEqual({});

      // Props become defined
      action("SetProps", { props: { value: "defined" } })(testKey);
      expect(viewCalls[1]).toEqual({ value: "defined" });

      // Props back to empty object (no longer undefined)
      action("SetProps", { props: undefined })(testKey);
      expect(viewCalls[2]).toEqual({});
    });
  });

  describe("Child init ActionThunk prop relay to parent", () => {
    it("should reflect relayed initial state in parent view on the first sync patch", async () => {
      // Scenario: a parent tracks an aggregate value from its children. Each child has
      // init: action("Relay") which fires an async task alongside a setTotal prop
      // callback in the same next array — the documented pattern for relaying initial
      // state upward.
      //
      // Without a fix, the parent view is called with its snapshot state at the start
      // of the view call. The child's Relay init fires setTotal during that call,
      // updating instance.state, but the view closure already holds the stale value.
      // stateChanged becomes true but is reset to false immediately after the patch so
      // no follow-up render fires until the async task eventually resolves.
      //
      // The fix: if stateChanged is true after the root view call, re-render before
      // patching so the DOM reflects the settled state in a single sync patch.

      const parentViewTotals: number[] = [];
      let triggerShow: Function = () => {};

      const child = component<{
        Props: { start: number; setTotal: (n: number) => ActionThunk };
        State: { value: number; feedback: string };
        ActionPayloads: { Relay: undefined; SetFeedback: { text: string } };
        TaskPayloads: { Validate: { value: number } };
      }>(({ action, task }) => ({
        state: (props) => ({ value: props.start, feedback: "" }),
        init: action("Relay"),
        actions: {
          Relay: (_, { state, props }) => ({
            state,
            next: [
              action("SetFeedback", { text: "Validating..." }),
              task("Validate", { value: state.value }),
              props.setTotal(state.value)
            ]
          }),
          SetFeedback: ({ text }, { state }) => ({
            state: text === state.feedback ? state : { ...state, feedback: text }
          })
        },
        tasks: {
          Validate: ({ value }) => ({
            perform: (): Promise<number> => Promise.resolve(value),
            success: () => action("SetFeedback", { text: "done" })
          })
        },
        view: ({ id, state }) => div(`#${id}`, String(state.value))
      }));

      const parent = component<{
        State: { showChild: boolean; total: number };
        ActionPayloads: { Show: undefined; SetTotal: { value: number } };
      }>(({ action: a }) => {
        triggerShow = a;
        return {
          state: () => ({ showChild: false, total: 0 }),
          actions: {
            Show: (_, { state }) => ({ state: { ...state, showChild: true } }),
            SetTotal: ({ value }, { state }) => ({
              state: value === state.total ? state : { ...state, total: value }
            })
          },
          view: ({ id, state }) => {
            parentViewTotals.push(state.total);
            return div(
              `#${id}`,
              state.showChild
                ? [child("#child", { start: -1, setTotal: (n) => a("SetTotal", { value: n }) })]
                : []
            );
          }
        };
      });

      mount({ app: parent, props: {} });
      patchSpy.mockClear();

      // Show the child — its Relay init fires an async task AND setTotal(-1) in
      // the same next array. Both are synchronous up to the task's Promise.
      triggerShow("Show")(testKey);

      // One sync patch should have fired
      expect(patchSpy).toHaveBeenCalledTimes(1);

      // Parent's view must have seen total=-1 in that patch — not waited for async
      expect(parentViewTotals[parentViewTotals.length - 1]).toBe(-1);

      // Validate task resolves → second patch for SetFeedback
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(patchSpy).toHaveBeenCalledTimes(2);

      // Total remains -1 after async resolution
      expect(parentViewTotals[parentViewTotals.length - 1]).toBe(-1);
    });
  });

  describe("State and Props Interaction", () => {
    it("should have access to both state and props in view", () => {
      const viewCalls: Array<{ props: string; state: number }> = [];
      let childAction: Function = () => {};

      const child = component<{
        Props: { label: string };
        State: { count: number };
        ActionPayloads: { Increment: undefined };
      }>(({ action: a }) => {
        childAction = a;
        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment: (_, ctx) => ({
              state: { ...(ctx?.state ?? { count: 0 }), count: (ctx?.state?.count ?? 0) + 1 }
            })
          },
          view: ({ id, props, state }) => {
            viewCalls.push({
              props: props?.label || "",
              state: state?.count || 0
            });
            return div(`#${id}`, `${props?.label}: ${state?.count}`);
          }
        };
      });

      const parent = component<{
        Props: Record<string, never>;
        State: Record<string, never>;
        Actions: Record<string, never>;
      }>(() => {
        return {
          state: () => ({}),
          actions: {},
          view: ({ id }) => {
            return div(`#${id}.parent`, [child("#child", { label: "Counter" })]);
          }
        };
      });

      mount({ app: parent, props: {} });
      expect(viewCalls).toEqual([{ props: "Counter", state: 0 }]);

      childAction("Increment")(testKey);
      expect(viewCalls).toEqual([
        { props: "Counter", state: 0 },
        { props: "Counter", state: 1 }
      ]);
    });
  });

  describe("Subscriptions", () => {
    it("should dispatch component-local actions via runAction", () => {
      let capturedRunAction: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { value: string };
        ActionPayloads: { Init: undefined; SetValue: { value: string } };
        SubscriptionPayloads: { Feed: undefined };
      }>(({ action: a, subscription: s }) => ({
        state: () => ({ value: "" }),
        init: a("Init"),
        actions: {
          Init: (_, { state }) => ({
            state,
            next: s("Feed")
          }),
          SetValue: ({ value }, { state }) => ({
            state: { ...state, value }
          })
        },
        subscriptions: {
          Feed: () => ({
            connect: (runAction) => {
              capturedRunAction = runAction;
              return () => {};
            }
          })
        },
        view: (ctx) => div(`#${ctx.id}`, ctx.state?.value ?? "")
      }));

      mount({ app: comp, props: {} });

      const instance = componentRegistry.get("app");
      expect(instance?.state).toEqual({ value: "" });

      capturedRunAction("SetValue", { value: "from-websocket" });
      expect(instance?.state).toEqual({ value: "from-websocket" });
    });

    it("should dispatch multiple actions from the same subscription", () => {
      let capturedRunAction: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { count: number; lastEvent: string };
        ActionPayloads: {
          Init: undefined;
          Increment: undefined;
          SetEvent: { name: string };
        };
        SubscriptionPayloads: { Listen: undefined };
      }>(({ action: a, subscription: s }) => ({
        state: () => ({ count: 0, lastEvent: "" }),
        init: a("Init"),
        actions: {
          Init: (_, { state }) => ({ state, next: s("Listen") }),
          Increment: (_, { state }) => ({
            state: { ...state, count: state.count + 1 }
          }),
          SetEvent: ({ name }, { state }) => ({
            state: { ...state, lastEvent: name }
          })
        },
        subscriptions: {
          Listen: () => ({
            connect: (runAction) => {
              capturedRunAction = runAction;
              return () => {};
            }
          })
        },
        view: (ctx) => div(`#${ctx.id}`, `${ctx.state?.count ?? 0}`)
      }));

      mount({ app: comp, props: {} });

      capturedRunAction("Increment");
      capturedRunAction("Increment");
      capturedRunAction("SetEvent", { name: "tick" });

      const instance = componentRegistry.get("app");
      expect(instance?.state).toEqual({ count: 2, lastEvent: "tick" });
    });

    it("should call cleanup on component unmount", () => {
      const cleanupSpy = vi.fn();
      let capturedRunAction: Function = () => {};

      const child = component<{
        Props: Record<string, never>;
        State: { value: number };
        ActionPayloads: { Init: undefined; Update: { value: number } };
        SubscriptionPayloads: { Stream: undefined };
      }>(({ action: a, subscription: s }) => ({
        state: () => ({ value: 0 }),
        init: a("Init"),
        actions: {
          Init: (_, { state }) => ({ state, next: s("Stream") }),
          Update: ({ value }, { state }) => ({ state: { ...state, value } })
        },
        subscriptions: {
          Stream: () => ({
            connect: (runAction) => {
              capturedRunAction = runAction;
              return cleanupSpy;
            }
          })
        },
        view: (ctx) => div(`#${ctx.id}`, `${ctx.state?.value ?? 0}`)
      }));

      const parent = component<{
        Props: Record<string, never>;
        State: { showChild: boolean };
        ActionPayloads: { HideChild: undefined };
      }>(() => ({
        state: () => ({ showChild: true }),
        actions: {
          HideChild: (_, { state }) => ({ state: { ...state, showChild: false } })
        },
        view: (ctx) => div(`#${ctx.id}`, ctx.state?.showChild ? child("#child", {}) : "-")
      }));

      let parentActionRef: Function = () => {};
      mount({
        app: parent,
        props: {},
        init: (runRootAction) => {
          parentActionRef = runRootAction;
        }
      });

      expect(componentRegistry.has("child")).toBe(true);
      expect(cleanupSpy).not.toHaveBeenCalled();

      // Unmount the child — cleanup should be called automatically
      parentActionRef("HideChild");
      expect(componentRegistry.has("child")).toBe(false);
      expect(cleanupSpy).toHaveBeenCalledTimes(1);

      // runAction from the old subscription should not throw
      expect(() => capturedRunAction("Update", { value: 99 })).not.toThrow();
    });

    it("should tear down old subscription before replacing", () => {
      const firstCleanup = vi.fn();
      const secondCleanup = vi.fn();
      const cleanups = [firstCleanup, secondCleanup];
      let connectCount = 0;

      const comp = component<{
        Props: Record<string, never>;
        State: { value: string };
        ActionPayloads: { Reconnect: undefined; SetValue: { value: string } };
        SubscriptionPayloads: { Feed: undefined };
      }>(({ subscription: s }) => ({
        state: () => ({ value: "" }),
        init: s("Feed"),
        actions: {
          Reconnect: (_, { state }) => ({ state, next: s("Feed") }),
          SetValue: ({ value }, { state }) => ({ state: { ...state, value } })
        },
        subscriptions: {
          Feed: () => ({
            connect: () => {
              return cleanups[connectCount++];
            }
          })
        },
        view: (ctx) => div(`#${ctx.id}`, ctx.state?.value ?? "")
      }));

      let rootActionRef: Function = () => {};
      mount({
        app: comp,
        props: {},
        init: (runRootAction) => {
          rootActionRef = runRootAction;
        }
      });

      // First subscription connected via init
      expect(connectCount).toBe(1);
      expect(firstCleanup).not.toHaveBeenCalled();

      // Re-subscribe — old cleanup runs, then new connect runs
      rootActionRef("Reconnect");
      expect(firstCleanup).toHaveBeenCalledTimes(1);
      expect(connectCount).toBe(2);
      expect(secondCleanup).not.toHaveBeenCalled();
    });

    it("should render state change when subscription returned as next from post-mount action", () => {
      let actionRef: Function = () => {};

      const comp = component<{
        Props: Record<string, never>;
        State: { visible: boolean };
        ActionPayloads: { Show: undefined };
        SubscriptionPayloads: { Listen: undefined };
      }>(({ action: a, subscription: s }) => ({
        state: () => ({ visible: false }),
        actions: {
          Show: (_, { state }) => ({
            state: { ...state, visible: true },
            next: s("Listen")
          })
        },
        subscriptions: {
          Listen: () => ({
            connect: () => () => {}
          })
        },
        view: (ctx) => {
          actionRef = a;
          return div(`#${ctx.id}`, ctx.state.visible ? "visible" : "hidden");
        }
      }));

      mount({ app: comp, props: {} });

      const instance = componentRegistry.get("app");
      expect(instance?.state).toEqual({ visible: false });

      actionRef("Show")(testKey);

      expect(instance?.state).toEqual({ visible: true });
      // State changed but render was skipped — vnode still shows stale content
      expect(instance?.vnode?.text).toBe("visible");
    });
  });
});
