import { componentTest } from "cr-26/test";
import datesList, { Component, State } from "./datesList";

describe("DatesList component", () => {
  const { initialState, actionTest } = componentTest<Component>(datesList);

  it("should set initial state", () => {
    expect(initialState).toEqual({ filterText: "", selectedDate: null, showInfo: true });
  });

  describe("'SetFilter' action", () => {
    const filterEvent = new Event("input");
    Object.defineProperty(filterEvent, "target", { value: { value: "Monday" } });
    const { state, next } = actionTest<State>("SetFilter", undefined, { event: filterEvent });

    it("should update filterText from event", () => {
      expect(state).toEqual({ ...initialState, filterText: "Monday" });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });

  describe("'SelectDate' action", () => {
    describe("when a new date is selected", () => {
      const target = document.createElement("li");
      target.setAttribute("data-id", "2026-06-01");
      const selectEvent = new Event("click");
      Object.defineProperty(selectEvent, "target", { value: target });
      const { state, next } = actionTest<State>("SelectDate", undefined, { event: selectEvent });

      it("should update selectedDate", () => {
        expect(state).toEqual({ ...initialState, selectedDate: "2026-06-01" });
      });

      it("should not return next", () => {
        expect(next).toBeUndefined();
      });
    });

    describe("when the same date is re-selected", () => {
      const target = document.createElement("li");
      target.setAttribute("data-id", "2026-06-01");
      const selectEvent = new Event("click");
      Object.defineProperty(selectEvent, "target", { value: target });
      const stateWithDate: State = { ...initialState, selectedDate: "2026-06-01" };
      const { state } = actionTest<State>("SelectDate", undefined, {
        state: stateWithDate,
        event: selectEvent
      });

      it("should return same state reference", () => {
        expect(state).toBe(stateWithDate);
      });
    });

    describe("when no date element is found", () => {
      const target = document.createElement("div");
      const selectEvent = new Event("click");
      Object.defineProperty(selectEvent, "target", { value: target });
      const { state } = actionTest<State>("SelectDate", undefined, { event: selectEvent });

      it("should return same state reference", () => {
        expect(state).toBe(initialState);
      });
    });
  });

  describe("'ToggleInfo' action", () => {
    const { state, next } = actionTest<State>("ToggleInfo");

    it("should toggle showInfo off", () => {
      expect(state).toEqual({ ...initialState, showInfo: false });
    });

    it("should not return next", () => {
      expect(next).toBeUndefined();
    });
  });
});
