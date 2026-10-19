import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
const output = resolve(root, "demo-dist");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await cp(resolve(root, "demo"), resolve(output, "demo"), { recursive: true });
await cp(resolve(root, "dist"), resolve(output, "dist"), { recursive: true });
await cp(resolve(root, "demo/index.html"), resolve(output, "index.html"));
console.log("Static demo built in demo-dist/. Serve it at the root of an HTTP origin.");
