import { component, html, VNode } from "cr-26";
import counter from "../components/counter";
import draggableTotal from "../components/draggableTotal";
import themeMenu from "../components/themeMenu";
import like from "../components/like";
import { RootState, RootTaskPayloads } from "../app";
const { div, span, a } = html;

export type State = Readonly<{
  counts: number[];
}>;

type ActionPayloads = Readonly<{
  SetCount: { index: number; count: number };
}>;

export type Component = {
  State: State;
  ActionPayloads: ActionPayloads;
  RootState: RootState;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ action, rootTask }) => ({
  init: rootTask("SetDocTitle", { title: "Counter Page" }),

  state: (): State => ({
    counts: [0, 0]
  }),

  actions: {
    SetCount: ({ index, count }, { state }): { state: State } => {
      return {
        state: {
          ...state,
          counts: { ...state.counts, [index]: count }
        }
      };
    }
  },

  view({ id, state }): VNode {
    return div(`#${id}`, [
      div(".content", [
        themeMenu("#theme-menu"),
        div(".nav", [
          span("counter page | "),
          a({ attrs: { href: `/list${location.search}`, "data-navigo": true } }, "list page")
        ]),
        like("#counter-like", { page: "counterPage" })
      ]),
      counter("#counter-0", {
        start: 0,
        setParentCount: (count: number) => action("SetCount", { index: 0, count })
      }),
      counter("#counter-1", {
        start: -1,
        setParentCount: (count: number) => action("SetCount", { index: 1, count })
      }),
      draggableTotal("#draggable-total", {
        total: Object.values(state.counts).reduce((acc, count) => acc + count, 0)
      })
    ]);
  }
}));
