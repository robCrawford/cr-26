import { componentTest } from "cr-26/test";
import listPage, { Component } from "./listPage";

describe("List Page component", () => {
  const { config } = componentTest<Component>(listPage);

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "SetDocTitle", data: { title: "List Page" } });
  });
});
