import { component, html, Next, VNode } from "cr-26";
import { Page, RootState, RootActionPayloads, RootTaskPayloads } from "../app";
const { button } = html;

export type Props = Readonly<{
  page: Page;
}>;

type ActionPayloads = Readonly<{
  Like: undefined;
}>;

export type Component = {
  Props: Props;
  ActionPayloads: ActionPayloads;
  RootState: RootState;
  RootActionPayloads: RootActionPayloads;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ action, rootAction, rootTask }) => ({
  actions: {
    Like: (_, { props, state }): { state: unknown; next: Next } => ({
      state,
      next: [
        rootAction("Like", { page: props.page }),
        rootTask("SetDocTitle", { title: "You like this!" })
      ]
    })
  },
  view: (id, { props, rootState }): VNode =>
    button(`#${id}.like`, { on: { click: action("Like") } }, `👍 ${rootState.likes[props.page]}`)
}));
