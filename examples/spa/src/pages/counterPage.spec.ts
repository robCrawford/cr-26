import { componentTest } from "cr-26/test";
import counterPage, { Component, State } from "./counterPage";

describe("Counter Page component", () => {
  const { initialState, actionTest, config } = componentTest<Component>(counterPage);

  it("should set initial state", () => {
    expect(initialState).toEqual({ counts: [0, 0] });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "SetDocTitle", data: { title: "Counter Page" } });
  });

  describe("'SetCount' action", () => {
    const { state, next } = actionTest<State>("SetCount", { index: 0, count: 5 });

    it("should update counts at the given index", () => {
      expect(state).toEqual({
        ...initialState,
        counts: { ...initialState.counts, [0]: 5 }
      });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });
});
