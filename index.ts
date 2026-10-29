import { createRequire, syncBuiltinESMExports } from "node:module";
import { Readable } from "node:stream";

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
const nodeFs = require("node:fs") as typeof import("node:fs");
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
const extensionAssetForPath = (path: unknown): ArrayBuffer | undefined => {
  const pathString = String(path);
  for (const [assetName, contents] of embeddedExtensionAssets) {
    if (pathString.endsWith(assetName)) {
      return contents;
    }
  }
  return undefined;
};

const originalExistsSync = nodeFs.existsSync;
nodeFs.existsSync = ((path: Parameters<typeof nodeFs.existsSync>[0]) =>
  extensionAssetForPath(path) ? true : originalExistsSync(path)) as typeof nodeFs.existsSync;

const originalCreateReadStream = nodeFs.createReadStream;
nodeFs.createReadStream = ((path: Parameters<typeof nodeFs.createReadStream>[0], ...args: any[]) => {
  const contents = extensionAssetForPath(path);
  if (contents) {
    return Readable.from([Buffer.from(contents)]);
  }
  return originalCreateReadStream(path as any, ...args as any);
}) as typeof nodeFs.createReadStream;
syncBuiltinESMExports();

// The socket server uses a runtime-computed import path for built-in
// extensions. The release build patches that lookup to use this static map,
// which allows Bun to bundle both the modules and their SQL extension assets.
(globalThis as any).__PGLITE_BUILTIN_EXTENSIONS__ = {
  age,
  live,
  pg_hashids,
  pg_ivm,
  pg_textsearch,
  pg_uuidv7,
  pgtap,
  vector,
};

fs.readFile = (async (path: Parameters<typeof fs.readFile>[0], ...args: any[]) => {
  const pathString = String(path);
  const extensionContents = extensionAssetForPath(pathString);
  if (extensionContents) {
    return Buffer.from(extensionContents);
  }
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
