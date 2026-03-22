import { expectNextSingle, expectNextArray, componentTest } from "cr-26/test";
import counter, { State, Component } from "./counter";

describe("Counter component", () => {
  const { initialState, actionTest, taskTest, config } = componentTest<Component>(counter, {
    start: 0
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({ counter: 0, feedback: "" });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "Validate" });
  });

  describe("'Increment' action", () => {
    const { state, next } = actionTest<State>("Increment", { step: 1 });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        counter: 1
      });
    });

    it("should return next", () => {
      const { name, data } = expectNextSingle(next);
      expect(name).toBe("Validate");
      expect(data).toBeUndefined();
    });
  });

  describe("'Decrement' action", () => {
    const { state, next } = actionTest<State>("Decrement", { step: 1 });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        counter: -1
      });
    });

    it("should return next", () => {
      const { name, data } = expectNextSingle(next);
      expect(name).toBe("Validate");
      expect(data).toBeUndefined();
    });
  });

  describe("'Validate' action", () => {
    const { state, next } = actionTest<State>("Validate");

    it("should not update state", () => {
      expect(state).toEqual(initialState);
    });

    it("should return next", () => {
      const nextItems = expectNextArray(next);
      expect(nextItems.length).toBe(2);

      expect(nextItems[0].name).toBe("SetFeedback");
      expect(nextItems[0].data).toEqual({ text: "Validating..." });

      expect(nextItems[1].name).toBe("ValidateCount");
      expect(nextItems[1].data).toEqual({ count: 0 });
    });
  });

  describe("'SetFeedback' action", () => {
    const { state, next } = actionTest<State>("SetFeedback", { text: "test" });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        feedback: "test"
      });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });

  describe("'ValidateCount' task", () => {
    const { perform, success, failure } = taskTest("ValidateCount", { count: 0 });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should handle success", () => {
      const { name, data } = expectNextSingle(success?.({ text: "Success test" }));
      expect(name).toBe("SetFeedback");
      expect(data).toEqual({ text: "Success test" });
    });

    it("should handle failure", () => {
      const { name, data } = expectNextSingle(failure?.(""));
      expect(name).toBe("SetFeedback");
      expect(data).toEqual({ text: "Unavailable" });
    });
  });
});
