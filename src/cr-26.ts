import { patch, setHook, setInViewExecution, VNode } from "./vdom";
export { html, VNode, memo, setHook } from "./vdom";
import { log } from "./log";
import {
  ActionThunk,
  Component,
  ComponentInstance,
  GetActionThunk,
  GetConfig,
  GetTaskThunk,
  Next,
  NormalizedEvent,
  RunAction,
  TaskThunk,
  ThunkType
} from "./cr-26.types";
export {
  ActionHandler,
  ActionThunk,
  Component,
  ComponentInstance,
  Config,
  Context,
  GetActionThunk,
  GetConfig,
  GetTaskThunk,
  Next,
  NormalizedEvent,
  RunAction,
  Task,
  TaskHandler,
  TaskThunk,
  ThunkType
} from "./cr-26.types";

/** @internal */
export const componentRegistry = new Map<string, ComponentInstance>();

const actionThunkCache = new Map<string, ActionThunk>();
const taskThunkCache = new Map<string, TaskThunk>();

// The root component's type is not known until `renderComponent()`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rootAction: GetActionThunk<any> | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let rootTask: GetTaskThunk<any> | undefined;
let rootState: Record<string, unknown> | undefined;

// Render cycle state
let renderingFromRoot = false;
let stateChanged = false;
let noRender = 0;

const appId = "app";

function resetAppState(): void {
  componentRegistry.clear();
  actionThunkCache.clear();
  taskThunkCache.clear();

  rootAction = undefined;
  rootTask = undefined;
  rootState = undefined;

  renderingFromRoot = false;
  stateChanged = false;
  noRender = 0;
}

// Test utilities
let internalKey = {};
/** @internal */
export const _setTestKey = <T extends object>(k: T): T => (internalKey = k);
/** @internal */
export const _resetForTest = resetAppState;

// Helper to create stable cache keys
function createCacheKey(id: string, name: string, data: unknown): string {
  const dataKey = data === null || data === undefined ? "" : JSON.stringify(data);
  return `${id}:${name}:${dataKey}`;
}

// Action thunk creator with memoization
function createActionThunk(componentId: string, actionName: string, data: unknown): ActionThunk {
  const cacheKey = createCacheKey(componentId, actionName, data);

  const cached = actionThunkCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const actionThunk: {
    (thunkInput?: Record<string, unknown> | Event): void | ActionThunk;
    type: ThunkType.Action;
  } = (thunkInput) => {
    const instance = componentRegistry.get(componentId);
    if (!instance) {
      // Component was unmounted - silently ignore (expected for async task callbacks)
      return;
    }
    if (isDomEvent(thunkInput)) {
      executeAction(instance, actionName, data, thunkInput);
    } else if (thunkInput === internalKey) {
      executeAction(instance, actionName, data);
    } else {
      log.manualError(componentId, actionName);
    }
  };

  actionThunk.type = ThunkType.Action;
  actionThunkCache.set(cacheKey, actionThunk);
  return actionThunk;
}

// Task thunk creator with memoization
function createTaskThunk(componentId: string, taskName: string, data: unknown): TaskThunk {
  const cacheKey = createCacheKey(componentId, taskName, data);

  const cached = taskThunkCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const taskThunk: {
    (thunkInput?: Record<string, unknown> | Event): Promise<Next | void> | void;
    type: ThunkType.Task;
    taskName: string;
    taskData?: unknown;
  } = (thunkInput) => {
    if (isDomEvent(thunkInput) || thunkInput === internalKey) {
      const instance = componentRegistry.get(componentId);
      if (!instance) {
        // Component was unmounted - silently ignore (expected for async operations)
        return Promise.resolve();
      }
      const result = performTask(instance, taskName, data);
      return result.then((next?: Next) => runNext(instance, next));
    } else {
      log.manualError(componentId, taskName);
    }
  };

  taskThunk.type = ThunkType.Task;
  taskThunk.taskName = String(taskName);
  taskThunk.taskData = data;
  taskThunkCache.set(cacheKey, taskThunk);
  return taskThunk;
}

function executeAction(
  instance: ComponentInstance,
  actionName: string,
  data: unknown,
  event?: Event
): void {
  const { config, state: prevState, props, isRoot, id } = instance;
  const actions = config.actions;

  if (!actions?.[actionName]) {
    return;
  }

  const hasStateConfig = Boolean(config.state);
  let next: Next;
  const prevStateFrozen = deepFreeze(prevState);

  const actionOutput = actions[actionName](data, {
    props: props ?? {},
    state: prevStateFrozen ?? {},
    rootState: rootState ?? {},
    event
  });

  // Only update instance.state if component has state config
  if (hasStateConfig) {
    instance.state = actionOutput.state;
  }
  next = actionOutput.next;

  const currStateChanged = hasStateConfig && instance.state !== prevState;
  stateChanged = stateChanged || currStateChanged;
  log.updateStart(
    id,
    currStateChanged ? prevState : undefined,
    actionName,
    data,
    instance.state,
    hasStateConfig
  );

  if (isRoot) {
    rootState = instance.state;
  }

  if (currStateChanged && instance.state) {
    log.updateEnd(instance.state);
  }
  runNext(instance, next);
}

function performTask(
  instance: ComponentInstance,
  taskName: string,
  data: unknown
): Promise<Next | undefined> {
  const { config, state, props, id } = instance;
  const tasks = config.tasks;

  if (!tasks?.[taskName]) {
    throw Error(`Task ${taskName} not found in ${id}`);
  }

  const { perform, success, failure } = tasks[taskName](data);
  const runSuccess = (result: unknown): Next | undefined =>
    success?.(result, {
      props: props ?? {},
      state: state ?? {},
      rootState: rootState ?? {}
    });
  const runFailure = (err: unknown): Next | undefined =>
    failure?.(err, {
      props: props ?? {},
      state: state ?? {},
      rootState: rootState ?? {}
    });

  try {
    const output = perform();
    const isPromise = output instanceof Promise;
    log.taskPerform(id, String(taskName), isPromise);

    if (isPromise) {
      renderComponentInstance(instance); // Render pending state updates
      return output
        .then((result: unknown) => {
          log.taskSuccess(id, String(taskName));
          return runSuccess(result);
        })
        .catch((err: unknown) => {
          log.taskFailure(id, String(taskName), err);
          return runFailure(err);
        });
    } else {
      log.taskSuccess(id, String(taskName));
      return Promise.resolve(runSuccess(output));
    }
  } catch (err) {
    log.taskFailure(id, String(taskName), err);
    return Promise.resolve(runFailure(err));
  }
}

function runNext(instance: ComponentInstance, next: Next | undefined): void {
  // Check if component still exists before processing next
  if (!componentRegistry.has(instance.id)) {
    // Component was unmounted - silently ignore
    return;
  }

  if (!next) {
    renderComponentInstance(instance);
  } else if (isThunk(next)) {
    // Thunks may only be invoked here or from the DOM
    // `internalKey` prevents any manual calls from outside
    next(internalKey);
  } else if (Array.isArray(next)) {
    noRender++;
    next.forEach((n: Next) => runNext(instance, n));
    noRender--;
    renderComponentInstance(instance);
  }
}

// Render function - always renders from root to keep vnode tree consistent
function renderComponentInstance(instance: ComponentInstance): VNode | undefined {
  if (!noRender && (stateChanged || instance.props !== instance.prevProps)) {
    let isRenderRoot = false;

    if (!renderingFromRoot) {
      // If a child component, start render from root
      const rootInstance = componentRegistry.get(appId);
      if (rootInstance && !instance.isRoot) {
        return renderComponentInstance(rootInstance);
      }
      // Already root
      renderingFromRoot = true;
      isRenderRoot = true;
    }

    // Mark as rendering to prevent cleanup during patch (destroy hooks may fire)
    instance.inCurrentRender = true;

    const prevVNode = instance.vnode;
    setInViewExecution(true);
    instance.vnode = instance.config.view(instance.id, {
      props: instance.props ?? {},
      state: instance.state ?? {},
      rootState: rootState ?? {}
    });
    setInViewExecution(false);
    log.render(instance.id, instance.props);
    log.setStateGlobal(instance.id, instance.state);

    // Patch the DOM once at the root
    if (isRenderRoot && prevVNode) {
      patch(prevVNode, instance.vnode);
      log.patch();
      publish("patch");
      stateChanged = false;
      renderingFromRoot = false;

      // Reset render flags
      Array.from(componentRegistry.values()).forEach((inst) => {
        inst.inCurrentRender = false;
      });
    }

    setCleanup(instance);
  }

  instance.prevProps = instance.props;
  return instance.vnode;
}

export function component<TComponent extends Component>(
  getConfig: GetConfig<TComponent>
): { (idStr: string, props?: TComponent["Props"]): VNode; getConfig: GetConfig<TComponent> } {
  // Pass in callback that returns component config
  // Returns render function that is called by parent e.g. `counter("counter-0", { start: 0 })`
  const renderFn = (idStr: string, props?: TComponent["Props"]): VNode => {
    const id = (idStr || "").replace(/^#/, "");

    // Check if component exists in registry
    const existing = componentRegistry.get(id);

    if (!id.length || (!noRender && existing?.inCurrentRender)) {
      throw Error(`Component${id ? ` "${id}" ` : " "}must have a unique id!`);
    }

    // Mark as in current render
    if (existing) {
      existing.inCurrentRender = true;
    }

    return renderComponent<TComponent>(id, getConfig, props);
  };
  // Add a handle to `getConfig` for tests
  renderFn.getConfig = getConfig;
  return renderFn;
}

export function renderComponent<TComponent extends Component>(
  id: string,
  getConfig: GetConfig<TComponent>,
  props?: TComponent["Props"]
): VNode {
  deepFreeze(props);
  const isRoot = id === appId;

  // If component already exists, just render again
  const existingRender = componentRegistry.get(id)?.render;
  if (existingRender) {
    const newVNode = existingRender(props);
    if (newVNode) {
      return newVNode;
    }
  }

  const action: GetActionThunk<TComponent["ActionPayloads"]> = (actionName, data): ActionThunk => {
    return createActionThunk(id, String(actionName), data);
  };

  const task: GetTaskThunk<TComponent["TaskPayloads"]> = (taskName, data): TaskThunk => {
    return createTaskThunk(id, String(taskName), data);
  };

  const config = getConfig({
    action,
    task,
    // Assert root action/task types from the `Component` type
    // eslint-disable-next-line no-restricted-syntax
    rootAction: rootAction as GetActionThunk<TComponent["RootActionPayloads"]>,
    // eslint-disable-next-line no-restricted-syntax
    rootTask: rootTask as GetTaskThunk<TComponent["RootTaskPayloads"]>
  });

  const state = config.state?.(props);

  // Create component instance
  const instance: ComponentInstance = {
    id,
    config,
    state,
    props,
    prevProps: undefined,
    render: (p) => {
      const inst = componentRegistry.get(id);
      if (inst) {
        inst.props = p;
        return renderComponentInstance(inst);
      }
    },
    vnode: undefined,
    isRoot,
    inCurrentRender: true
  };

  componentRegistry.set(id, instance);

  if (config.init) {
    noRender++;
    runNext(instance, config.init);
    noRender--;
  } else {
    log.noInitialAction(id, state);
  }

  if (isRoot) {
    rootAction = action;
    rootTask = task;
    rootState = instance.state;
  }

  log.render(id, props);
  setInViewExecution(true);
  instance.vnode = config.view(id, {
    props: props ?? {},
    state: instance.state ?? {},
    rootState: rootState ?? {}
  });
  setInViewExecution(false);
  instance.prevProps = props;

  setCleanup(instance);
  log.setStateGlobal(id, instance.state);

  return instance.vnode;
}

function setCleanup(instance: ComponentInstance): void {
  if (!instance.vnode) return;

  setHook(instance.vnode, "destroy", () => {
    const inst = componentRegistry.get(instance.id);
    if (inst && !inst.inCurrentRender) {
      componentRegistry.delete(instance.id);

      // Clean up thunk caches
      Array.from(actionThunkCache.keys()).forEach((key) => {
        if (key.startsWith(`${instance.id}:`)) {
          actionThunkCache.delete(key);
        }
      });
      Array.from(taskThunkCache.keys()).forEach((key) => {
        if (key.startsWith(`${instance.id}:`)) {
          taskThunkCache.delete(key);
        }
      });

      log.setStateGlobal(instance.id, undefined);
    }
  });
}

export function mount<TActions, TProps = Record<string, never>>({
  app,
  props,
  init
}: {
  app: (idStr: string, props?: TProps) => VNode;
  props: TProps;
  init?: (runRootAction: RunAction<TActions>) => void;
}): void {
  resetAppState();
  // Mount the top-level app component
  const appElement = document.getElementById(appId);
  if (!appElement) {
    throw Error(`Element with id "${appId}" not found`);
  }
  patch(appElement, app(appId, props));
  log.patch();
  publish("patch");

  // Reset render flags
  Array.from(componentRegistry.values()).forEach((instance) => {
    instance.inCurrentRender = false;
  });

  // Manually invoking an action without `internalKey` is an error, so `runRootAction`
  // is provided by `mount` for wiring up events to root actions (e.g. routing)
  if (init) {
    const runRootAction: RunAction<TActions> = (actionName, data) => {
      rootAction?.(actionName, data)(internalKey);
    };
    init(runRootAction);
  }
}

function isDomEvent(event?: Record<string, unknown> | Event): event is NormalizedEvent {
  return event instanceof Event;
}

function isThunk(next: Next): next is ActionThunk | TaskThunk {
  if (next) {
    return !Array.isArray(next) && next.type in ThunkType;
  }
  return false;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === "object" &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);

const deepFreeze =
  process.env.NODE_ENV !== "production"
    ? <TObject extends Record<string, unknown>>(o?: TObject | null): TObject | undefined | null => {
        if (o) {
          Object.freeze(o);
          Object.getOwnPropertyNames(o).forEach((p: string) => {
            if (
              Object.prototype.hasOwnProperty.call(o, p) &&
              isRecord(o[p]) &&
              !Object.isFrozen(o[p])
            ) {
              deepFreeze(o[p]);
            }
          });
        }
        return o;
      }
    : <T>(o?: T): T | undefined => o;

// Pub/sub
export function subscribe(type: string, listener: EventListener): void {
  document.addEventListener(type, listener);
}

export function unsubscribe(type: string, listener: EventListener): void {
  document.removeEventListener(type, listener);
}

export function publish(type: string, detail?: Record<string, unknown>): void {
  document.dispatchEvent(new CustomEvent(type, detail ? { detail } : undefined));
}
