import { component, html, VNode } from "cr-26";
import themeMenu from "../components/themeMenu";
import like from "../components/like";
import datesList from "../components/datesList";
import { RootState, RootTaskPayloads } from "../app";
const { div, span, a } = html;

export type Component = {
  RootState: RootState;
  RootTaskPayloads: RootTaskPayloads;
};

export default component<Component>(({ rootTask }) => ({
  init: rootTask("SetDocTitle", { title: "List Page" }),

  view(id): VNode {
    return div(
      `#${id}`,
      div(".content", [
        themeMenu("#theme-menu"),
        div(".nav", [
          a({ attrs: { href: "/counter" + location.search, "data-navigo": true } }, "counter page"),
          span(" | list page")
        ]),
        like("#list-like", { page: "listPage" }),
        datesList("#dates-list")
      ])
    );
  }
}));
