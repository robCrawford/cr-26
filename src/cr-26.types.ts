import { VNode } from "./vdom";

/** Discriminates between action and task thunks at runtime. */
export enum ThunkType {
  Action,
  Task
}

/**
 * A deferred action call. Pass directly to `on:` event handlers or return as `next` from an
 * action handler. The framework invokes it — pass it as a value, don't call it.
 */
export type ActionThunk = {
  (data?: Record<string, unknown> | NormalizedEvent): void;
  type: ThunkType.Action;
};

/**
 * The `action(name, data?)` function received inside `component(...)`.
 * Creates an {@link ActionThunk} for the named action.
 */
export type GetActionThunk<TActions> = <TKey extends keyof TActions>(
  actionName: TKey,
  data?: TActions[TKey]
) => ActionThunk;

/**
 * Immediately invokes a root action by name. Provided via the `init` callback on {@link mount}
 * for wiring external events (e.g. routing) to root actions after the app has mounted.
 * Unlike `action(...)`, this is not a deferred thunk — it runs the action directly.
 */
export type RunAction<TActions> = (actionName: keyof TActions, data?: ValueOf<TActions>) => void;

/**
 * A deferred task call. Return as `next` from an action handler to schedule a side effect.
 * The framework invokes it — pass it as a value, don't call it.
 */
export type TaskThunk = {
  (data?: Record<string, unknown> | NormalizedEvent): Promise<Next | void> | void;
  type: ThunkType.Task;
  taskName: string;
  taskData?: unknown;
};

/**
 * The `task(name, data?)` function received inside `component(...)`.
 * Creates a {@link TaskThunk} for the named task.
 */
export type GetTaskThunk<TTasks> = (taskName: keyof TTasks, data?: ValueOf<TTasks>) => TaskThunk;

/**
 * The value an action handler may return in its `next` field to chain further work.
 * May be a single thunk, an array of thunks, or `undefined` for no further operations.
 */
export type Next = undefined | ActionThunk | TaskThunk | (ActionThunk | TaskThunk)[];

/**
 * Context object passed to action handlers, task `success`/`failure` callbacks, and the `view`
 * function. `event` is only populated when the action was triggered by a DOM `on:` handler.
 */
export type Context<TProps, TState, TRootState> = {
  /** The component's unique id. */
  id: string;
  /** Current component props. */
  props: TProps;
  /** Current component state. */
  state: TState;
  /** Current root component state. Only typed if `RootState` is set on the `Component` type. */
  rootState: TRootState;
  /** The DOM event that triggered this action. Only present when invoked from an `on:` handler. */
  event?: NormalizedEvent;
};

/**
 * The type of a single entry in the `actions` map.
 * Must be pure and synchronous — no I/O or side effects.
 * Return `{ state }` or `{ state, next }` to optionally chain further actions/tasks.
 */
export type ActionHandler<TData, TProps, TState, TRootState> = (
  data: TData,
  ctx: Context<TProps, TState, TRootState>
) => { state: TState; next?: Next };

/**
 * The type of a single entry in the `tasks` map.
 * Returns a {@link Task} object describing the side effect and its outcome handlers.
 */
export type TaskHandler<TData, TProps, TState, TRootState> = (
  data: TData
  // TResult/TError vary per task so cannot be typed at this level
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) => Task<any, TProps, TState, TRootState, any>;

/**
 * Describes a side-effectful operation and its outcome handlers.
 * Returned by a task handler function.
 */
export type Task<TResult, TProps, TState, TRootState = unknown, TError = unknown> = {
  /**
   * Runs the side effect. The only place for I/O, async operations, browser APIs, etc.
   * Resolve to pass a result to `success`; throw or reject to trigger `failure`.
   */
  perform: () => Promise<TResult | void> | TResult | void;
  /** Called when `perform` resolves. Returns the next action/task thunk(s) to dispatch. */
  success?: (result: TResult, ctx: Context<TProps, TState, TRootState>) => Next;
  /**
   * Called when `perform` throws or rejects.
   * Error properties are automatically made deeply optional for runtime safety.
   */
  failure?: (error: DeepPartial<TError>, ctx: Context<TProps, TState, TRootState>) => Next;
};

/**
 * The type parameter for `component<Component>(...)`.
 * All fields are optional — only include what the component uses.
 */
export type Component = {
  /** Props passed in by the parent. */
  Props?: Record<string, unknown>;
  /** Local component state. */
  State?: Record<string, unknown>;
  /** Payload types for local actions, keyed by action name. Use `undefined` for no-payload actions. */
  ActionPayloads?: Record<string, unknown>;
  /** Payload types for local tasks, keyed by task name. Use `undefined` for no-payload tasks. */
  TaskPayloads?: Record<string, unknown>;
  /** Root component state shape. Required to access `ctx.rootState`. */
  RootState?: Record<string, unknown>;
  /** Payload types for root actions. Required to call `rootAction(...)`. */
  RootActionPayloads?: Record<string, unknown>;
  /** Payload types for root tasks. Required to call `rootTask(...)`. */
  RootTaskPayloads?: Record<string, unknown>;
};

/**
 * @internal — Untyped config shape used in {@link ComponentInstance} because each instance has a
 * different `TComponent` generic. The typed version is {@link Config}.
 */
export type InternalConfig = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  state?: (...args: any[]) => any;
  init?: Next;
  destroy?: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions?: Record<string, (...args: any[]) => any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tasks?: Record<string, (...args: any[]) => any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  view: (...args: any[]) => VNode;
};

/** @internal */
export type ComponentInstance = {
  id: string;
  config: InternalConfig;
  state?: Record<string, unknown>;
  props?: Record<string, unknown>;
  prevProps?: Record<string, unknown>;
  render: RenderFn<Record<string, unknown>>;
  vnode?: VNode;
  isRoot: boolean;
  inCurrentRender: boolean;
};

type StateConfig<TComponent extends Component> = undefined extends TComponent["State"]
  ? { state?: never }
  : { state: (props: TComponent["Props"]) => TComponent["State"] };

/**
 * The configuration object returned by the callback passed to `component(...)`.
 * All fields except `view` are optional. `state` is required when `State` is declared on the
 * `Component` type, and must be omitted when it is not.
 */
export type Config<TComponent extends Component = Component> = StateConfig<TComponent> & {
  /**
   * Action or task thunk(s) to dispatch when this component first mounts.
   * Created with `action(...)` or `task(...)`.
   */
  init?: Next;
  /** Callback invoked when this component unmounts. Use for removing listeners, observers, and subscriptions. */
  destroy?: () => void;
  /** Map of pure, synchronous action handler functions keyed by action name. */
  actions?: {
    [TKey in keyof TComponent["ActionPayloads"]]: ActionHandler<
      TComponent["ActionPayloads"][TKey],
      TComponent["Props"],
      TComponent["State"],
      TComponent["RootState"]
    >;
  };
  /** Map of task handler functions keyed by task name. */
  tasks?: {
    [TKey in keyof TComponent["TaskPayloads"]]: TaskHandler<
      TComponent["TaskPayloads"][TKey],
      TComponent["Props"],
      TComponent["State"],
      TComponent["RootState"]
    >;
  };
  /** Renders the component to a virtual DOM node. Called on every render cycle. */
  view: (ctx: Context<TComponent["Props"], TComponent["State"], TComponent["RootState"]>) => VNode;
};

/**
 * The function signature of the callback passed to `component(...)`.
 * Receives `action`, `task`, `rootAction`, and `rootTask` factory functions and returns a
 * {@link Config}.
 */
export type GetConfig<TComponent extends Component> = (fns: {
  /** Creates an {@link ActionThunk} for a local action. */
  action: GetActionThunk<TComponent["ActionPayloads"]>;
  /** Creates a {@link TaskThunk} for a local task. */
  task: GetTaskThunk<TComponent["TaskPayloads"]>;
  /** Creates an {@link ActionThunk} for a root action. */
  rootAction: GetActionThunk<TComponent["RootActionPayloads"]>;
  /** Creates a {@link TaskThunk} for a root task. */
  rootTask: GetTaskThunk<TComponent["RootTaskPayloads"]>;
}) => Config<TComponent>;

/** @internal */
export type RenderFn<TProps> = (props?: TProps) => VNode | void;

/*
  Type Utils
*/
export type ValueOf<T> = T[keyof T];

export type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;

/**
 * Options passed to {@link withEventOptions} to call synchronous event methods before the thunk
 * is dispatched. Use this instead of manually invoking a thunk as a function.
 */
export type EventOptions = {
  preventDefault?: boolean;
  stopPropagation?: boolean;
  stopImmediatePropagation?: boolean;
};

type TargetInputProps = EventTarget & Partial<HTMLInputElement> & Partial<Node>;

/**
 * Augmented `Event` type used in action handler context. Use in place of the native `Event` type
 * to access `target` input properties (e.g. `value`) without manual narrowing.
 */
export type NormalizedEvent = Event &
  Partial<TouchEvent> &
  Partial<MouseEvent> &
  Partial<PointerEvent> & {
    target: TargetInputProps | null;
    currentTarget: TargetInputProps | null;
  };
