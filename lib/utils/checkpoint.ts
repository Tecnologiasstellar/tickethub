import { promises as fs } from "node:fs";
import { dirname } from "node:path";

interface CheckpointFile {
  completed: string[];
  updatedAt: string;
}

export async function loadCheckpoint(file: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const parsed = JSON.parse(raw) as CheckpointFile;
    return new Set(parsed.completed ?? []);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw err;
  }
}

let writeChain: Promise<void> = Promise.resolve();

export function markDone(file: string, id: string): Promise<void> {
  writeChain = writeChain.then(async () => {
    const existing = await loadCheckpoint(file);
    existing.add(id);
    const payload: CheckpointFile = {
      completed: Array.from(existing),
      updatedAt: new Date().toISOString(),
    };
    await fs.mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload, null, 2), "utf8");
    await fs.rename(tmp, file);
  });
  return writeChain;
}

export async function clearCheckpoint(file: string): Promise<void> {
  try {
    await fs.unlink(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}
