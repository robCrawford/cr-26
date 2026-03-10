import { component, html, VNode } from "cr-26";
import { RootActionPayloads } from "../app";
const { div, button } = html;

type Component = {
  RootActionPayloads: RootActionPayloads;
};

export default component<Component>(({ rootAction }) => ({
  view(id): VNode {
    return div(`#${id}`, [
      button({ on: { click: rootAction("SetTheme", { theme: "light" }) } }, "Light theme"),
      button({ on: { click: rootAction("SetTheme", { theme: "dark" }) } }, "Dark theme")
    ]);
  }
}));
