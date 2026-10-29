import { readFile, writeFile } from "node:fs/promises";

const serverPath = new URL(
  "../node_modules/@electric-sql/pglite-socket/dist/scripts/server.js",
  import.meta.url,
);
const source = await readFile(serverPath, "utf8");
const dynamicBuiltinImport = "s=(await import(`@electric-sql/pglite/${t}`))[t]";
const bundledBuiltinLookup = "s=globalThis.__PGLITE_BUILTIN_EXTENSIONS__?.[t]";

if (source.includes(bundledBuiltinLookup)) {
  process.exit(0);
}

if (!source.includes(dynamicBuiltinImport)) {
  throw new Error(
    "Could not patch pglite-socket's built-in extension loader. " +
      "Check the installed @electric-sql/pglite-socket version.",
  );
}

await writeFile(serverPath, source.replace(dynamicBuiltinImport, bundledBuiltinLookup));
