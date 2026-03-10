import { RunAction } from "cr-26";
import { RootActionPayloads } from "./app";

export type RouteHandler = (runRootAction: RunAction<RootActionPayloads>) => void;

export type RouteConfig = {
  list: RouteHandler;
  counter: RouteHandler;
  "*": RouteHandler;
};

export const routes: RouteConfig = {
  list: (runRootAction) => runRootAction("SetPage", { page: "listPage" }),
  counter: (runRootAction) => runRootAction("SetPage", { page: "counterPage" }),
  "*": (runRootAction) => runRootAction("SetPage", { page: "counterPage" })
};
