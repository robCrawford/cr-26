import { component, html, withEventOptions, Next, Task, VNode } from "cr-26";
import { RootState } from "../app";
const { div } = html;

type Props = Readonly<{
  total: number;
}>;

type State = Readonly<{
  x: number;
  y: number;
  dragging: boolean;
  offsetX: number;
  offsetY: number;
}>;

type ActionPayloads = Readonly<{
  DragStart: { elementId: string };
  DragMove: undefined;
  DragEnd: undefined;
}>;

type TaskPayloads = Readonly<{
  CapturePointer: { pointerId: number; elementId: string };
}>;

export type Component = {
  Props: Props;
  State: State;
  ActionPayloads: ActionPayloads;
  TaskPayloads: TaskPayloads;
  RootState: RootState;
};

export default component<Component>(({ action, task }) => ({
  state: (): State => ({
    dragging: false,
    x: 40,
    y: 550,
    offsetX: 0,
    offsetY: 0
  }),

  actions: {
    DragStart: ({ elementId }, { state, event }): { state: State; next: Next } => {
      return {
        state: {
          ...state,
          dragging: true,
          offsetX: (event?.clientX ?? 0) - state.x,
          offsetY: (event?.clientY ?? 0) - state.y
        },
        next: task("CapturePointer", { pointerId: event?.pointerId ?? 0, elementId })
      };
    },

    DragMove: (_, { state, event }): { state: State } => {
      if (!state.dragging) {
        return { state };
      }
      return {
        state: {
          ...state,
          x: (event?.clientX ?? state.x) - state.offsetX,
          y: (event?.clientY ?? state.y) - state.offsetY
        }
      };
    },

    DragEnd: (_, { state }): { state: State } => ({
      state: state.dragging ? { ...state, dragging: false } : state
    })
  },

  tasks: {
    CapturePointer: ({ pointerId, elementId }): Task<void, unknown, State> => ({
      perform: (): void => {
        document.getElementById(elementId)?.setPointerCapture(pointerId);
      }
    })
  },

  view({ id, state, props }): VNode {
    return div(
      `#${id}.draggable-total`,
      {
        style: {
          left: `${state.x}px`,
          top: `${state.y}px`,
          cursor: state.dragging ? "grabbing" : "grab"
        },
        on: {
          pointerdown: withEventOptions(action("DragStart", { elementId: id }), {
            preventDefault: true
          }),
          pointermove: action("DragMove"),
          pointerup: action("DragEnd"),
          pointercancel: action("DragEnd")
        }
      },
      `Total: ${props.total}`
    );
  }
}));
