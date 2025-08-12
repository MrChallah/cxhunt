import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const TEMPLATE = process.env.UPSTREAM_TEMPLATE || "https://api.iceposeidon.com/overlay/{kick}";

// tiny in-memory cache to avoid hammering upstream
const cache = new Map();
const CACHE_MS = Number(process.env.CACHE_MS || 2000);
function getCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.t < CACHE_MS) return item.v;
}
function setCache(key, v) { cache.set(key, { v, t: Date.now() }); }

// Health
app.get(["/", "/health"], (_req, res) => {
  res.type("text").send("ok");
});

// Main route: HTML or JSON based on ?format=json
app.get("/overlay/:kick", async (req, res) => {
  const { kick } = req.params;

  // Serve JSON when requested
  if ((req.query.format || "").toString().toLowerCase() === "json") {
    try {
      const url = TEMPLATE.replace("{kick}", encodeURIComponent(kick));
      const cached = getCache(url);
      if (cached) return res.json(cached);

      const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
      if (!r.ok) return res.status(r.status).json({ error: `Upstream ${r.status}` });
      const data = await r.json();
      setCache(url, data);
      return res.json(data);
    } catch (e) {
      return res.status(502).json({ error: "Upstream failed", detail: String(e) });
    }
  }

  // Otherwise, render the overlay HTML file (transparent Tailwind overlay)
  res.sendFile(path.join(__dirname, "overlay.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log("Overlay server listening on " + port);
});