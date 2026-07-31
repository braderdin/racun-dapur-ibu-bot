"use client";

import { createClient } from "@supabase/supabase-js";
import { RealtimeEventPayload } from "./supabase-catalog";

export type RealtimeEventType =
  "NEW_DEAL" | "DEAL_UPDATED" | "FLASH_SALE_START";

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: RealtimeEventPayload;
  timestamp: string;
  id: string;
}

export class RealtimeFeedService {
  private supabase;
  private channel: any;
  private eventQueue: RealtimeEvent[] = [];
  private subscribers: Array<(event: RealtimeEvent) => void> = [];

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  // 🔌 Initialize realtime connection
  subscribeToDeals(callback: (event: RealtimeEvent) => void): () => void {
    // Add callback
    this.subscribers.push(callback);

    // Create or recreate channel if needed
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
    }

    this.channel = this.supabase
      .channel("catalog-realtime-feed")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "posted_products",
        },
        (payload) => {
          const event: RealtimeEvent = {
            type: this.mapPayloadToEventType(payload),
            payload: {
              type: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              table: payload.table,
              event: {
                timestamp: new Date().toISOString(),
                op: payload.eventType as "INSERT" | "UPDATE" | "DELETE",
              },
              new: payload.new as any,
              old: payload.old as any,
            },
            timestamp: new Date().toISOString(),
            id: `${payload.eventType}-${payload.old?.id || payload.new?.id || Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          };

          this.eventQueue.push(event);
          this.processQueue();

          // Notify all subscribers
          this.subscribers.forEach((callback) => {
            try {
              callback(event);
            } catch (error) {
              console.error("Error in realtime subscriber:", error);
            }
          });
        },
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      this.subscribers = this.subscribers.filter((cb) => cb !== callback);

      if (this.subscribers.length === 0 && this.channel) {
        this.supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  // 🧠 Map payload to event type
  private mapPayloadToEventType(payload: any): RealtimeEventType {
    const newRecord = payload.new as any;
    const oldRecord = payload.old as any;

    switch (payload.eventType) {
      case "INSERT":
        if (this.isFlashSale(newRecord)) {
          return "FLASH_SALE_START";
        }
        return "NEW_DEAL";

      case "UPDATE":
        const wasFlashSale = this.isFlashSale(oldRecord);
        const isFlashSale = this.isFlashSale(newRecord);

        if (!wasFlashSale && isFlashSale) {
          return "FLASH_SALE_START";
        }
        return "DEAL_UPDATED";

      case "DELETE":
        return "DEAL_UPDATED"; // When product is removed

      default:
        return "NEW_DEAL";
    }
  }

  // 🔥 Check if record is a flash sale
  private isFlashSale(record: any): boolean {
    if (!record) return false;

    const lazadaEnds = record.lazada_peak_hour_end;
    const shopeeEnds = record.shopee_peak_hour_end;
    const lazadaRemaining = record.lazada_peak_hour_remaining;
    const shopeeRemaining = record.shopee_peak_hour_remaining;

    const now = new Date();

    return (
      (lazadaEnds && new Date(lazadaEnds) > now && lazadaRemaining > 0) ||
      (shopeeEnds && new Date(shopeeEnds) > now && shopeeRemaining > 0)
    );
  }

  // 📦 Process queued events
  private async processQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        // Additional processing can be added here
        // e.g., trigger notifications, update cache, etc.
      }
    }
  }

  // 🔄 Get current event history
  getEventHistory(limit: number = 50): RealtimeEvent[] {
    return this.eventQueue.slice(-limit);
  }

  // 🧪 Health check
  async healthCheck(): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from("posted_products")
        .select("id")
        .limit(1);

      return !error;
    } catch {
      return false;
    }
  }

  // 🔧 Cleanup
  unsubscribeAll(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
    this.subscribers = [];
    this.eventQueue = [];
  }
}

export const realtimeFeedService = new RealtimeFeedService();

// 🚀 Hook for React components
export function useRealtimeDeals(
  onNewDeal?: (event: RealtimeEvent) => void,
  onFlashSale?: (event: RealtimeEvent) => void,
) {
  const [events, setEvents] = React.useState<RealtimeEvent[]>([]);
  const serviceRef = React.useRef<RealtimeFeedService | null>(null);

  React.useEffect(() => {
    serviceRef.current = new RealtimeFeedService();

    const handleEvent = (event: RealtimeEvent) => {
      setEvents((prev) => [event, ...prev].slice(0, 100)); // Keep last 100 events

      if (event.type === "NEW_DEAL" && onNewDeal) {
        onNewDeal(event);
      } else if (event.type === "FLASH_SALE_START" && onFlashSale) {
        onFlashSale(event);
      }
    };

    const unsubscribe = serviceRef.current.subscribeToDeals(handleEvent);

    return () => {
      unsubscribe();
      serviceRef.current?.unsubscribeAll();
    };
  }, [onNewDeal, onFlashSale]);

  return { events };
}
