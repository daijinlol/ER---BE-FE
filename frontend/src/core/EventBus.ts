export type EventType = 'ITEM_FOUND' | 'DOOR_UNLOCKED' | 'PUZZLE_SOLVED' | 'PUZZLE_CLOSED' | 'STATE_CHANGED' | 'CAMPAIGN_COMPLETED' | 'CAMPAIGN_FAILED' | 'TIME_PENALTY';

type EventCallback = (payload: any) => void;

class EventBus {
  private listeners: Record<string, EventCallback[]> = {};

  subscribe(event: EventType, callback: EventCallback) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);

    // Return unsubscribe function
    return () => {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
    };
  }

  publish(event: EventType, payload?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(payload));
    }
  }
}

// Export a singleton instance
export const gameEvents = new EventBus();
