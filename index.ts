import { createRequire } from "node:module";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Bun embeds imported `type: "file"` assets in compiled executables. PGlite's
// WASM loader reads this asset from disk, so materialize the embedded asset
// beside the executable before loading the server (which imports PGlite).
import pglitedata from "./node_modules/@electric-sql/pglite/dist/pglite.data" with { type: "file" };
import pglitewasm from "./node_modules/@electric-sql/pglite/dist/pglite.wasm" with { type: "file" };
import initdbwasm from "./node_modules/@electric-sql/pglite/dist/initdb.wasm" with { type: "file" };
import { age } from "@electric-sql/pglite/age";
import ageTar from "./node_modules/@electric-sql/pglite/dist/age.tar.gz" with { type: "file" };
import { live } from "@electric-sql/pglite/live";
import { pg_hashids } from "@electric-sql/pglite/pg_hashids";
import pgHashidsTar from "./node_modules/@electric-sql/pglite/dist/pg_hashids.tar.gz" with { type: "file" };
import { pg_ivm } from "@electric-sql/pglite/pg_ivm";
import pgIvmTar from "./node_modules/@electric-sql/pglite/dist/pg_ivm.tar.gz" with { type: "file" };
import { pg_textsearch } from "@electric-sql/pglite/pg_textsearch";
import pgTextsearchTar from "./node_modules/@electric-sql/pglite/dist/pg_textsearch.tar.gz" with { type: "file" };
import { pg_uuidv7 } from "@electric-sql/pglite/pg_uuidv7";
import pgUuidv7Tar from "./node_modules/@electric-sql/pglite/dist/pg_uuidv7.tar.gz" with { type: "file" };
import { pgtap } from "@electric-sql/pglite/pgtap";
import pgtapTar from "./node_modules/@electric-sql/pglite/dist/pgtap.tar.gz" with { type: "file" };
import { vector } from "@electric-sql/pglite/vector";
import vectorTar from "./node_modules/@electric-sql/pglite/dist/vector.tar.gz" with { type: "file" };

const require = createRequire(import.meta.url);
const fs = require("node:fs/promises") as typeof import("node:fs/promises");
const originalReadFile = fs.readFile;
const embeddedData = await Bun.file(pglitedata).arrayBuffer();
const embeddedWasm = await Bun.file(pglitewasm).arrayBuffer();
const embeddedInitdbWasm = await Bun.file(initdbwasm).arrayBuffer();
const embeddedExtensionAssets = new Map([
  ["age.tar.gz", await Bun.file(ageTar).arrayBuffer()],
  ["pg_hashids.tar.gz", await Bun.file(pgHashidsTar).arrayBuffer()],
  ["pg_ivm.tar.gz", await Bun.file(pgIvmTar).arrayBuffer()],
  ["pg_textsearch.tar.gz", await Bun.file(pgTextsearchTar).arrayBuffer()],
  ["pg_uuidv7.tar.gz", await Bun.file(pgUuidv7Tar).arrayBuffer()],
  ["pgtap.tar.gz", await Bun.file(pgtapTar).arrayBuffer()],
  ["vector.tar.gz", await Bun.file(vectorTar).arrayBuffer()],
]);
const extensionAssetDirectory = mkdtempSync(join(tmpdir(), "pglite-server-assets-"));
for (const [assetName, contents] of embeddedExtensionAssets) {
  writeFileSync(join(extensionAssetDirectory, assetName), Buffer.from(contents));
}
process.on("exit", () => rmSync(extensionAssetDirectory, { recursive: true, force: true }));

const withEmbeddedBundle = (extension: any, assetName: string) => ({
  ...extension,
  setup: async (pg: any, emscriptenOpts: any) => ({
    ...(await extension.setup(pg, emscriptenOpts)),
    bundlePath: pathToFileURL(join(extensionAssetDirectory, assetName)),
  }),
});

// The socket server uses a runtime-computed import path for built-in
// extensions. The release build patches that lookup to use this static map,
// which allows Bun to bundle both the modules and their SQL extension assets.
(globalThis as any).__PGLITE_BUILTIN_EXTENSIONS__ = {
  age: withEmbeddedBundle(age, "age.tar.gz"),
  live,
  pg_hashids: withEmbeddedBundle(pg_hashids, "pg_hashids.tar.gz"),
  pg_ivm: withEmbeddedBundle(pg_ivm, "pg_ivm.tar.gz"),
  pg_textsearch: withEmbeddedBundle(pg_textsearch, "pg_textsearch.tar.gz"),
  pg_uuidv7: withEmbeddedBundle(pg_uuidv7, "pg_uuidv7.tar.gz"),
  pgtap: withEmbeddedBundle(pgtap, "pgtap.tar.gz"),
  vector: withEmbeddedBundle(vector, "vector.tar.gz"),
};

fs.readFile = (async (path: Parameters<typeof fs.readFile>[0], ...args: any[]) => {
  const pathString = String(path);
  if (pathString.endsWith("pglite.data")) {
    return Buffer.from(embeddedData);
  }
  if (pathString.endsWith("pglite.wasm")) {
    return Buffer.from(embeddedWasm);
  }
  if (pathString.endsWith("initdb.wasm")) {
    return Buffer.from(embeddedInitdbWasm);
  }
  return originalReadFile(path as any, ...args as any);
}) as typeof fs.readFile;

await import("./node_modules/@electric-sql/pglite-socket/dist/scripts/server");
