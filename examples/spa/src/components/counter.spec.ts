import { expectOne, expectArray, componentTest, mockThunk } from "cr-26/test";
import counter, { State, Component } from "./counter";

const parentActionThunk = mockThunk();
const setParentCount = vi.fn(() => parentActionThunk);

describe("Counter component", () => {
  const { initialState, actionTest, taskTest, config } = componentTest<Component>(counter, {
    setParentCount,
    start: 0
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({ count: 0, feedback: "" });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({ name: "Validate" });
  });

  describe("'Increment' action", () => {
    const { state, next } = actionTest<State>("Increment", { step: 1 });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        count: 1
      });
    });

    it("should return next", () => {
      const { name, data } = expectOne(next);
      expect(name).toBe("Validate");
      expect(data).toBeUndefined();
    });
  });

  describe("'Decrement' action", () => {
    const { state, next } = actionTest<State>("Decrement", { step: 1 });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        count: -1
      });
    });

    it("should return next", () => {
      const { name, data } = expectOne(next);
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
      const nextItems = expectArray(next);
      expect(nextItems.length).toBe(3);

      expect(nextItems[0].name).toBe("SetFeedback");
      expect(nextItems[0].data).toEqual({ text: "Validating..." });

      expect(nextItems[1].name).toBe("ValidateCount");
      expect(nextItems[1].data).toEqual({ count: 0 });

      expect(setParentCount).toHaveBeenCalledWith(0);
      expect(nextItems[2]).toBe(parentActionThunk);
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
      const { name, data } = expectOne(success?.({ text: "Success test" }));
      expect(name).toBe("SetFeedback");
      expect(data).toEqual({ text: "Success test" });
    });

    it("should handle failure", () => {
      const { name, data } = expectOne(failure?.(""));
      expect(name).toBe("SetFeedback");
      expect(data).toEqual({ text: "Unavailable" });
    });
  });
});
