/*
API for unit testing components

- Initialise component test API
import counter from "./counter";
const { initialState, actionTest, taskTest, config } = componentTest(counter, { start: 0 });

- Test an action: outputs `state` and `next` results as data
const { state, next } = actionTest("Increment", { step: 1 });

- Test an action with custom state
const { state, next } = actionTest("Increment", { step: 1 }, { state: { count: 5 } });

- Test an action with rootState or event
const { state, next } = actionTest("HandleSubmit", {}, {
  state: customState,
  rootState: { theme: "dark" },
  event: mockEvent
});

- Test a task: returns `success` and `failure` callbacks for tests to invoke
const { perform, success, failure } = taskTest("ValidateCount", { count: 0 });
const { name, data } = success({ text: "Test" });
*/
import { Component, Config, Context, GetConfig } from "./cr-26.types";

// Options for testing actions with custom context
// Note: Props are set during component initialization and cannot be overridden per-action
export type ActionTestOptions<TState, TRootState> = {
  // Override the component state for this test (defaults to initialState)
  state?: TState;
  // Provide rootState for components that access it
  rootState?: TRootState;
  // Provide a DOM event for actions that access event context
  event?: Event;
};

export type NextData = {
  name: string;
  data?: Record<string, unknown>;
};

export type ComponentTestApi<
  TComponent extends Component,
  TState = Record<string, unknown>,
  TRootState = Record<string, unknown>
> = {
  config: Config<TComponent>;
  initialState: TState;
  actionTest: <TActionState = TState>(
    name: string,
    data?: Record<string, unknown>,
    options?: ActionTestOptions<TActionState, TRootState>
  ) => { state: TActionState; next?: NextData | NextData[] };
  taskTest: (name: string, data?: Record<string, unknown>) => TaskTestSpec;
};

export type TaskTestSpec<
  TProps = Record<string, unknown>,
  TState = Record<string, unknown>,
  TRootState = Record<string, unknown>
> = {
  perform: () => Promise<unknown> | void;
  success?: (
    result?: unknown,
    ctx?: Context<TProps, TState, TRootState>
  ) => NextData | NextData[] | undefined;
  failure?: (
    error?: unknown,
    ctx?: Context<TProps, TState, TRootState>
  ) => NextData | NextData[] | undefined;
};

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type TestHandlers = Partial<{ [key: string]: Function }>;

// Returns next action/task inputs as data
const nextToData = (name: string, data?: Record<string, unknown>): NextData => ({ name, data });

export const componentTest = <TComponent extends Component>(
  component: { getConfig: GetConfig<TComponent> },
  props?: TComponent["Props"]
): ComponentTestApi<TComponent, TComponent["State"], TComponent["RootState"]> => {
  // Initialise component passing in `nextToData()` instead of `action()` and `task()` functions
  const config = component.getConfig({
    // @ts-expect-error test api
    action: nextToData,
    // @ts-expect-error test api
    task: nextToData,
    // @ts-expect-error test api
    rootAction: nextToData,
    // @ts-expect-error test api
    rootTask: nextToData
  });
  const initialState = config.state?.(props);

  return {
    // Output from the callback passed into `component(...)`
    config,

    // For comparing state changes
    initialState,

    actionTest<TState, TRootState = Record<string, unknown>>(
      name: string,
      data?: Record<string, unknown>,
      options?: ActionTestOptions<TState, TRootState>
    ): { state: TState; next?: NextData | NextData[] } {
      const actions: TestHandlers = config.actions || {};

      // Returns any next operations as data
      return actions[name]?.(data, {
        props: props ?? {},
        state: options?.state !== undefined ? options.state : (initialState ?? {}),
        rootState: options?.rootState ?? {},
        event: options?.event
      });
    },

    // Get task spec for manually testing `success` and `failure` output
    taskTest(name: string, data?: Record<string, unknown>): TaskTestSpec {
      const tasks: TestHandlers = config.tasks || {};

      // Returns task spec
      return tasks[name]?.(data);
    }
  };
};

export const expectOne = <T>(item?: T | T[]): T => {
  if (!item || Array.isArray(item)) {
    throw new Error(`Expected a single item, received: ${JSON.stringify(item)}`);
  }
  return item;
};

export const expectArray = <T>(items?: T | T[]): T[] => {
  if (!Array.isArray(items)) {
    throw new Error(`Expected an array, received: ${JSON.stringify(items)}`);
  }
  return items;
};
