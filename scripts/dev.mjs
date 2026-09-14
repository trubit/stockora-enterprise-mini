#!/usr/bin/env node
/**
 * dev.mjs — Stockora dev runner (replaces concurrently)
 *
 * Spawns the server (tsx watch) and waits for the health endpoint before
 * starting the Vite client. All output is inherited directly from the
 * child processes so nothing gets swallowed.
 *
 * Uses `node <entry.js>` directly instead of .cmd wrappers — avoids the
 * Windows EINVAL / shell:true issues entirely.
 */

import { spawn, execSync } from 'child_process';
import { request } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');

let serverPort = 8095;
try {
  const envPath = path.resolve(ROOT_DIR, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/^PORT\s*=\s*(\d+)/m);
    if (match) serverPort = Number(match[1]);
  }
} catch {}

const HEALTH_URL = `http://127.0.0.1:${serverPort}/api/v1/health`;
const POLL_INTERVAL_MS = 1000;
const MAX_WAIT_MS = 60_000;

// Resolve the actual JS entry points for tsx and vite with absolute paths
const TSX_BIN  = path.resolve(ROOT_DIR, 'node_modules/tsx/dist/cli.mjs');
const VITE_BIN = path.resolve(ROOT_DIR, 'node_modules/vite/bin/vite.js');
const NODE     = process.execPath; // absolute path to the running node binary

const children = [];

function killProcessTree(proc) {
  if (!proc || !proc.pid || proc.killed) return;
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /F /T /PID ${proc.pid}`, { stdio: 'ignore' });
    } else {
      proc.kill('SIGTERM');
    }
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch {}
  }
}

let isShuttingDown = false;

function cleanupAndExit(code = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  for (const proc of children) {
    killProcessTree(proc);
  }
  process.exit(code);
}

function spawnInherited(args, label, extraEnv = {}) {
  console.log(`\n[dev] Starting ${label}...`);
  const proc = spawn(NODE, args, {
    stdio: ['ignore', 'inherit', 'inherit'],
    cwd: ROOT_DIR,
    env: { ...process.env, ...extraEnv },
  });
  children.push(proc);
  proc.on('error', (err) => {
    console.error(`[dev] ${label} error:`, err.message);
    cleanupAndExit(1);
  });
  proc.on('exit', (code, signal) => {
    console.log(`[dev] ${label} exited with code ${code}, signal: ${signal}`);
    if (!isShuttingDown && code !== 0 && code !== null) {
      cleanupAndExit(code ?? 1);
    }
  });
  return proc;
}

function pollHealth(resolve, reject, elapsed = 0) {
  if (elapsed >= MAX_WAIT_MS) {
    return reject(new Error(`Server did not become healthy within ${MAX_WAIT_MS / 1000}s`));
  }
  let settled = false;
  const req = request(HEALTH_URL, (res) => {
    if (settled) return;
    settled = true;
    if (res.statusCode >= 200 && res.statusCode < 400) {
      resolve();
    } else {
      setTimeout(() => pollHealth(resolve, reject, elapsed + POLL_INTERVAL_MS), POLL_INTERVAL_MS);
    }
    res.resume(); // drain response body
  });

  req.on('error', () => {
    if (settled) return;
    settled = true;
    setTimeout(() => pollHealth(resolve, reject, elapsed + POLL_INTERVAL_MS), POLL_INTERVAL_MS);
  });

  req.setTimeout(2000, () => {
    if (settled) return;
    settled = true;
    req.destroy();
    setTimeout(() => pollHealth(resolve, reject, elapsed + POLL_INTERVAL_MS), POLL_INTERVAL_MS);
  });

  req.end();
}

function freePort(port) {
  try {
    if (process.platform === 'win32') {
      const cmd = `powershell -NoProfile -Command "(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue).OwningProcess"`;
      const out = execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      const pids = [...new Set(out.split(/\r?\n/).map(p => p.trim()).filter(Boolean))];
      for (const pid of pids) {
        if (pid && pid !== '0' && pid !== String(process.pid)) {
          console.log(`[dev] Port ${port} is occupied by PID ${pid}. Terminating process...`);
          try {
            execSync(`taskkill /F /T /PID ${pid}`, { stdio: 'ignore' });
            execSync(`powershell -NoProfile -Command "Start-Sleep -Milliseconds 600"`, { stdio: 'ignore' });
          } catch {}
        }
      }
    } else {
      execSync(`fuser -k ${port}/tcp`, { stdio: 'ignore' });
    }
  } catch {
    // Port is already free
  }
}

async function main() {
  // Clean up any stale processes holding serverPort or 3050
  freePort(serverPort);
  freePort(3050);

  // Clean up all child processes on shutdown
  process.on('SIGINT', () => {
    console.log('\n[dev] Shutting down...');
    cleanupAndExit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\n[dev] Terminating...');
    cleanupAndExit(0);
  });
  process.on('exit', () => {
    for (const proc of children) {
      killProcessTree(proc);
    }
  });

  // 1. Start the server via: node node_modules/tsx/dist/cli.mjs watch src/server/index.ts
  const server = spawnInherited([TSX_BIN, 'watch', 'src/server/index.ts'], 'server (tsx)');

  // 2. Wait for the health endpoint to respond
  console.log(`[dev] Waiting for server at ${HEALTH_URL} ...`);
  let isHealthy = false;

  server.on('exit', (code, signal) => {
    if (!isHealthy) {
      console.error(`\n[dev] Server process exited (code: ${code}, signal: ${signal}) before becoming healthy.`);
      cleanupAndExit(code ?? 1);
    }
  });

  await new Promise((resolve, reject) => pollHealth(resolve, reject)).catch((err) => {
    console.error('[dev]', err.message);
    cleanupAndExit(1);
  });
  isHealthy = true;

  // 3. Start the Vite client via: node node_modules/vite/bin/vite.js
  console.log('[dev] Server is healthy — starting Vite client...');

  let clientRetries = 0;
  function spawnClient() {
    if (isShuttingDown) return;
    freePort(3050);
    console.log('[dev] Starting client (vite)...');
    const proc = spawn(NODE, [VITE_BIN], {
      stdio: ['ignore', 'inherit', 'inherit'],
      cwd: ROOT_DIR,
      env: { ...process.env, CI: 'true' },
    });
    children.push(proc);
    proc.on('error', (err) => {
      console.error('[dev] client (vite) error:', err.message);
    });
    proc.on('exit', (code, signal) => {
      console.log(`[dev] client (vite) exited with code ${code}, signal: ${signal}`);
      if (!isShuttingDown && code !== 0 && code !== null) {
        clientRetries++;
        if (clientRetries > 3) {
          console.error('[dev] client (vite) failed 3 times, exiting.');
          cleanupAndExit(code ?? 1);
          return;
        }
        console.log('[dev] Retrying Vite client in 1s...');
        setTimeout(spawnClient, 1000);
      }
    });
  }

  spawnClient();
}

main();
