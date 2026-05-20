import { ActionThunk, component, html, Next, Task, VNode } from "cr-26";
import notification from "./notification";
import { validateCount } from "../services/validation";
import { RootActionPayloads } from "../app";
const { div, button } = html;

export type Props = Readonly<{
  start: number;
  setParentCount: (count: number) => ActionThunk;
}>;

export type State = Readonly<{
  count: number;
  feedback: string;
}>;

type ActionPayloads = Readonly<{
  Increment: { step: number };
  Decrement: { step: number };
  Validate: undefined;
  SetFeedback: { text: string };
}>;

type TaskPayloads = Readonly<{
  ValidateCount: { count: number };
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
  TaskPayloads: TaskPayloads;
  RootActionPayloads: RootActionPayloads;
};

export default component<Component>(({ action, task }) => ({
  state: (props): State => ({
    count: props.start,
    feedback: ""
  }),

  init: action("Validate"),

  actions: {
    Increment: ({ step }, { state }): { state: State; next: Next } => {
      return {
        state: {
          ...state,
          count: state.count + step
        },
        next: action("Validate")
      };
    },
    Decrement: ({ step }, { state }): { state: State; next: Next } => {
      return {
        state: {
          ...state,
          count: state.count - step
        },
        next: action("Validate")
      };
    },
    Validate: (_, { state, props }): { state: State; next: Next } => {
      return {
        state,
        next: [
          action("SetFeedback", { text: "Validating..." }),
          // An async task
          task("ValidateCount", { count: state.count }),
          // A parent action
          props.setParentCount(state.count)
        ]
      };
    },
    SetFeedback: ({ text }, { state }): { state: State } => {
      return {
        state: text === state.feedback ? state : { ...state, feedback: text }
      };
    }
  },

  tasks: {
    ValidateCount: ({ count }): Task<{ text: string }, Props, State> => {
      return {
        perform: () => validateCount(count),
        success: (result) => action("SetFeedback", result),
        failure: () => action("SetFeedback", { text: "Unavailable" })
      };
    }
  },

  view({ id, state }): VNode {
    return div(`#${id}.counter`, [
      button({ on: { click: action("Increment", { step: 1 }) } }, "+"),
      div(String(state.count)),
      button({ on: { click: action("Decrement", { step: 1 }) } }, "-"),

      // Child component - `notification` module
      notification(`#${id}-feedback`, {
        text: state.feedback,
        onDismiss: action("SetFeedback", { text: "" })
      })
    ]);
  }
}));
