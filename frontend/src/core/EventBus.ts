export interface EventPayloadMap {
  ITEM_FOUND: string;
  DOOR_UNLOCKED: { doorId: string };
  PUZZLE_SOLVED: { nextLevel: number | string };
  PUZZLE_CLOSED: undefined;
  STATE_CHANGED: { key: string; value: unknown };
  CAMPAIGN_COMPLETED: { campaignId: string };
  CAMPAIGN_FAILED: { reason: string };
  TIME_PENALTY: { seconds: number };
}

export type EventType = keyof EventPayloadMap;

type ListenerMap = {
  [K in EventType]?: Array<(payload: EventPayloadMap[K]) => void>;
};

class EventBus {
  private listeners: ListenerMap = {};

  subscribe<K extends EventType>(event: K, callback: (payload: EventPayloadMap[K]) => void) {
    const listeners = (this.listeners[event] ?? []) as Array<(payload: EventPayloadMap[K]) => void>;
    listeners.push(callback);
    this.listeners[event] = listeners as ListenerMap[K];

    return () => {
      const currentListeners = (this.listeners[event] ?? []) as Array<(payload: EventPayloadMap[K]) => void>;
      this.listeners[event] = currentListeners.filter((cb) => cb !== callback) as ListenerMap[K];
    };
  }

  publish<K extends EventType>(event: K, ...args: EventPayloadMap[K] extends undefined ? [] : [EventPayloadMap[K]]) {
    const payload = args[0] as EventPayloadMap[K];
    const listeners = (this.listeners[event] ?? []) as Array<(payload: EventPayloadMap[K]) => void>;
    listeners.forEach((callback) => callback(payload));
  }
}

export const gameEvents = new EventBus();
