// Runs a command with the worker's own Python (worker/.venv), on Windows or Linux/macOS.
// Usage: node scripts/worker.mjs setup | dev | test
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..", "worker");
const venvPy = process.platform === "win32" ? join(root, ".venv", "Scripts", "python.exe") : join(root, ".venv", "bin", "python");
const systemPy = process.platform === "win32" ? "python" : "python3";

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};

const task = process.argv[2];
if (task === "setup") {
  if (!existsSync(venvPy)) run(systemPy, ["-m", "venv", ".venv"]);
  run(venvPy, ["-m", "pip", "install", "-q", "-r", "requirements.txt"]);
} else if (task === "dev") {
  run(venvPy, ["-m", "uvicorn", "main:app", "--port", "8000", "--reload"]);
} else if (task === "prices") {
  run(venvPy, ["-m", "jobs.run", process.argv[3] || "all"]);
} else if (task === "test") {
  run(venvPy, ["-m", "pytest", "-q"]);
} else {
  console.error("usage: node scripts/worker.mjs setup|dev|prices|test");
  process.exit(2);
}
