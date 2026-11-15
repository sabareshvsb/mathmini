import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

const globalForDb = globalThis as unknown as { __novaCityDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (globalForDb.__novaCityDb) return globalForDb.__novaCityDb;
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const db = new DatabaseSync(path.join(dir, "nova-city.db"));
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS network (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      data TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS simulation_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      sim_time REAL NOT NULL,
      sim_clock TEXT NOT NULL,
      active_vehicles INTEGER NOT NULL,
      avg_speed REAL NOT NULL,
      congestion_roads INTEGER NOT NULL,
      efficiency REAL NOT NULL,
      waiting_sec REAL NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS report_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      range_name TEXT NOT NULL,
      rows INTEGER NOT NULL
    );
  `);
  globalForDb.__novaCityDb = db;
  return db;
}

export function saveNetwork(network: unknown) {
  const db = getDb();
  db.prepare(
    `INSERT INTO network (id, data, updated_at) VALUES (1, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(JSON.stringify(network), new Date().toISOString());
}

export function loadNetwork(): unknown | null {
  const db = getDb();
  const row = db.prepare(`SELECT data FROM network WHERE id = 1`).get() as { data?: string } | undefined;
  if (!row?.data) return null;
  try {
    return JSON.parse(row.data);
  } catch {
    return null;
  }
}

export function insertSnapshot(payload: Record<string, unknown>) {
  const db = getDb();
  const metrics = (payload.metrics ?? {}) as Record<string, number>;
  db.prepare(
    `INSERT INTO simulation_snapshots
      (created_at, sim_time, sim_clock, active_vehicles, avg_speed, congestion_roads, efficiency, waiting_sec, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    new Date().toISOString(),
    Number(payload.simTime ?? 0),
    String(payload.simClock ?? "--:--:--"),
    Math.round(Number(metrics.activeVehicles ?? 0)),
    Number(metrics.avgSpeedKmh ?? 0),
    Math.round(Number(metrics.congestedRoads ?? 0)),
    Number(metrics.flowEfficiency ?? 0),
    Number(metrics.avgWaitingSec ?? 0),
    JSON.stringify(payload),
  );
  db.prepare(`DELETE FROM simulation_snapshots WHERE id NOT IN (SELECT id FROM simulation_snapshots ORDER BY id DESC LIMIT 500)`).run();
}

export function loadSnapshots(limit = 50) {
  const db = getDb();
  return db
    .prepare(
      `SELECT id, created_at as createdAt, sim_time as simTime, sim_clock as simClock,
              active_vehicles as activeVehicles, avg_speed as avgSpeed,
              congestion_roads as congestedRoads, efficiency, waiting_sec as waitingSec
       FROM simulation_snapshots ORDER BY id DESC LIMIT ?`,
    )
    .all(limit);
}

export function recordReport(range: string, rows: number) {
  const db = getDb();
  db.prepare(`INSERT INTO report_events (created_at, range_name, rows) VALUES (?, ?, ?)`).run(
    new Date().toISOString(),
    range,
    rows,
  );
}

export function databaseStats() {
  const db = getDb();
  const networks = db.prepare(`SELECT COUNT(*) as count FROM network`).get() as { count: number };
  const snapshots = db.prepare(`SELECT COUNT(*) as count FROM simulation_snapshots`).get() as { count: number };
  const reports = db.prepare(`SELECT COUNT(*) as count FROM report_events`).get() as { count: number };
  return {
    driver: "node:sqlite",
    networkRows: networks.count,
    snapshots: snapshots.count,
    reports: reports.count,
  };
}
