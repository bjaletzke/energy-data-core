import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

const root = resolve(import.meta.dir, "..");
const expected = new Set([
  "src/index.ts", "src/model.ts", "src/lng.ts", "src/regions.ts", "src/countries.ts",
  ...["index", "items", "xml", "documents", "series", "aggregate", "products", "flows", "zones"].map(name => `src/entsoe/${name}.ts`),
]);
const files = (await readdir(resolve(root, "src"), { recursive: true, withFileTypes: true }))
  .filter(entry => entry.isFile()).map(entry => relative(root, resolve(entry.parentPath, entry.name)));
if (files.length !== expected.size || files.some(file => !expected.has(file))) throw new Error("Source allowlist changed; review the public/private boundary");
for (const file of files) {
  const source = await readFile(resolve(root, file), "utf8");
  if (/\b(?:fetch\s*\(|XMLHttpRequest\b|WebSocket\b|Bun\s*\.|process\s*\.\s*env\b)/.test(source)) throw new Error(`Runtime or network dependency in ${file}`);
  const imports = [...source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)];
  for (const [, specifier] of imports) {
    if (!specifier?.startsWith(".")) throw new Error(`External runtime import in ${file}`);
    const target = relative(root, resolve(root, file, "..", specifier));
    if (!expected.has(target)) throw new Error(`Import crosses source boundary: ${file}`);
  }
}
const manifest = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
if (Object.keys(manifest.dependencies ?? {}).length) throw new Error("Expected zero runtime dependencies");
if (manifest.private !== true) throw new Error("npm publication is intentionally disabled; public Git sharing is separate");
for (const folder of ["src", "tests", "demo"]) {
  const entries = await readdir(resolve(root, folder), { recursive: true, withFileTypes: true });
  for (const entry of entries.filter(entry => entry.isFile())) {
    const path = resolve(entry.parentPath, entry.name);
    const content = await readFile(path, "utf8");
    if (/\b\d{2}Y[A-Z0-9-]{13}\b/.test(content)) throw new Error(`Production-format EIC literal in ${relative(root, path)}`);
    if (/export\s+const\s+(?:ZONES|ENTSOE_COUNTRIES)\b/.test(content)) throw new Error(`Bundled catalogue in ${relative(root, path)}`);
  }
}
for (const path of [".npmrc", ".env", ".dev.vars", "wrangler.jsonc", "server", "worker", "prototypes", "public"]) {
  if (await Bun.file(resolve(root, path)).exists() || (await readdir(root)).includes(path)) throw new Error(`Excluded material present: ${path}`);
}
console.log(`Boundary passed: ${files.length} allowlisted source files, no external runtime imports or hosted configuration.`);
