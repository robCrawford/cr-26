import { vi } from "vitest";
import { _setTestKey, component, html, mount } from "./cr-26";
import * as vdom from "./vdom";
const { div } = html;
const testKey = _setTestKey({});

const patchSpy = vi.spyOn(vdom, "patch");

describe("RootState with Memoization", () => {
  let rootAction: Function;
  let childAction: Function;
  let childActionCallCount = 0;

  // Track what rootState the child action handler saw
  let seenRootStates: Record<string, unknown>[] = [];

  beforeEach(() => {
    patchSpy.mockClear();
    childActionCallCount = 0;
    seenRootStates = [];

    // Initialise app
    const appEl = document.createElement("div");
    appEl.setAttribute("id", "app");
    document.body.innerHTML = "";
    document.body.appendChild(appEl);

    const child = component<{
      Props: Record<string, never>;
      State: { count: number };
      ActionPayloads: {
        Increment: { step: number };
      };
      RootState: { theme: string };
    }>(({ action: a }) => {
      childAction = a;
      return {
        state: () => ({ count: 0 }),
        actions: {
          // This action captures what rootState it sees
          Increment: (data, ctx) => {
            childActionCallCount++;
            seenRootStates.push(ctx?.rootState ?? {});
            const state = ctx?.state ?? { count: 0 };
            const step = data?.step ?? 0;
            return { state: { ...state, count: state.count + step } };
          }
        },
        view: (ctx) => div(`#${ctx.id}`, `Count: ${ctx.state?.count ?? 0}`)
      };
    });

    const app = component<{
      Props: Record<string, never>;
      State: { theme: string };
      ActionPayloads: {
        SetTheme: { theme: string };
      };
    }>(({ action: a }) => {
      rootAction = a;
      return {
        state: () => ({ theme: "light" }),
        actions: {
          SetTheme: (data, ctx) => {
            const state = ctx?.state ?? { theme: "light" };
            const theme = data?.theme ?? "light";
            return { state: { ...state, theme } };
          }
        },
        view: (id) => div(`#${id}`, [child(`#child`, {})])
      };
    });

    mount({ app, props: {} });
    patchSpy.mockClear();
  });

  it("should pass updated rootState to cached action thunks", () => {
    // Get a cached thunk reference - call childAction with same params
    const thunk1 = childAction("Increment", { step: 1 });
    const thunk2 = childAction("Increment", { step: 1 });

    // Verify they're the same cached thunk
    expect(thunk1).toBe(thunk2);

    // Execute the first time - should see initial rootState
    thunk1(testKey);
    expect(childActionCallCount).toBe(1);
    expect(seenRootStates[0]).toEqual({ theme: "light" });

    // Change root state
    rootAction("SetTheme", { theme: "dark" })(testKey);

    // Execute the SAME cached thunk again - should see NEW rootState
    thunk2(testKey);
    expect(childActionCallCount).toBe(2);
    expect(seenRootStates[1]).toEqual({ theme: "dark" });

    // Verify both executions saw different rootStates
    expect(seenRootStates[0]).not.toEqual(seenRootStates[1]);
  });

  it("should handle rootState and state in task success callbacks with cached thunks", () => {
    let taskRootState: Record<string, unknown> | null = null;
    let taskState: Record<string, unknown> | null = null;
    let childTask: Function = () => {};
    let childAction: Function = () => {};
    let resolveTask: ((value: number) => void) | undefined;

    const child = component<{
      Props: Record<string, never>;
      State: { count: number };
      ActionPayloads: {
        SetCount: { count: number };
      };
      TaskPayloads: {
        DelayedIncrement: { step: number };
      };
      RootState: { theme: string };
    }>(({ task: t, action: a }) => {
      childTask = t;
      childAction = a;
      return {
        state: () => ({ count: 0 }),
        actions: {
          SetCount: (data, ctx) => ({
            state: { ...ctx.state, count: data?.count ?? 0 }
          })
        },
        tasks: {
          DelayedIncrement: () => ({
            // Externally controlled promise so state can change while in-flight
            perform: () =>
              new Promise<number>((resolve) => {
                resolveTask = resolve;
              }),
            success: (_, ctx) => {
              taskRootState = ctx.rootState;
              taskState = ctx.state;
              return undefined;
            }
          })
        },
        view: (ctx) => div(`#${ctx.id}`, `Count: ${ctx.state?.count ?? 0}`)
      };
    });

    const app = component<{
      Props: Record<string, never>;
      State: { theme: string };
      ActionPayloads: {
        SetTheme: { theme: string };
      };
    }>(({ action: a }) => {
      rootAction = a;
      return {
        state: () => ({ theme: "light" }),
        actions: {
          SetTheme: (data, ctx) => {
            const state = ctx?.state ?? { theme: "light" };
            const theme = data?.theme ?? "light";
            return { state: { ...state, theme } };
          }
        },
        view: (id) => div(`#${id}`, [child(`#child`, {})])
      };
    });

    // Reset app with task-based child
    const appEl = document.createElement("div");
    appEl.setAttribute("id", "app");
    document.body.innerHTML = "";
    document.body.appendChild(appEl);
    mount({ app, props: {} });
    patchSpy.mockClear();

    const taskThunk = childTask("DelayedIncrement", { step: 1 });

    // Start the async task — perform is now waiting
    const taskPromise = taskThunk(testKey);

    // Change rootState and child state while the task is in-flight
    rootAction("SetTheme", { theme: "dark" })(testKey);
    childAction("SetCount", { count: 42 })(testKey);

    // Resolve the task — success callback should see current state, not stale snapshot
    resolveTask?.(1);

    return taskPromise.then(() => {
      expect(taskRootState).toEqual({ theme: "dark" });
      expect(taskState).toEqual({ count: 42 });
    });
  });
});
