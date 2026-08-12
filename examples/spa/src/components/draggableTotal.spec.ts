import { componentTest, expectOne } from "cr-26/test";
import draggableTotal, { Component } from "./draggableTotal";

type State = Component["State"];

describe("DraggableTotal component", () => {
  const { initialState, actionTest, taskTest } = componentTest<Component>(draggableTotal, {
    total: 0
  });

  it("should set initial state", () => {
    expect(initialState).toEqual({ dragging: false, x: 40, y: 550, offsetX: 0, offsetY: 0 });
  });

  describe("'DragStart' action", () => {
    const dragStartEvent = new PointerEvent("pointerdown", {
      clientX: 100,
      clientY: 200,
      pointerId: 1
    });
    const { state, next } = actionTest<State>(
      "DragStart",
      { elementId: "drag-el" },
      {
        event: dragStartEvent
      }
    );

    it("should set dragging and calculate offsets", () => {
      expect(state).toEqual({
        ...initialState,
        dragging: true,
        offsetX: 60, // clientX(100) - x(40)
        offsetY: -350 // clientY(200) - y(550)
      });
    });

    it("should return next CapturePointer task", () => {
      const { name, data } = expectOne(next);
      expect(name).toBe("CapturePointer");
      expect(data).toEqual({ pointerId: 1, elementId: "drag-el" });
    });
  });

  describe("'DragMove' action", () => {
    describe("when not dragging", () => {
      const { state } = actionTest<State>("DragMove");

      it("should return same state reference", () => {
        expect(state).toBe(initialState);
      });
    });

    describe("when dragging", () => {
      const draggingState: State = { ...initialState, dragging: true, offsetX: 10, offsetY: 20 };
      const dragMoveEvent = new PointerEvent("pointermove", { clientX: 150, clientY: 300 });
      const { state, next } = actionTest<State>("DragMove", undefined, {
        state: draggingState,
        event: dragMoveEvent
      });

      it("should update position", () => {
        expect(state).toEqual({
          ...draggingState,
          x: 140, // clientX(150) - offsetX(10)
          y: 280 // clientY(300) - offsetY(20)
        });
      });

      it("should not return next", () => {
        expect(next).toBeUndefined();
      });
    });
  });

  describe("'DragEnd' action", () => {
    describe("when not dragging", () => {
      const { state } = actionTest<State>("DragEnd");

      it("should return same state reference", () => {
        expect(state).toBe(initialState);
      });
    });

    describe("when dragging", () => {
      const draggingState: State = { ...initialState, dragging: true };
      const { state, next } = actionTest<State>("DragEnd", undefined, { state: draggingState });

      it("should set dragging to false", () => {
        expect(state).toEqual({ ...draggingState, dragging: false });
      });

      it("should not return next", () => {
        expect(next).toBeUndefined();
      });
    });
  });

  describe("'CapturePointer' task", () => {
    const { perform, success, failure } = taskTest("CapturePointer", {
      pointerId: 1,
      elementId: "drag-el"
    });

    it("should provide perform", () => {
      expect(perform).toBeDefined();
    });

    it("should not provide success", () => {
      expect(success).toBeUndefined();
    });

    it("should not provide failure", () => {
      expect(failure).toBeUndefined();
    });
  });
});
