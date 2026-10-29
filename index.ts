import { createRequire } from "node:module";

// Bun embeds imported `type: "file"` assets in compiled executables. PGlite's
// WASM loader reads this asset from disk, so materialize the embedded asset
// beside the executable before loading the server (which imports PGlite).
import pglitedata from "./node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import pglitewasm from "./node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import initdbwasm from "./node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };

const fs = createRequire(import.meta.url)("node:fs/promises") as typeof import("node:fs/promises");
const originalReadFile = fs.readFile;
const embeddedData = await Bun.file(pglitedata).arrayBuffer();
const embeddedWasm = await Bun.file(pglitewasm).arrayBuffer();
const embeddedInitdbWasm = await Bun.file(initdbwasm).arrayBuffer();
fs.readFile = (async (path: Parameters<typeof fs.readFile>[0], ...args: any[]) => {
  if (String(path).endsWith("pglite.data")) {
    return Buffer.from(embeddedData);
  }
  if (String(path).endsWith("pglite.wasm")) {
    return Buffer.from(embeddedWasm);
  }
  if (String(path).endsWith("initdb.wasm")) {
    return Buffer.from(embeddedInitdbWasm);
  }
  return originalReadFile(path as any, ...args as any);
}) as typeof fs.readFile;

await import("./node_modules/@electric-sql/pglite-socket/dist/scripts/server");
