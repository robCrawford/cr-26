import { componentTest, expectNextArray } from "cr-26/test";
import like, { Component } from "./like";
import { RootState } from "../app";

describe("Like component", () => {
  const { actionTest } = componentTest<Component>(like, { page: "counterPage" });

  describe("'Like' action", () => {
    const { state, next } = actionTest<RootState>("Like");

    it("should not update state", () => {
      // Stateless component - initialState is undefined, but context defaults to {}
      expect(state).toEqual({});
    });

    it("should return next", () => {
      const nextItems = expectNextArray(next);
      expect(nextItems.length).toBe(2);

      expect(nextItems[0].name).toBe("Like");
      expect(nextItems[0].data).toEqual({ page: "counterPage" });

      expect(nextItems[1].name).toBe("SetDocTitle");
      expect(nextItems[1].data).toEqual({ title: "You like this!" });
    });
  });
});
