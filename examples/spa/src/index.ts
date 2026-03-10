import { mount, subscribe, RunAction } from "cr-26";
import Navigo from "navigo";
import app, { RootActionPayloads, RootProps } from "./app";
import { routes } from "./routes";

const router = new Navigo("/demos/cr-26/spa/");

document.addEventListener("DOMContentLoaded", () =>
  mount<RootActionPayloads, RootProps>({
    app,
    props: {},

    // Manually invoking an action is an error, so `runRootAction` is provided
    // by `mount` for wiring up events to root actions (e.g. routing)
    init: (runRootAction: RunAction<RootActionPayloads>) => {
      const routeHandlers = Object.entries(routes).reduce(
        (acc, [path, handler]) => ({
          ...acc,
          [path]: (): void => handler(runRootAction)
        }),
        {}
      );

      router.on(routeHandlers).resolve();

      subscribe("patch", () => {
        router.updatePageLinks();
      });
    }
  })
);
