# cr-26

> **⚠️ Status:** `Experimental (0.x)` ⚠️  
> This library was created primarily for personal experimentation and use 

TypeScript components made with pure functions

- Declarative actions with deferred effects - allows [testing without mocks](https://www.youtube.com/watch?v=6EdXaWfoslc)
- Data flow inspired by [The Elm Architecture](https://guide.elm-lang.org/architecture/), see also [Redux similarities](#redux-similarities) below
- Uses [Snabbdom VDOM](https://github.com/snabbdom/snabbdom) with optimizations to [minimize unnecessary renders](https://github.com/robCrawford/cr-26/blob/master/src/cr-26.spec.ts)
- [AGENTS.md](./AGENTS.md) - Readme for AI

### Examples

> - [Single page app demo](https://robcrawford.github.io/demos/cr-26/spa/?debug=console) _[[source]](https://github.com/robCrawford/cr-26/tree/master/examples/spa)_
> - Hello World _[[source]](https://github.com/robCrawford/cr-26/tree/master/examples/hello-world)_

🛠️ 

# Components

### Actions and tasks

`component(...)` takes a function which receives `action` and `task` functions.

These are called to create thunks for the framework to execute — thunks are passed as values and should not be called directly:

```JavaScript
export default component(
  ({ action, task, rootAction, rootTask }) => ({
    // Initial action
    init: action( "ShowMessage", { text: "Hello World!" } ),
  })
);
```

When an action thunk runs, its handler returns new state and any next actions/tasks *(see `Hello World` below)*.

Task thunks provide handlers for effects and async operations that may fail.

### Props and state

The `view` function receives a context input with `id`, `props`, `state` and `rootState` for rendering:

```JavaScript
view({ id, props, state, rootState }) {
  return div(`#${id}-message`, [
    // Render from props and state
    h1(props.title),
    div(state.text)
  ]);
}
```

Action handlers and the `success` and `failure` callbacks of tasks also receive a similar context input.

To access `rootState` in a component, add `RootState` to its `Component` type:

```typescript
type Component = {
  State: Readonly<{ count: number }>;
  RootState: RootState; // Sets types for rootState in callbacks
};
```

### Root type naming convention

By convention, types exported from the root component are prefixed with `Root` — e.g. `RootState`, `RootActionPayloads`, `RootTaskPayloads`. This prefix makes them easy to identify at a glance anywhere they are imported and used in child components.

### Hello World!

```JavaScript
import { component, html, mount } from "cr-26";
import { setDocTitle } from "./services/browser";
const { h3, div } = html;

export type Props = Readonly<{
  date: string;
}>;

export type State = Readonly<{
  title: string;
  text: string;
  done: boolean;
}>;

export type ActionPayloads = Readonly<{
  ShowMessage: { text: string };
  PageReady: { done: boolean };
}>;

export type TaskPayloads = Readonly<{
  SetDocTitle: { title: string };
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
  TaskPayloads: TaskPayloads;
};

const app = component<Component>(({ action, task }) => ({

  // Initial state
  state: (props) => ({
    title: `Welcome! ${props.date}`,
    text: "",
    done: false
  }),

  // Initial action
  init: action("ShowMessage", { text: "Hello World!" }),

  // Action handlers return new state, and any next actions/tasks
  actions: {
    ShowMessage: (data, context) => {
      return {
        state: {
          ...context.state,
          text: data.text
        },
        next: task("SetDocTitle", { title: data.text })
      };
    },
    PageReady: (data, context) => {
      return {
        state: {
          ...context.state,
          done: data.done
        }
      };
    }
  },

  // Task handlers provide callbacks for effects and async operations that may fail
  tasks: {
    SetDocTitle: (data) => ({
      perform: () => setDocTitle(data.title),
      success: () => action("PageReady", { done: true }),
      failure: () => action("PageReady", { done: false })
    })
  },

  // View renders from props & state
  view({ id, state }) {
    return div(`#${id}-message`, [
      h3(state.title),
      div(state.text),
      div(state.done ? "✅" : "❎")
    ]);
  }
}));

document.addEventListener("DOMContentLoaded", () =>
  mount({ app, props: { date: new Date().toDateString() } })
);

export default app;
```

### DOM Events

An `event` prop is added to the action handler context input when run from the DOM

```JavaScript
    actions: {
      Input: (_, { props, state, event }) => ({
        state: {
          ...state,
          text: event?.target?.value ?? ""
        }
      })
    },
    view: (id, { state }) =>
      html.input(`#${id}-input`, {
        props: { value: state.text },
        on: { input: action("Input") }
      })
```

## Redux DevTools Integration

`cr-26` automatically integrates with [Redux DevTools](https://github.com/reduxjs/redux-devtools) browser extension for enhanced debugging:

- **Action History** - See all actions fired with their payloads
- **State Inspector** - View component states in a tree structure
- **State Diff** - Automatically see what changed with each action
- **Task Tracking** - Monitor async operations (success/failure)

Redux DevTools logging is automatic when the extension is installed.

## Additional logging

Detailed lifecycle logging is also available in the browser console.

- Add `?debug=console` to the URL to log state updates, renders, and DOM patches

- Errors and custom logs will be located at their point in the lifecycle

## Unit tests

For unit testing, `actionTest`/`taskTest` utilities allow testing without mocks, by returning plain data:

```JavaScript
import { componentTest, expectOne } from "cr-26/test";
import app, { State } from "./app";

describe("App", () => {

  const { actionTest, taskTest, config, initialState } = componentTest(app, { placeholder: "placeholder" });

  it("should set initial state", () => {
    expect(initialState).toEqual({ text: "placeholder", done: false });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({
      name: "ShowMessage",
      data: { text: "Hello World!" }
    });
  });

  describe("'ShowMessage' action", () => {
    const { state, next } = actionTest<State>("ShowMessage", { text: "Hello World!"});

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        text: "Hello World!"
      });
    });

    it("should return next", () => {
      const { name, data } = expectOne(next);
      expect(name).toBe("SetDocTitle");
      expect(data).toEqual({ title: "Hello World!" });
    });
  });

  describe("'SetDocTitle' task", () => {
    const { perform, success, failure } = taskTest("SetDocTitle", { title: "test" });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should handle success", () => {
      const { name, data } = expectOne(success());
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: true });
    });

    it("should handle failure", () => {
      const { name, data } = expectOne(failure());
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: false });
    });
  });

});
```

### Testing Actions with Custom Context

`actionTest()` has an optional third parameter for providing specific state or events:

```JavaScript
// Test with custom state
const { state } = actionTest("ProcessData", { value: 10 }, {
  state: { count: 5, data: [] }
});

// Test action that accesses rootState
const { state } = actionTest("ApplyTheme", {}, {
  state: initialState,
  rootState: { theme: "dark" }
});

// Test action that accesses DOM event
const mockEvent = { target: { value: "test input" } };
const { state } = actionTest("HandleInput", {}, {
  state: initialState,
  event: mockEvent
});
```

## VDOM Optimizations

Snabbdom's `key` for list diffing and `memo` (thunk) for memoization are available. 

See [AGENTS.md](./AGENTS.md#list-keys) for usage patterns and [examples/spa/src/components/datesList.ts](https://github.com/robCrawford/cr-26/tree/master/examples/spa/src/components/datesList.ts) for a working example.

---

## Additional APIs

- **`subscribe(event, handler)`** / **`unsubscribe(event, handler)`** - Subscribe to framework lifecycle events (like `"patch"`)
- **`publish(event, detail?)`** - Emit custom application events
- **`setHook(vnode, hookName, callback)`** - Access VDOM lifecycle hooks

See [AGENTS.md](./AGENTS.md) for complete documentation on these APIs and when to use them.

---

## <a id="redux-similarities"></a>Redux Similarities

Like Redux, cr-26 emphasizes **pure functions for state updates**, but the pattern is different:

- `action()` combines action creator and dispatch into a single deferred function
```javascript
  // 1. action() creates a thunk
  button({
    on: { 
      click: action("Increment", { step: 1 }) 
    } 
  }, "+"),
```

- The action handler (like a Redux reducer) is invoked by the framework when the thunk executes
```javascript
  // 2. Handler returns new state
  actions: {
    Increment: ({ step }, { state }) => ({
      state: {
        ...state,
        counter: state.counter + step
      }
    }),
  }
```

---

## Component Config Callbacks

All callbacks passed into `component(...)` via the config object, with their inputs and return types.

---

### `state`

Initialises the component's local state from props.

```typescript
state: (props: Props) => State
```

| Parameter | Type    | Description                       |
| --------- | ------- | --------------------------------- |
| `props`   | `Props` | The props passed to the component |

Returns: initial `State` object.

---

### `init`

An action or task thunk (or array of thunks) to run when the component first mounts. Created with `action(...)` or `task(...)`.

```typescript
init: action("ActionName", payload)
init: task("TaskName", payload)
init: [action("A"), task("B")]
```

---

### `destroy`

An optional callback invoked when the component unmounts. Use for removing event listeners, disconnecting observers, and cleaning up subscriptions.

```typescript
destroy: () => void
```

No inputs. No return value.

---

### Action handlers

Each key in `actions` is a pure function that returns new state and an optional next thunk chain.

```typescript
actions: {
  ActionName: (data: Payload, ctx: Context) => ({ state: State; next?: Next })
}
```

| Parameter   | Type      | Description                                      |
| ----------- | --------- | ------------------------------------------------ |
| `data`      | `Payload` | The payload passed to `action("ActionName", ...)` |
| `ctx.id`    | `string`  | Unique component instance ID                     |
| `ctx.props` | `Props`   | Current component props                          |
| `ctx.state` | `State`   | Current component state                          |
| `ctx.rootState` | `RootState` | Current root state                         |
| `ctx.event` | `NormalizedEvent \| undefined` | DOM event — only present when the action was triggered by a DOM event handler |

Returns: `{ state: State }` or `{ state: State; next: Next }`.
`Next` is an `ActionThunk`, `TaskThunk`, or an array of either.

---

### Task handlers

Each key in `tasks` is a function that receives the task payload and returns a `Task` object with callbacks for the effect lifecycle.

```typescript
tasks: {
  TaskName: (data: Payload) => Task<TResult, Props, State>
}
```

| Parameter | Type      | Description                                     |
| --------- | --------- | ----------------------------------------------- |
| `data`    | `Payload` | The payload passed to `task("TaskName", ...)` |

Returns a `Task` object — see below.

#### `perform`

Runs the side effect. The only place for I/O, async operations, browser APIs, etc.

```typescript
perform: () => Promise<TResult | void> | TResult | void
```

No inputs. Returns a result (sync or async) that is passed to `success`, or throws/rejects to trigger `failure`.

#### `success`

Called after `perform` resolves. Returns the next thunk(s) to dispatch.

```typescript
success?: (result: TResult, ctx: Context) => Next
```

| Parameter       | Type        | Description                       |
| --------------- | ----------- | --------------------------------- |
| `result`        | `TResult`   | The resolved value from `perform` |
| `ctx.id`        | `string`    | Unique component instance ID      |
| `ctx.props`     | `Props`     | Current component props           |
| `ctx.state`     | `State`     | Current component state           |
| `ctx.rootState` | `RootState` | Current root state                |

#### `failure`

Called when `perform` throws or rejects. Error properties are automatically made deeply optional for runtime safety.

```typescript
failure?: (error: DeepPartial<TError>, ctx: Context) => Next
```

| Parameter       | Type                   | Description                          |
| --------------- | ---------------------- | ------------------------------------ |
| `error`         | `DeepPartial<TError>`  | The caught error from `perform`      |
| `ctx.id`        | `string`               | Unique component instance ID         |
| `ctx.props`     | `Props`                | Current component props              |
| `ctx.state`     | `State`                | Current component state              |
| `ctx.rootState` | `RootState`            | Current root state                   |

---

### `view`

Renders the component to a virtual DOM node.

```typescript
view: (ctx: Context) => VNode
```

| Parameter       | Type        | Description                        |
| --------------- | ----------- | ---------------------------------- |
| `ctx.id`        | `string`    | Unique component instance ID — use as a DOM selector prefix to avoid clashes |
| `ctx.props`     | `Props`     | Current component props            |
| `ctx.state`     | `State`     | Current component state            |
| `ctx.rootState` | `RootState` | Current root state                 |

Returns: a `VNode` (Snabbdom virtual DOM node).

---

## For AI Development Tools

**[AGENTS.md](./AGENTS.md)** contains detailed patterns, anti-patterns, and complete examples. Read it before making any code changes to ensure best practices.

- **Component type patterns** - The `Component` type is foundational and required for every component
- **Reference implementation** - Study `examples/spa/` for canonical patterns
- **Actions vs Tasks** - Actions are pure (no I/O), tasks contain all side effects
- **State management** - Immutability patterns and reference equality optimizations
- **Testing patterns** - Use `componentTest` from `cr-26/test`
- **Anti-patterns** - Common mistakes to avoid (mutations, async actions, side effects in actions)
- **Type safety** - Return types, Context object structure, and generic type patterns
