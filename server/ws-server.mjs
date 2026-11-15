import { WebSocketServer } from "ws";

const PORT = Number(process.env.WS_PORT ?? 4001);
const wss = new WebSocketServer({ port: PORT });

let peers = 0;
let messageCount = 0;

function broadcast(payload, except) {
  const text = JSON.stringify(payload);
  for (const client of wss.clients) {
    if (client === except) continue;
    if (client.readyState === 1) client.send(text);
  }
}

function statusUpdate() {
  broadcast({ type: "peers", peers, messageCount, at: Date.now() });
}

wss.on("connection", (socket) => {
  peers = wss.clients.size;
  console.log(`[ws] client connected · ${peers} peer(s)`);
  socket.send(
    JSON.stringify({
      type: "welcome",
      peers,
      message: "Nova City live telemetry channel",
      disclaimer: "Simulation data only",
      at: Date.now(),
    }),
  );
  statusUpdate();

  socket.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({ type: "error", message: "Malformed JSON" }));
      return;
    }
    messageCount += 1;
    if (message.type === "telemetry") {
      broadcast(
        {
          type: "telemetry",
          from: "peer",
          data: message.data,
          at: Date.now(),
        },
        socket,
      );
    } else if (message.type === "ping") {
      socket.send(JSON.stringify({ type: "pong", at: Date.now() }));
    }
    statusUpdate();
  });

  socket.on("close", () => {
    peers = wss.clients.size;
    console.log(`[ws] client disconnected · ${peers} peer(s)`);
    statusUpdate();
  });

  socket.on("error", (error) => {
    console.warn("[ws] socket error", error.message);
  });
});

const heartbeat = setInterval(() => {
  for (const client of wss.clients) {
    if (client.readyState === 1) client.ping();
  }
}, 30000);

wss.on("close", () => clearInterval(heartbeat));

wss.on("listening", () => {
  console.log(`[ws] Nova City telemetry server listening on ws://localhost:${PORT}`);
});

wss.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[ws] port ${PORT} is already in use. Set WS_PORT to use another port.`);
  } else {
    console.error("[ws] server error", error);
  }
  process.exitCode = 1;
});

process.on("SIGINT", () => {
  console.log("\n[ws] shutting down");
  clearInterval(heartbeat);
  wss.close(() => process.exit(0));
});
