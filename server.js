import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();
app.use(cors());

/*
  Configure upstream via env:
  UPSTREAM_TEMPLATE, e.g.
  https://example.com/overlay-data?user={kick}
  The {kick} token will be replaced by :kick param.
*/
const TEMPLATE = process.env.UPSTREAM_TEMPLATE;

// Simple 2s memory cache
const cache = new Map();
function getCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.t < 2000) return item.v;
}
function setCache(key, v) { cache.set(key, { v, t: Date.now() }); }

app.get("/overlay/:kick", async (req, res) => {
  try {
    if (!TEMPLATE) return res.status(500).json({ error: "UPSTREAM_TEMPLATE not set" });
    const url = TEMPLATE.replace("{kick}", encodeURIComponent(req.params.kick));
    const cached = getCache(url);
    if (cached) return res.json(cached);

    const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
    const data = await r.json();

    // If upstream shape differs, map it here:
    // return res.json({ name: data.name, rank: data.rank, ... });

    setCache(url, data);
    res.json(data);
  } catch (e) {
    res.status(502).json({ error: "Upstream failed", detail: String(e) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log("Proxy listening on " + port));