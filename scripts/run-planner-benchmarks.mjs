#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const npx = process.platform === "win32" ? "npx.cmd" : "npx";

const result = spawnSync(
  npx,
  [
    "vitest",
    "run",
    "tests/unit/planning/benchmarks",
    "tests/unit/planning/invariants",
    "tests/unit/planning/property",
    "tests/integration/planning",
    "--reporter=verbose",
  ],
  {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  },
);

process.exit(result.status ?? 1);
