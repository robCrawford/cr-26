import { vi } from "vitest";
import {
  component,
  renderComponent,
  _setTestKey,
  html,
  VNode,
  withEventOptions,
  actionThunkCache
} from "./cr-26";
import * as vdom from "./vdom";
import { log } from "./log";
import { ActionHandler, ActionThunk, Context, GetActionThunk } from "./cr-26.types";
import { componentTest } from "./component-test";
const { div } = html;

const patchSpy = vi.spyOn(vdom, "patch");
const renderSpy = vi.spyOn(log, "render");
const testKey = _setTestKey({});

describe("cr-26", () => {
  let state: { count: number };
  let action: GetActionThunk<Record<string, unknown>>;
  let componentId = 0;
  const getId = () => `_${componentId++}`;

  function view(ctx: Context<unknown, { count: number }, unknown>): VNode {
    state = ctx.state ?? { count: 0 };
    return div(`#${ctx.id}`, "Test");
  }

  beforeEach(() => {
    patchSpy.mockClear();
    renderSpy.mockClear();

    // Set up DOM element for patching
    document.body.innerHTML = "";
  });

  it("should render and patch once following a chain of actions", () => {
    const numTestActions = 20;

    const id = getId();
    const initialVnode = renderComponent<{
      State: { count: number };
      ActionPayloads: Record<string, unknown>;
    }>(id, ({ action: a }) => {
      action = a;
      const actions: Record<
        string,
        ActionHandler<unknown, unknown, { count: number }, unknown>
      > = {};

      for (let i = 1; i < numTestActions; i++) {
        actions[`Increment${i}`] = (_, { state }: { state: { count: number } }) => {
          return {
            state: { ...state, count: state.count + 1 },
            next: action(`Increment${i + 1}`)
          };
        };
      }
      actions[`Increment${numTestActions}`] = (_, { state }: { state: { count: number } }) => {
        return {
          state: { ...state, count: state.count + 1 }
        };
      };

      return {
        state: () => ({ count: 0 }),
        actions,
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement("div");
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);

    patchSpy.mockClear(); // Clear the initial render and patch
    renderSpy.mockClear();
    action("Increment1")(testKey);
    logResult(state.count, renderSpy.mock.calls.length, patchSpy.mock.calls.length);
    expect(state.count).toBe(numTestActions);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should render and patch once following an array of actions", () => {
    const numTestActions = 20;

    const id = getId();
    const initialVnode = renderComponent<{
      State: { count: number };
      ActionPayloads: Record<string, unknown>;
    }>(id, ({ action: a }) => {
      action = a;
      const actions: Record<
        string,
        ActionHandler<unknown, unknown, { count: number }, unknown>
      > = {};
      const incrementRetActions: ActionThunk[] = [];

      for (let i = 1; i <= numTestActions; i++) {
        actions[`Increment${i}`] = (_, { state }: { state: { count: number } }) => {
          return {
            state: { ...state, count: state.count + 1 }
          };
        };
        incrementRetActions.push(action(`Increment${i}`));
      }
      actions["Increment"] = (_, { state }: { state: { count: number } }) => ({
        state,
        next: incrementRetActions
      });

      return {
        state: () => ({ count: 0 }),
        actions,
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement("div");
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);

    patchSpy.mockClear(); // Clear the initial render and patch
    renderSpy.mockClear();
    action("Increment")(testKey);
    logResult(state.count, renderSpy.mock.calls.length, patchSpy.mock.calls.length);
    expect(state.count).toBe(numTestActions);
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should render and patch twice when a chain of actions contains a promise", () => {
    const numTestActions = 20;
    return new Promise<void>((resolve) => {
      runActionsWithPromise(numTestActions, 2, resolve);
      expect(patchSpy).not.toHaveBeenCalled();
      action("Increment1")(testKey);
    });
  });

  it("should render and patch once when initial action chain contains a promise", () => {
    const numTestActions = 20;
    return new Promise<void>((resolve) => {
      runActionsWithPromise(numTestActions, 1, resolve, "Increment1"); // 1 patch after promise
      expect(patchSpy).not.toHaveBeenCalled(); // No patch after init
    });
  });

  function runActionsWithPromise(
    numTestActions: number,
    expectedPatchCount: number,
    done: () => void,
    initialAction?: string
  ) {
    const id = getId();
    const initialVnode = renderComponent<{
      State: { count: number };
      ActionPayloads: Record<string, unknown>;
      TaskPayloads: Record<string, unknown>;
    }>(id, ({ action: a, task }) => {
      action = a;
      const actions: Record<
        string,
        ActionHandler<unknown, unknown, { count: number }, unknown>
      > = {};

      for (let i = 1; i < numTestActions; i++) {
        actions[`Increment${i}`] = (_, { state }: { state: { count: number } }) => {
          return {
            state: { ...state, count: state.count + 1 },
            next: action(`Increment${i + 1}`)
          };
        };
      }
      actions[`Increment${numTestActions}`] = (_, { state }: { state: { count: number } }) => {
        const newState = { ...state, count: state.count + 1 };
        setTimeout(() => {
          // After last action has been processed
          logResult(newState.count, renderSpy.mock.calls.length, patchSpy.mock.calls.length);
          expect(newState.count).toBe(numTestActions);
          expect(renderSpy).toHaveBeenCalledTimes(expectedPatchCount);
          expect(patchSpy).toHaveBeenCalledTimes(expectedPatchCount);
          done();
        });
        return {
          state: newState
        };
      };

      // Overwrite middle action with task
      const midIndex = numTestActions / 2;
      actions[`Increment${midIndex}`] = (_, { state }: { state: { count: number } }) => {
        return {
          state: { ...state, count: state.count + 1 },
          next: task("TestAsync")
        };
      };

      return {
        state: () => ({ count: 0 }),
        init: initialAction ? a(initialAction) : undefined,
        actions,
        tasks: {
          TestAsync: () => ({
            perform: () => new Promise<void>((resolve) => setTimeout(() => resolve(), 100)),
            success: () => action(`Increment${midIndex + 1}`)
          })
        },
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement("div");
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);
    patchSpy.mockClear(); // Clear the initial render and patch
    renderSpy.mockClear();
  }

  it("should render and patch twice when a promise returns an array of actions", () => {
    return new Promise<void>((resolve) => {
      const id = getId();
      const initialVnode = renderComponent<{
        State: { count: number };
        ActionPayloads: Record<string, unknown>;
        TaskPayloads: Record<string, unknown>;
      }>(id, ({ action: a, task }) => {
        action = a;

        return {
          state: () => ({ count: 0 }),
          actions: {
            Increment1: (_, ctx) => {
              return {
                state: { ...ctx.state, count: ctx.state.count + 1 },
                next: task("TestAsync")
              };
            },
            Increment2: (_, ctx) => {
              return {
                state: { ...ctx.state, count: ctx.state.count + 1 }
              };
            },
            Increment3: (_, ctx) => {
              const newState = { ...ctx.state, count: ctx.state.count + 1 };
              setTimeout(() => {
                // After last action has been processed
                logResult(newState.count, renderSpy.mock.calls.length, patchSpy.mock.calls.length);
                expect(newState.count).toBe(3);
                expect(renderSpy).toHaveBeenCalledTimes(2);
                expect(patchSpy).toHaveBeenCalledTimes(2);
                resolve();
              });
              return {
                state: newState
              };
            }
          },
          tasks: {
            TestAsync: () => ({
              perform: () => new Promise<void>((resolve) => setTimeout(() => resolve(), 100)),
              success: () => [action("Increment2"), action("Increment3")]
            })
          },
          view
        };
      });

      // Patch initial vnode to DOM
      const container = document.createElement("div");
      document.body.appendChild(container);
      vdom.patch(container, initialVnode);

      patchSpy.mockClear(); // Clear the initial render and patch
      renderSpy.mockClear();
      action("Increment1")(testKey);
    });
  });

  it("should render and patch once following a mix of action arrays and chains", () => {
    const numTestActions = 20; // Must be even due to `i % 2`

    expect(patchSpy).not.toHaveBeenCalled();
    runMixedActions(numTestActions);
    action("IncrementA2-Init")(testKey);

    logResult(state.count, renderSpy.mock.calls.length, patchSpy.mock.calls.length);
    expect(state.count).toBe(getMixedActionsIncr(numTestActions));
    expect(renderSpy).toHaveBeenCalledTimes(1);
    expect(patchSpy).toHaveBeenCalledTimes(1);
  });

  it("should not render or patch when initial action is a mix of arrays and chains", () => {
    const numTestActions = 20; // Must be even due to `i % 2`

    expect(patchSpy).not.toHaveBeenCalled();
    runMixedActions(numTestActions, "IncrementA2-Init");

    logResult(state.count, renderSpy.mock.calls.length, patchSpy.mock.calls.length);
    expect(state.count).toBe(getMixedActionsIncr(numTestActions));
    expect(renderSpy).not.toHaveBeenCalled();
    expect(patchSpy).not.toHaveBeenCalled();
  });

  function runMixedActions(numTestActions: number, initialAction?: string) {
    const id = getId();
    const initialVnode = renderComponent<{
      State: { count: number };
      ActionPayloads: Record<string, unknown>;
    }>(id, ({ action: a }) => {
      action = a;
      const actions: Record<
        string,
        ActionHandler<unknown, unknown, { count: number }, unknown>
      > = {};
      const actionsArray1: ActionThunk[] = [];
      const actionsArray2: ActionThunk[] = [];

      // Array of single increment actions that return nothing
      for (let i = 1; i <= numTestActions; i++) {
        actions[`IncrementA1-${i}`] = (_, ctx) => {
          return {
            state: { ...ctx.state, count: ctx.state.count + 1 }
          };
        };
        actionsArray1.push(action(`IncrementA1-${i}`));
      }
      // Series of increment actions "IncrementS1-1" - "IncrementS1-19"
      for (let i = 1; i < numTestActions; i++) {
        actions[`IncrementS1-${i}`] = (_, ctx) => {
          return {
            state: { ...ctx.state, count: ctx.state.count + 1 },
            next: action(`IncrementS1-${i + 1}`)
          };
        };
      }
      actions[`IncrementS1-${numTestActions}`] = (_, ctx) => {
        // "IncrementS1-20" returns `actionsArray1` array
        return {
          state: { ...ctx.state, count: ctx.state.count + 1 },
          next: actionsArray1
        };
      };
      // Series of increment actions "IncrementS2-1" - "IncrementS2-10"
      for (let i = 1; i < numTestActions / 2; i++) {
        actions[`IncrementS2-${i}`] = (_, ctx) => {
          return {
            state: { ...ctx.state, count: ctx.state.count + 1 },
            next: action(`IncrementS2-${i + 1}`)
          };
        };
      }
      actions[`IncrementS2-${numTestActions / 2}`] = (_, ctx) => {
        return { state: { ...ctx.state, count: ctx.state.count + 1 } };
      };

      // "IncrementA2-Init" returns `actionsArray2` array
      for (let i = 1; i <= numTestActions; i++) {
        actions[`IncrementA2-${i}`] = (_, ctx) => {
          // Half return chain "IncrementS1-1" - "IncrementS1-20",
          // where "IncrementS1-20" returns `actionsArray1`
          if (i % 2) {
            return {
              state: { ...ctx.state, count: ctx.state.count + 1 },
              next: action("IncrementS1-1")
            };
          }
          // Half return chain "IncrementS2-1" - "IncrementS2-10"
          else {
            return {
              state: { ...ctx.state, count: ctx.state.count + 1 },
              next: action("IncrementS2-1")
            };
          }
        };
        actionsArray2.push(action(`IncrementA2-${i}`));
      }
      actions["IncrementA2-Init"] = (_, ctx) => ({
        state: ctx.state,
        next: actionsArray2
      });

      return {
        state: () => ({ count: 0 }),
        init: initialAction ? a(initialAction) : undefined,
        actions,
        view
      };
    });

    // Patch initial vnode to DOM
    const container = document.createElement("div");
    document.body.appendChild(container);
    vdom.patch(container, initialVnode);
    patchSpy.mockClear(); // Clear the initial render and patch
    renderSpy.mockClear();
  }

  function getMixedActionsIncr(numTestActions: number) {
    const array1Incr = numTestActions;
    const series1Incr = numTestActions + array1Incr;
    const series2Incr = numTestActions / 2;
    const array2Incr =
      numTestActions + (numTestActions / 2) * series1Incr + (numTestActions / 2) * series2Incr;
    return array2Incr;
  }

  function logResult(numActions: number, renderCount: number, patchCount: number): void {
    console.log(
      `Completed ${numActions} actions with ${renderCount} render${renderCount === 1 ? "" : "s"} and ${patchCount} patch${patchCount === 1 ? "" : "es"}`
    );
  }

  describe("event context", () => {
    it("should pass DOM event to action handler context", () => {
      let capturedEvent: Event | undefined;
      let action: GetActionThunk<{ Click: undefined }>;

      renderComponent<{ State: { clicked: boolean }; ActionPayloads: { Click: undefined } }>(
        getId(),
        ({ action: a }) => {
          action = a;
          return {
            state: () => ({ clicked: false }),
            actions: {
              Click: (_, ctx) => {
                capturedEvent = ctx?.event;
                return { state: { clicked: true } };
              }
            },
            view: ({ id }) => div(`#${id}`, "test")
          };
        }
      );

      // Create a mock DOM event
      const mockEvent = new Event("click");
      Object.defineProperty(mockEvent, "eventPhase", { value: 1 });
      Object.defineProperty(mockEvent, "target", { value: null });
      Object.defineProperty(mockEvent, "type", { value: "click" });

      // Trigger action with event (simulating DOM click)
      // @ts-expect-error test data
      action("Click")(mockEvent);

      // Verify event was passed to context
      expect(capturedEvent).toBeDefined();
      expect(capturedEvent).toBe(mockEvent);
    });
  });

  describe("withEventOptions", () => {
    function makeEvent(): Event {
      const e = new Event("click");
      Object.defineProperty(e, "target", { value: null });
      return e;
    }

    function makeComponent(): {
      action: GetActionThunk<{ Click: undefined }>;
      capturedEvent: () => Event | undefined;
    } {
      let action: GetActionThunk<{ Click: undefined }>;
      let capturedEvent: Event | undefined;

      renderComponent<{ State: { clicked: boolean }; ActionPayloads: { Click: undefined } }>(
        getId(),
        ({ action: a }) => {
          action = a;
          return {
            state: () => ({ clicked: false }),
            actions: {
              Click: (_, ctx) => {
                capturedEvent = ctx?.event;
                return { state: { clicked: true } };
              }
            },
            view: ({ id }) => div(`#${id}`, "test")
          };
        }
      );

      // @ts-expect-error assigned in renderComponent callback
      return { action, capturedEvent: () => capturedEvent };
    }

    it("should call preventDefault when option is set", () => {
      const { action } = makeComponent();
      const mockEvent = makeEvent();
      const preventDefaultSpy = vi.spyOn(mockEvent, "preventDefault");

      withEventOptions(action("Click"), { preventDefault: true })(mockEvent);

      expect(preventDefaultSpy).toHaveBeenCalledOnce();
    });

    it("should call stopPropagation when option is set", () => {
      const { action } = makeComponent();
      const mockEvent = makeEvent();
      const stopPropagationSpy = vi.spyOn(mockEvent, "stopPropagation");

      withEventOptions(action("Click"), { stopPropagation: true })(mockEvent);

      expect(stopPropagationSpy).toHaveBeenCalledOnce();
    });

    it("should call stopImmediatePropagation when option is set", () => {
      const { action } = makeComponent();
      const mockEvent = makeEvent();
      const stopImmediateSpy = vi.spyOn(mockEvent, "stopImmediatePropagation");

      withEventOptions(action("Click"), { stopImmediatePropagation: true })(mockEvent);

      expect(stopImmediateSpy).toHaveBeenCalledOnce();
    });

    it("should call all methods when all options are set", () => {
      const { action } = makeComponent();
      const mockEvent = makeEvent();
      const preventDefaultSpy = vi.spyOn(mockEvent, "preventDefault");
      const stopPropagationSpy = vi.spyOn(mockEvent, "stopPropagation");
      const stopImmediateSpy = vi.spyOn(mockEvent, "stopImmediatePropagation");

      withEventOptions(action("Click"), {
        preventDefault: true,
        stopPropagation: true,
        stopImmediatePropagation: true
      })(mockEvent);

      expect(preventDefaultSpy).toHaveBeenCalledOnce();
      expect(stopPropagationSpy).toHaveBeenCalledOnce();
      expect(stopImmediateSpy).toHaveBeenCalledOnce();
    });
  });

  describe("thunk cache eviction", () => {
    it("should not retain stale action thunk cache entries after re-render with new data", () => {
      let selectedId = 0;
      const id = getId();

      const initialVnode = renderComponent<{
        State: { selectedId: number };
        ActionPayloads: { Select: { itemId: number } };
      }>(id, ({ action: a }) => ({
        state: () => ({ selectedId: 0 }),
        actions: {
          Select: ({ itemId }, { state }) => ({
            state: { ...state, selectedId: itemId }
          })
        },
        view: (ctx): VNode => {
          selectedId = ctx.state.selectedId;
          // Each render creates a thunk with a different data payload
          a("Select", { itemId: selectedId + 1 });
          return div(`#${ctx.id}`, `Selected: ${selectedId}`);
        }
      }));

      const container = document.createElement("div");
      document.body.appendChild(container);
      vdom.patch(container, initialVnode);

      const cacheEntriesForComponent = (): number =>
        Array.from(actionThunkCache.keys()).filter((key) => key.startsWith(`${id}:`)).length;

      // After initial render, one entry for Select:{itemId:1}
      const initialEntries = cacheEntriesForComponent();

      // Trigger multiple re-renders with different data payloads
      for (let iter = 0; iter < 50; iter++) {
        const actionThunk = actionThunkCache.get(
          `${id}:Select:${JSON.stringify({ itemId: selectedId + 1 })}`
        );
        if (actionThunk) {
          actionThunk(testKey);
        }
      }

      // After 50 renders, each with a unique payload, stale entries should be cleaned up.
      // Only thunks from the most recent render should remain.
      const finalEntries = cacheEntriesForComponent();
      expect(finalEntries).toBeLessThan(initialEntries + 50);
    });
  });

  describe("actionTest id option", () => {
    const captureId = component<{
      State: Readonly<{ id: string }>;
      ActionPayloads: Readonly<{ Capture: undefined }>;
    }>(() => ({
      state: () => ({ id: "" }),
      actions: {
        Capture: (__, { id, state }): { state: { id: string } } => ({ state: { ...state, id } })
      },
      view: ({ id }): VNode => div(`#${id}`, "")
    }));

    const { actionTest } = componentTest(captureId, {});

    it("should pass custom id to action context", () => {
      const { state } = actionTest("Capture", undefined, { id: "custom-id" });
      expect(state.id).toBe("custom-id");
    });
  });
});
