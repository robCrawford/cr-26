import { component, html, Subscription, VNode } from "cr-26";
import { FakeWebSocket } from "../services/transport";
const { div } = html;

type State = Readonly<{
  time: string;
}>;

type ActionPayloads = Readonly<{
  OnTick: { time: string };
}>;

type SubscriptionPayloads = Readonly<{
  Clock: undefined;
}>;

type Component = {
  State: State;
  ActionPayloads: ActionPayloads;
  SubscriptionPayloads: SubscriptionPayloads;
};

export default component<Component>(({ subscription }) => ({
  state: (): State => ({ time: "" }),

  init: subscription("Clock"),

  actions: {
    OnTick: ({ time }, { state }): { state: State } => ({
      state: { ...state, time }
    })
  },

  subscriptions: {
    Clock: (): Subscription<ActionPayloads> => ({
      connect: (runAction) => {
        const ws = new FakeWebSocket("wss://example.com/clock");
        ws.onmessage = (event): void => runAction("OnTick", { time: event.data });
        return () => ws.close();
      }
    })
  },

  view: ({ id, state }): VNode => div(`#${id}.clock`, state.time)
}));
