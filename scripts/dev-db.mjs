#!/usr/bin/env node
/**
 * Portable local PostgreSQL for machines without Docker.
 *
 *   pnpm db:start | db:stop | db:status
 *
 * Runs a project-local PostgreSQL 18 cluster in `.dev/pgdata` on 127.0.0.1:5437 with trust auth.
 *
 * IMPORTANT — sanitized environment. On Windows, launching PostgreSQL from an MSYS/Git-Bash
 * shell makes every backend die with `0xC0000142` (STATUS_DLL_INIT_FAILED) and clients get
 * ECONNRESET, because inherited shell variables poison the child-process environment. Spawning
 * with a minimal Windows environment fixes it (see docs/PHASE_1_REPORT.md §4). Do not "simplify"
 * this by spreading `process.env` into the child env.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { connect } from "node:net";
import { resolve } from "node:path";
import { Client } from "pg";

const PORT = Number(process.env.PGHOSTPORT ?? 5437);
const HOST = "127.0.0.1";
const USER = "postgres";
const DATABASE = process.env.PGDATABASE ?? "the_hidden_label";
const ROOT = process.cwd();
const DEV_DIR = resolve(ROOT, ".dev");
const DATA_DIR = resolve(DEV_DIR, "pgdata");
const LOG_DIR = resolve(DEV_DIR, "pglog");
const LOG_FILE = resolve(LOG_DIR, "postgres.log");

const PLATFORM_PACKAGE =
  process.platform === "win32"
    ? `@embedded-postgres/windows-${process.arch}`
    : `@embedded-postgres/${process.platform}-${process.arch}`;
const BIN_DIR = resolve(ROOT, "node_modules", PLATFORM_PACKAGE, "native", "bin");

/** Minimal Windows environment — a polluted environment breaks PostgreSQL child processes. */
function childEnv() {
  const systemRoot = process.env.SYSTEMROOT ?? process.env.WINDIR ?? "C:\\Windows";
  const temp = process.env.TEMP ?? process.env.TMP ?? "C:\\Windows\\Temp";
  return {
    SYSTEMROOT: systemRoot,
    WINDIR: systemRoot,
    PATH: `${BIN_DIR};${systemRoot}\\system32;${systemRoot}`,
    TEMP: temp,
    TMP: temp,
    NUMBER_OF_PROCESSORS: process.env.NUMBER_OF_PROCESSORS ?? "4",
    COMPUTERNAME: process.env.COMPUTERNAME ?? "localhost",
    USERPROFILE: process.env.USERPROFILE ?? ROOT,
  };
}

function tool(name) {
  const file = resolve(BIN_DIR, process.platform === "win32" ? `${name}.exe` : name);
  if (!existsSync(file)) {
    throw new Error(
      `PostgreSQL binary not found: ${file}\n` +
        `Run \`pnpm install\` (it provides ${PLATFORM_PACKAGE}), or use \`docker compose up -d\`.`,
    );
  }
  return file;
}

function run(name, args) {
  return execFileSync(tool(name), args, {
    stdio: "pipe",
    encoding: "utf8",
    env: childEnv(),
  });
}

function probe(port) {
  return new Promise((done) => {
    const socket = connect({ host: HOST, port }, () => {
      socket.end();
      done(true);
    });
    socket.on("error", () => done(false));
    socket.setTimeout(1000, () => {
      socket.destroy();
      done(false);
    });
  });
}

async function withClient(database, fn) {
  const client = new Client({ host: HOST, port: PORT, user: USER, database });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ensureDatabase() {
  const { rows } = await withClient("postgres", (client) =>
    client.query("select 1 from pg_database where datname = $1", [DATABASE]),
  );
  if (rows.length > 0) {
    console.log(`● database "${DATABASE}" already exists`);
    return;
  }
  await withClient("postgres", (client) => client.query(`create database "${DATABASE}"`));
  console.log(`○ created database "${DATABASE}"`);
}

function forceTrustAuth() {
  const hbaPath = resolve(DATA_DIR, "pg_hba.conf");
  if (!existsSync(hbaPath)) return;
  const original = readFileSync(hbaPath, "utf8");
  const rewritten = original.replace(
    /^(host\s+all\s+all\s+(?:127\.0\.0\.1\/32|::1\/128)\s+)(password|scram-sha-256|md5)$/gm,
    "$1trust",
  );
  if (rewritten !== original) {
    writeFileSync(hbaPath, rewritten);
    console.log("○ pg_hba.conf: loopback set to trust for local development");
  }
}

async function start() {
  mkdirSync(LOG_DIR, { recursive: true });

  if (await probe(PORT)) {
    console.log(`● PostgreSQL already listening on ${HOST}:${PORT}`);
    console.log(`  postgres://${USER}@${HOST}:${PORT}/${DATABASE}`);
    return;
  }

  if (!existsSync(resolve(DATA_DIR, "PG_VERSION"))) {
    mkdirSync(DATA_DIR, { recursive: true });
    console.log("○ initialising cluster in .dev/pgdata …");
    run("initdb", ["-D", DATA_DIR, "-U", USER, "--auth=trust", "-E", "UTF8", "--locale=C"]);
  }

  forceTrustAuth();

  console.log("○ starting PostgreSQL 18 …");
  run("pg_ctl", [
    "-D",
    DATA_DIR,
    "-l",
    LOG_FILE,
    "-o",
    `-p ${PORT} -h ${HOST}`,
    "-w",
    "-t",
    "60",
    "start",
  ]);

  await ensureDatabase();
  console.log(`● ready: postgres://${USER}@${HOST}:${PORT}/${DATABASE}`);
}

async function stop() {
  if (!existsSync(resolve(DATA_DIR, "postmaster.pid"))) {
    console.log("○ PostgreSQL is not running");
    return;
  }
  run("pg_ctl", ["-D", DATA_DIR, "-m", "fast", "-w", "stop"]);
  console.log("● stopped");
}

async function status() {
  if (!(await probe(PORT))) {
    console.log(`○ not running on ${PORT} — start with \`pnpm db:start\` or \`docker compose up -d\``);
    process.exitCode = 1;
    return;
  }
  const info = await withClient(DATABASE, (client) =>
    client.query("show server_version"),
  ).catch(() => null);
  console.log(
    `● running on ${HOST}:${PORT} · "${DATABASE}"` +
      (info ? ` · PostgreSQL ${info.rows[0].server_version}` : ""),
  );
}

const command = process.argv[2] ?? "status";
const actions = { start, stop, status };

if (!(command in actions)) {
  console.error(`Unknown command "${command}". Use: start | stop | status`);
  process.exit(1);
}

try {
  await actions[command]();
} catch (error) {
  console.error("✗", error instanceof Error ? error.message : String(error));
  process.exit(1);
}
