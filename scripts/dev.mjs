import http from "node:http";
import { createServer } from "vite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
try {
  process.loadEnvFile(".env.local");
} catch {}
const vite = await createServer({
  server: { middlewareMode: true },
  appType: "spa",
});
const port = Number(process.env.PORT || 3197);
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  if (!url.pathname.startsWith("/api/")) return vite.middlewares(req, res);
  const route = url.pathname.slice(5);
  if (!/^[a-z]+$/.test(route) || !existsSync(resolve("api", route + ".js"))) {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: { code: "NOT_FOUND", message: "Endpoint unavailable." },
      }),
    );
    return;
  }
  try {
    let bytes = 0;
    const chunks = [];
    for await (const chunk of req) {
      bytes += chunk.length;
      if (bytes > 8192) {
        res.writeHead(413);
        res.end();
        return;
      }
      chunks.push(chunk);
    }
    req.query = Object.fromEntries(url.searchParams);
    if (chunks.length) {
      try {
        req.body = JSON.parse(Buffer.concat(chunks).toString());
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: { message: "Send valid JSON." } }));
        return;
      }
    }
    res.status = (n) => {
      res.statusCode = n;
      return res;
    };
    res.json = (o) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(o));
      return res;
    };
    res.send = (o) => {
      res.end(typeof o === "string" ? o : JSON.stringify(o));
      return res;
    };
    const mod = await import(pathToFileURL(resolve("api", route + ".js")).href);
    await mod.default(req, res);
  } catch (error) {
    console.error("API failed:", error.message);
    if (!res.headersSent)
      res.writeHead(500, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        error: {
          code: "SERVER_ERROR",
          message: "This request could not complete. Try again.",
        },
      }),
    );
  }
});
server.listen(port, "127.0.0.1", () =>
  console.log(`DOVET local preview: http://localhost:${port}`),
);
