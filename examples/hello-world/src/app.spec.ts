import { componentTest, expectOne } from "cr-26/test";
import app, { State, Component } from "./app";

describe("App", () => {
  const { actionTest, taskTest, config, initialState } = componentTest<Component>(app, {
    date: "Test Date"
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({
      title: "Welcome! Test Date",
      text: "",
      done: false
    });
  });

  it("should run initial action", () => {
    expect(config.init).toEqual({
      name: "ShowMessage",
      data: { text: "Hello World!" }
    });
  });

  describe("'ShowMessage' action", () => {
    const { state, next } = actionTest<State>("ShowMessage", { text: "Hello World!" });

    it("should update state", () => {
      expect(state).toEqual({
        ...initialState,
        text: "Hello World!"
      });
    });

    it("should return next", () => {
      const { name, data } = expectOne(next);
      expect(name).toBe("SetDocTitle");
      expect(data).toEqual({ title: "Hello World!" });
    });
  });

  describe("'SetDocTitle' task", () => {
    const { perform, success, failure } = taskTest("SetDocTitle", { title: "test" });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should handle success", () => {
      const { name, data } = expectOne(success?.());
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: true });
    });

    it("should handle failure", () => {
      const { name, data } = expectOne(failure?.());
      expect(name).toBe("PageReady");
      expect(data).toEqual({ done: false });
    });
  });
});
