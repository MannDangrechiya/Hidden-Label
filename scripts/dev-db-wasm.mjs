#!/usr/bin/env node
/**
 * WASM PostgreSQL (PGlite) served over the Postgres wire protocol.
 *
 *   node scripts/dev-db-wasm.mjs
 *
 * Why this exists: on some Windows machines the native PostgreSQL build cannot spawn backend
 * processes (they die with STATUS_DLL_INIT_FAILED / 0xC0000142), which makes `pg_ctl` clusters
 * unusable. PGlite runs PostgreSQL in-process, so no child process is created.
 *
 * Scope: local development and verification only. It is a single-database server, so the
 * connection URL must point at database `postgres`. docker-compose.yml remains the documented
 * default; CI uses a real Postgres service container.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const PORT = Number(process.env.WASM_PG_PORT ?? 5435);
const HOST = "127.0.0.1";
const DATA_DIR = resolve(process.cwd(), ".dev", "pglite");

mkdirSync(DATA_DIR, { recursive: true });

const db = await PGlite.create({ dataDir: DATA_DIR });
const server = new PGLiteSocketServer({ db, port: PORT, host: HOST });

await server.start();
console.log(
  `● PGlite (WASM PostgreSQL) listening on ${HOST}:${PORT}\n` +
    `  DATABASE_URL=postgres://postgres:postgres@${HOST}:${PORT}/postgres`,
);

const shutdown = async () => {
  try {
    await server.stop();
    await db.close();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
