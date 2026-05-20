# AGENTS.md - cr-26 Development Guide for AI Agents

## Reference Implementation

The `examples/spa/` directory is the canonical reference. Study these files:

| File                             | Pattern Demonstrated                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/index.ts`                   | Application bootstrap, mount(), external I/O wiring, subscribe("patch"), RunAction       |
| `src/routes.ts`                  | Route configuration (pure data)                                                          |
| `src/app.ts`                     | Root component, RootState/RootActionPayloads/RootTaskPayloads exports, IIFE view pattern |
| `src/components/counter.ts`      | Full component: props, state, actions, tasks, child composition                          |
| `src/components/notification.ts` | ActionThunk callback props, conditional classes                                          |
| `src/components/like.ts`         | Stateless component with rootState/rootAction/rootTask                                   |
| `src/components/themeMenu.ts`    | Minimal component (only RootActionPayloads, no local state)                              |
| `src/components/datesList.ts`    | `memo` for memoization, `key` for list diffing, event delegation                         |
| `src/pages/counterPage.ts`       | Page component with rootTask init                                                        |
| `src/services/validation.ts`     | Service function pattern                                                                 |
| `*.spec.ts` files                | Testing patterns                                                                         |

## Component Type (FOUNDATIONAL)

Every component MUST define a `Component` type. This is the foundation of type safety in cr-26.

The Component type is a TypeScript interface that defines what your component uses. **All fields are optional** - only include what your component needs:

```typescript
// Full component with everything - see examples/spa/src/components/counter.ts
type Component = {
  Props: Readonly<{ start: number }>;
  State: Readonly<{ count: number; feedback: string }>;
  ActionPayloads: Readonly<{
    Increment: { step: number };
    Reset: undefined;
  }>;
  TaskPayloads: Readonly<{
    ValidateCount: { count: number };
  }>;
};

export const counter = component<Component>(({ action, task }) => ({
  state: (props) => ({ count: props.start, feedback: "" }),
  actions: {
    Increment: ({ step }, { state }): { state: State; next: Next } => ({
      state: { ...state, count: state.count + step },
      next: task("ValidateCount", { count: state.count + step })
    }),
    Reset: (_, { state }): { state: State } => ({
      state: { ...state, count: 0 }
    })
  },
  tasks: {
    ValidateCount: ({ count }): Task<{ text: string }, Props, State> => ({
      perform: () => validateCount(count),
      success: (result) => action("SetFeedback", result)
    })
  },
  view: ({ id }) => div(`#${id}`, "Counter")
}));
```

**Common Component type patterns:**

```typescript
// Stateless component with root access - see examples/spa/src/components/like.ts
type Component = {
  Props: Readonly<{ page: string }>;
  RootState: RootState;
  RootActionPayloads: RootActionPayloads;
};

// Minimal view-only component - see examples/spa/src/components/themeMenu.ts
type Component = {
  RootActionPayloads: RootActionPayloads;
};

// Page component - see examples/spa/src/pages/counterPage.ts
type Component = {
  Props: Readonly<{ id: string }>;
  State: Readonly<{ initialized: boolean }>;
  RootState: RootState;
  RootTaskPayloads: RootTaskPayloads;
};

// Component with no props
type Component = {
  State: Readonly<{ count: number }>;
  ActionPayloads: Readonly<{ Increment: undefined }>;
};
```

**Why Component type is required:**

1. **Type inference** - Enables TypeScript to infer types in actions, tasks, and view functions
2. **Type safety** - Catches errors at compile time (wrong action names, incorrect payloads, missing state fields)
3. **IntelliSense** - Provides autocomplete for action names, state fields, and props
4. **Refactoring safety** - Renaming actions/state fields updates all usages

**When creating components in tests:**

```typescript
// ALWAYS define Component type for inline test components
const testComponent = component<{
  State: { count: number };
  ActionPayloads: {
    Increment: undefined;
  };
}>(({ action }) => ({
  state: () => ({ count: 0 }),
  actions: {
    Increment: (_, { state }) => ({ state: { ...state, count: state.count + 1 } })
  },
  view: ({ id }) => div(`#${id}`, "Test")
}));
```

See `src/components.spec.ts` for examples of defining Component types in tests.

## Core Architecture

### Actions (Pure Functions)

**CRITICAL**: Actions are pure, synchronous, no I/O. Return new state and optional `next` actions/tasks.

```typescript
actions: {
  // With next - include Next in return type
  Increment: ({ step }, { state }): { state: State; next: Next } => ({
    state: { ...state, count: state.count + step },
    next: action("Validate")
  }),

  // Without next - omit Next from return type
  SetValue: ({ value }, { state }): { state: State } => ({
    state: { ...state, value }
  }),

  // No payload - use `_` for required positional params that are unused
  Reset: (_, { state }): { state: State } => ({
    state: { ...state, count: 0 }
  }),

  // Same-state optimization - return same reference when unchanged
  // Framework uses strict reference equality (!==) to check if state changed
  SetTheme: ({ theme }, { state }): { state: State } => ({
    state: theme === state.theme ? state : { ...state, theme }
  })
}
```

For actions with no payload, use `undefined` as the type — the second argument to `action(...)` is then omitted at the call site:

```typescript
type ActionPayloads = Readonly<{
  ShowMessage: { text: string };
  Dismiss: undefined; // no payload
}>;

action("Dismiss") // second arg omitted
```

See `examples/spa/src/components/counter.ts` for complete action patterns.

### Tasks (Side Effects)

**ONLY place for**: API calls, browser APIs, localStorage, timers, logging, DOM mutations.

**Task Type Signature**: `Task<TResult, TProps, TState, TRootState = unknown, TError = unknown>`

- All error properties are automatically made **optional (deep)** for runtime safety

```typescript
tasks: {
  // Async task
  ValidateCount: ({ count }): Task<{ text: string }, Props, State> => ({
    perform: () => validateCount(count),
    success: (result) => action("SetFeedback", result),
    failure: () => action("SetFeedback", { text: "Unavailable" })
  }),

  // Success/failure receive full context as second argument — use props to relay upward
  // instead of reaching for rootState or a root action
  FetchItem: ({ id }): Task<Item, Props, State> => ({
    perform: () => api.getItem(id),
    success: (item, { props }): Next => props.onComplete(item),
    failure: (_, { props }): Next => props.onError()
  }),

  // Effect-only (sync) - no success/failure needed
  SetDocTitle: ({ title }): Task<void, RootProps, RootState> => ({
    perform: (): void => {
      document.title = title;
    }
  })
}
```

See `examples/spa/src/app.ts` (SetDocTitle) and `examples/spa/src/components/counter.ts` (ValidateCount).

### External I/O Wiring

Connect external events to root actions in `mount()` init callback. See `examples/spa/src/index.ts` for the complete pattern.

### Framework Events (Pub/Sub)

**Built-in**: `"patch"` fires after every VDOM patch - used to update router links after render.

**Custom events**: For cross-cutting concerns (analytics, logging). Use sparingly—prefer props/actions.

```typescript
publish("user:login", { userId: result.id });
subscribe("user:login", (event) => analytics.track("login", event.detail.userId));
unsubscribe("user:login", handler);
```

## Anti-Patterns

### ❌ Side effects in actions → ✅ Tasks

```typescript
// WRONG
actions: {
  SaveData: ({ data }, { state }): { state: State } => {
    localStorage.setItem("data", JSON.stringify(data)); // WRONG - side effect!
    return { state: { ...state, saved: true } };
  };
}

// CORRECT - delegate to task
actions: {
  SaveData: ({ data }, { state }): { state: State; next: Next } => ({
    state: { ...state, data },
    next: task("PersistData", { data })
  });
}
```

### ❌ State mutation → ✅ Immutable updates

```typescript
// WRONG - throws due to deepFreeze
state.items.push(item);

// CORRECT
state: { ...state, items: [...state.items, item] }
```

### ❌ Async actions → ✅ Tasks

```typescript
// WRONG
actions: {
  LoadUser: async ({ id }, { state }) => {
    /* ... */
  };
}

// CORRECT
actions: {
  LoadUser: ({ id }, { state }): { state: State; next: Next } => ({
    state: { ...state, loading: true },
    next: task("FetchUser", { id })
  });
}
```

## Event Handling

### Event options

Use `withEventOptions` when you need to call synchronous event methods (`preventDefault`, `stopPropagation`, `stopImmediatePropagation`) before the action handler runs. This keeps the view declarative and avoids manual thunk invocation.

```typescript
import { withEventOptions } from "cr-26";

// Single option
div({ on: { submit: withEventOptions(action("Submit"), { preventDefault: true }) } })

// Multiple options
div({ on: { click: withEventOptions(action("ItemClick", { id }), { stopPropagation: true, preventDefault: true }) } })
```

Most cases that appear to need this can be remodelled without it, by extracting the relevant event data in the action handler and passing it to a task:

```typescript
// ✅ Preferred — no wrapper needed when you only need event data
div({ on: { pointerdown: action("PointerDown", { id }) } })

actions: {
  PointerDown: ({ id }, { state, event }): { state: State; next: Next } => ({
    state: { ...state, activeId: id },
    next: task("AttachDragClone", {
      x: event?.touches?.[0]?.clientX ?? 0,
      y: event?.touches?.[0]?.clientY ?? 0
    })
  })
}
```

Outside of needing synchronous event methods, always pass thunks as direct event handler values.

## Additional Type Patterns

### Context Object

```typescript
type Context<TProps, TState, TRootState> = {
  id: string; // Always defined - the component's unique id
  props: TProps; // Always defined (defaults to {})
  state: TState; // Always defined (defaults to {})
  rootState: TRootState; // Always defined (defaults to {})
  event?: Event; // Optional - only in actions from DOM events
};
```

- `id`, `props`, `state`, `rootState` are **non-optional** - no need for `?.`
- `event` only available in actions triggered by DOM events (not in `next` chains)
- Destructure only what you need: `{ state }`, `{ props, state }`, `{ props, rootState }`

## Immutability Patterns

```typescript
{ ...state, count: state.count + 1 }                    // Object update
{ ...state, likes: { ...state.likes, [page]: n + 1 } }  // Nested object
theme === state.theme ? state : { ...state, theme }     // Same-state optimization
{ ...state, items: [...state.items, newItem] }          // Array add
{ ...state, items: state.items.filter((_, i) => i !== index) }  // Array remove
{ ...state, items: state.items.map((item, i) => i === index ? updated : item) }  // Array update
```

## State Management

### Rendering and Reference Equality

**CRITICAL**: ANY state change (local or root) triggers a full tree re-render from the root component. All component `view` functions execute, though Virtual DOM diffing prevents unnecessary DOM updates.

**The optimization**: The framework uses **strict reference equality (`!==`)** to check if state has changed. Return the same state reference to skip rendering entirely.

```typescript
// ❌ ALWAYS re-renders (new object reference every time)
SetTheme: ({ theme }, { state }): { state: State } => ({
  state: { ...state, theme }  // New reference even if theme unchanged
}),

// ✅ OPTIMIZED (same reference when no change)
SetTheme: ({ theme }, { state }): { state: State } => ({
  state: theme === state.theme ? state : { ...state, theme }
}),

// ❌ ALWAYS re-renders (new object)
Reset: (_, { state }): { state: State } => ({
  state: { count: 0 }  // New reference even if already 0
}),

// ✅ OPTIMIZED (conditional new reference)
Reset: (_, { state }): { state: State } => ({
  state: state.count === 0 ? state : { ...state, count: 0 }
})
```

**How it works**:
- Framework checks `instance.state !== prevState` (reference equality)
- If `true`: sets global `stateChanged` flag, triggers full tree re-render
- If `false`: no render (unless props changed)
- Same applies to props: `instance.props !== instance.prevProps`

**When to optimize**:
- High-frequency actions (input handlers, mouse events)
- Actions that may not change state (validation, filters)
- Root state actions (affect all components)

### Local vs Root State

**State organization guidelines**:

| State Type                      | Location | Why                                           |
| ------------------------------- | -------- | --------------------------------------------- |
| Form inputs, UI toggles         | Local    | Encapsulation, easier to reason about         |
| Selected item (shared siblings) | Parent   | Lift to common ancestor                       |
| Theme, auth, feature flags      | Root     | Cross-cutting, needed by many components      |

**Don't lift unless something else needs it**: If only one component and its descendants read a piece of state, keep it local. Root state that nothing outside the root view reads is a sign of premature lifting — it adds re-render cost and breaks encapsulation with no benefit. Drag/drop state, animation state, and other interaction state almost always belong in the component that owns the interaction.

**Prefer props over rootState for single fields**: If a component accesses `rootState` for a single field, consider whether that field should be passed as a prop instead. Reserve `rootState` access for components that genuinely need multiple cross-cutting values.

**Prefer derived values over stored state**: If a value can be computed entirely from other state or props already in scope, compute it in the view rather than storing it. Storing computed values creates synchronisation bugs and hidden redundancy.

```typescript
// ❌ Stored derived state — must be kept in sync manually
state: { items: Item[]; itemCount: number }

// ✅ Derive in the view
const count = state.items.length;
```

### Lifting State and Relaying Actions

When state is shared between siblings, lift it to the nearest common ancestor. The child relays changes up via a **prop factory** — a function prop it calls with runtime values to produce an `ActionThunk`:

```typescript
// Child declares a factory prop
type Props = Readonly<{
  start: number;
  setParentCount: (count: number) => ActionThunk;
}>;

// Child calls it in next — alongside local concerns
Validate: (_, { state, props }): { state: State; next: Next } => ({
  state,
  next: [
    task("ValidateCount", { count: state.count }),
    props.setParentCount(state.count)  // relay to parent
  ]
})

// Parent owns the state and passes the factory
counter("#counter-0", {
  start: 0,
  setParentCount: (count) => action("SetCount", { index: 0, count })
})
```

See `examples/spa/src/components/counter.ts` and `examples/spa/src/pages/counterPage.ts` for the complete pattern.

When a child action needs to handle a local DOM concern **and** update root state, fan out with an array — keeping the local task in the child component:

```typescript
// Local action fans out to both a local task and a root action
PointerDown: ({ id }, { state }): { state: State; next: Next } => ({
  state: { ...state, activeId: id },
  next: [task("AttachDragClone", { ... }), rootAction("DragStart", { id })]
})
```

### Action Callback Pattern

Pass action thunks as props for child-to-parent communication. See `examples/spa/src/components/notification.ts`:

```typescript
// Child receives callback
export type Props = Readonly<{ text: string; onDismiss: ActionThunk }>;

// Child invokes parent action
next: props.onDismiss;

// Parent passes action as prop
notification(`#${id}-feedback`, {
  text: state.feedback,
  onDismiss: action("SetFeedback", { text: "" })
});
```

The same pattern works in task `success` and `failure` callbacks — the context object is the second argument, so `props` is available there too. Prefer this over a root action when only the parent needs the result:

```typescript
// In an action — relay upward via prop
Validate: (_, { state, props }): { state: State; next: Next } => ({
  state,
  next: props.onComplete
}),

// In a task success — identical, use props instead of a root action
FetchItem: ({ id }): Task<Item, Props, State> => ({
  perform: () => api.getItem(id),
  success: (item, { props }): Next => props.onComplete(item),
  failure: (_, { props }): Next => props.onError()
})
```

> ⚠️ **Do not tighten the type of `on:`** — `hyperscript-helpers` types it as `any`, which is what allows `ActionThunk` values to work in event handlers. Snabbdom's `Listener<T>` (`(this: VNode, ev: T, vnode: VNode) => void`) is incompatible with `ActionThunk`, so narrowing `on:` would break all `action(...)` and `task(...)` usages.

ActionThunks received as props can be placed in on: handlers directly — they behave identically to locally created thunks:

```typescript
div({ on: { dragstart: props.onDragStart } })
```

## View Rendering

### Selector Strings

Elements use CSS selector syntax: `div(`#${id}.container.active`, children)`

### Event Handlers

```typescript
button({ on: { click: action("Submit") } }, "Submit");
input({ on: { input: action("HandleInput"), blur: action("HandleBlur") } });
```

### Attributes and Properties

```typescript
a({ attrs: { href: "/list", "data-navigo": true } }, "List"); // HTML attributes
input({ props: { value: state.text, type: "text" } }); // DOM properties
```

### Conditional Classes

See `examples/spa/src/components/notification.ts`:

```typescript
div(`#${id}.notification`, { class: { show: state.show && props.text.length } }, children);
```

### <a id="list-keys"></a>List Keys

Use `key` on list items for efficient diffing when items are added, removed, or reordered:

```typescript
items.map((item) => li({ key: item.id }, item.name));
```

### Component Memoization

Use `memo` to skip re-rendering when props haven't changed. `memo` is a HOF — wrap a render function once at module level and call the result like a component.

**CRITICAL**: Only `memo` render functions that **DO NOT access `rootState`**.

See `examples/spa/src/components/datesList.ts` for the complete pattern:

```typescript
import { ActionThunk, memo } from "cr-26";

type RenderListProps = {
  filter: string;
  selected: string | null;
  onClick: ActionThunk;
};

// Memoized list view — selector is derived from renderFn's first return value
const listView = memo(({ filter, selected, onClick }: RenderListProps): VNode =>
  ul(
    ".list",
    { on: { click: onClick } },
    filterItems(filter).map((item) =>
      li({ key: item.id, class: { selected: selected === item.id } }, item.label)
    )
  )
);

// In view: call with props
listView({ filter: state.filterText, selected: state.selectedId, onClick: action("Select") });
```

An optional `key` argument disambiguates sibling thunks with the same selector:

```typescript
const primaryList = memo(listRenderFn, "primary");
const secondaryList = memo(listRenderFn, "secondary");
```

**Key requirements for memo to work:**

- `memo(renderFn)` must be called at module level, not inside a component or view function
- Props must be primitives or stable references (not new arrays/objects each render)
- The renderFn must return a VNode with a tag name (e.g., `ul(".list", ...)` not `div(".list").children[0]`)

## Testing

Use `componentTest` to test component logic without mocks. Returns plain data instead of thunks.

See `examples/spa/src/components/counter.spec.ts` for comprehensive patterns:

- Testing initial state and init action
- Testing actions with/without next
- Testing passed in action thunks
- Testing tasks (perform, success, failure)

See `examples/spa/src/components/notification.spec.ts` for:

- Testing components with ActionThunk props (mock with `ThunkType.Action` from main package)

See `examples/spa/src/pages/counterPage.spec.ts` for:

- Testing page components with rootTask init

```typescript
import { componentTest, expectOne } from "cr-26/test";

const { initialState, actionTest, taskTest, config } = componentTest<Component>(counter, {
  start: 0
});

// Test action
const { state, next } = actionTest<State>("Increment", { step: 1 });

// Test task callbacks
const { perform, success, failure } = taskTest("ValidateCount", { count: 0 });
const { name, data } = expectOne(success?.({ text: "Even" }));
```

## Project Structure

```
src/
├── index.ts         # Application bootstrap (mount, DOMContentLoaded, router setup)
├── app.ts           # Root component (exports RootState, RootActionPayloads, RootTaskPayloads)
├── routes.ts        # Route configuration (pure data)
├── components/      # Reusable components (*.ts, *.spec.ts)
├── pages/           # Page components
├── services/        # I/O functions (api.ts, storage.ts, browser.ts)
└── css/
```

## Advanced Patterns

### VDOM Lifecycle Hooks

For third-party library integration only:

```typescript
import { setHook } from "cr-26";
setHook(vnode, "insert", () => initializeChartLibrary(id));
setHook(vnode, "destroy", () => cleanupChartLibrary(id));
```

**Available hooks**: `init`, `create`, `insert`, `prepatch`, `update`, `postpatch`, `destroy`, `remove`

## Debugging

**Redux DevTools** automatically integrates:

- Action history: `counter/Increment { step: 1 }`
- State tree and diffs
- Task tracking: `counter/[Task] FetchData/success`

## Key Rules

1. **Component type is required** - Every component MUST define a `Component` type for type safety and inference
2. **Actions are pure** - No I/O, no side effects, no async
3. **Tasks contain all side effects** - API calls, browser APIs, logging
4. **State is immutable** - Use spread operators, return same reference if unchanged
5. **Types are Readonly** - Props and State must be `Readonly<...>`
6. **Reference equality optimization** - Framework uses `!==` to check state changes; return same reference to skip renders
7. **Don't memo components with rootState** - They won't see changes
8. **External events in mount init** - Wire routing/browser events there
9. **Service functions for I/O** - Extract reusable I/O to services/
10. **Test with componentTest** - Export Component type for type inference
11. **Context in actions** - `props`, `state`, `rootState` non-optional; `event` optional
12. **Component type fields are optional** - Only include what you use
13. **TypeScript strict mode** - Add return types: `{ state: State; next: Next }`, `Task<...>`, `VNode`
14. **Keep state local unless shared** - Only lift state when a second component needs it; root state read by nothing outside the root view is over-lifted
15. **Prefer props over rootState for single fields** - A component that reads one field from `rootState` is a signal that field should be a prop
16. **Don't store derived values** - Compute in the view anything that depends solely on existing state or props
