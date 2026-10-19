import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const port = Number(process.env.DEMO_PORT ?? 4174);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("DEMO_PORT must be a valid port");

const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response("Method not allowed", { status: 405 });
    let pathname: string;
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname);
    } catch {
      return new Response("Invalid path", { status: 400 });
    }
    const demoFiles = new Set(["/demo/index.html", "/demo/style.css", "/demo/main.js"]);
    if (pathname === "/" || pathname === "/demo" || pathname === "/demo/") pathname = "/demo/index.html";
    const filePath = resolve(root, `.${pathname}`);
    const compiled = filePath.startsWith(`${resolve(root, "dist")}${sep}`) && /\.(?:js|ts)$/.test(filePath);
    if (!demoFiles.has(pathname) && !compiled) return new Response("Not found", { status: 404 });
    const file = Bun.file(filePath);
    if (!(await file.exists())) return new Response("Not found", { status: 404 });
    return new Response(request.method === "HEAD" ? null : file, {
      headers: {
        "Content-Type": file.type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'",
      },
    });
  },
});
console.log(`Demo: http://${server.hostname}:${server.port}/demo/`);
