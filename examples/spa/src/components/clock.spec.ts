import { componentTest } from "cr-26/test";
import clock from "./clock";

describe("Clock", () => {
  const { initialState, actionTest, subscriptionTest, config } = componentTest(clock);

  it("should set initial state", () => {
    expect(initialState).toEqual({ time: "" });
  });

  it("should subscribe to Clock on init", () => {
    expect(config.init).toEqual({ name: "Clock" });
  });

  describe("'OnTick' action", () => {
    it("should update the time", () => {
      const { state } = actionTest("OnTick", { time: "12:00:00" });
      expect(state).toEqual({ time: "12:00:00" });
    });
  });

  describe("'Clock' subscription", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should dispatch OnTick after each interval", () => {
      const { connect } = subscriptionTest("Clock");
      const dispatched: Array<{ name: string; data?: unknown }> = [];
      const mockRunAction = (name: string, data?: unknown): void => {
        dispatched.push({ name, data });
      };

      const cleanup = connect(mockRunAction);

      expect(dispatched).toHaveLength(0);

      vi.advanceTimersByTime(1000);
      expect(dispatched).toHaveLength(1);
      expect(dispatched[0]).toEqual({
        name: "OnTick",
        data: { time: expect.any(String) }
      });

      vi.advanceTimersByTime(1000);
      expect(dispatched).toHaveLength(2);

      cleanup();

      vi.advanceTimersByTime(1000);
      expect(dispatched).toHaveLength(2);
    });
  });
});
