"use client";

import { useEffect } from "react";
import { useTrafficStore } from "@/lib/store/traffic-store";
import { simClock } from "@/lib/format";

/**
 * Boots the local simulation clock and publishes live telemetry.
 * The simulation engine is authoritative in the browser; the WebSocket
 * server relays telemetry to other connected operator consoles and the
 * REST API persists periodic snapshots to SQLite.
 */
export function LiveEngine() {
  useEffect(() => {
    useTrafficStore.getState().init();
    let frame = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      useTrafficStore.getState().tick(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let closed = false;
    let attempts = 0;

    const connect = () => {
      if (closed) return;
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const url =
        process.env.NEXT_PUBLIC_WS_URL ??
        `${protocol}//${window.location.hostname === "localhost" ? "localhost" : window.location.hostname}:4001`;
      useTrafficStore.getState().setSync("connecting");
      try {
        socket = new WebSocket(url);
      } catch {
        useTrafficStore.getState().setSync("offline");
        return;
      }
      socket.onopen = () => {
        attempts = 0;
        useTrafficStore.getState().setSync("connected");
      };
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as {
            type?: string;
            peers?: number;
          };
          if (message.type === "welcome" || message.type === "peers") {
            useTrafficStore.getState().setSync("connected", message.peers ?? 0);
          }
        } catch {
          /* ignore malformed telemetry */
        }
      };
      socket.onclose = () => {
        useTrafficStore.getState().setSync("offline");
        socket = null;
        if (closed) return;
        attempts += 1;
        reconnectTimer = window.setTimeout(connect, Math.min(15000, 2000 + attempts * 1500));
      };
      socket.onerror = () => {
        useTrafficStore.getState().setSync("offline");
      };
    };

    connect();

    const telemetryTimer = window.setInterval(() => {
      const state = useTrafficStore.getState();
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(
          JSON.stringify({
            type: "telemetry",
            data: {
              simClock: simClock(state.simTime),
              running: state.running,
              vehicles: state.metrics.activeVehicles,
              congestion: state.metrics.congestedRoads,
              efficiency: state.metrics.flowEfficiency,
              emergency: state.metrics.emergencyVehicles,
            },
          }),
        );
      }
    }, 3000);

    const persist = () => {
      const state = useTrafficStore.getState();
      if (typeof window === "undefined") return;
      fetch("/api/simulation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          simTime: state.simTime,
          simClock: simClock(state.simTime),
          metrics: state.metrics,
          config: {
            weather: state.config.weather,
            adaptiveSignals: state.config.adaptiveSignals,
            speedMultiplier: state.config.speedMultiplier,
          },
          logs: state.logs.slice(0, 8),
        }),
      }).catch(() => undefined);
    };
    const persistTimer = window.setInterval(persist, 20000);
    const initialPersist = window.setTimeout(persist, 6000);

    return () => {
      closed = true;
      window.clearInterval(telemetryTimer);
      window.clearInterval(persistTimer);
      window.clearTimeout(initialPersist);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, []);

  return null;
}
