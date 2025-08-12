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

async function fetchUpstreamJson(slug) {
  const url = TEMPLATE.replace("{kick}", encodeURIComponent(slug));
  const cached = getCache(url);
  if (cached) return cached;
  const r = await fetch(url, { headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`Upstream ${r.status}`);
  const data = await r.json();
  setCache(url, data);
  return data;
}

async function fetchKickChannel(slug) {
  try {
    const r = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`, {
      headers: { "cache-control": "no-cache" },
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j;
  } catch {
    return null;
  }
}

// Main route: HTML or JSON based on ?format=json
app.get("/overlay/:kick", async (req, res) => {
  const { kick } = req.params;

  // Serve JSON when requested
  if ((req.query.format || "").toString().toLowerCase() === "json") {
    try {
      const upstream = await fetchUpstreamJson(kick);
      const slug = upstream?.kick_slug || kick;
      const kickData = await fetchKickChannel(slug);

      const avatar = kickData?.user?.profile_pic || null;
      const is_live = Boolean(kickData?.livestream?.is_live);

      // Prefer the most accurate/display-ready rank key exposed by upstream
      const rankCandidates = [
        upstream?.display_rank,
        upstream?.leaderboard_ranking_live,
        upstream?.leaderboard_position,
        upstream?.leaderboard_ranking,
        upstream?.rank,
        upstream?.position,
      ].filter((v) => v !== undefined && v !== null && v !== "");
      const display_rank = rankCandidates.length ? rankCandidates[0] : undefined;

      // Normalize a few common field names for clients
      const rfids_candidates = [
        upstream?.rfids_scanned,
        upstream?.rfids,
        upstream?.rfid_count,
      ].filter((v) => v !== undefined && v !== null && v !== "");
      const rfids_scanned = rfids_candidates.length ? rfids_candidates[0] : undefined;

      const username = upstream?.username || upstream?.name || upstream?.kick_slug || kick;

      return res.json({
        ...upstream,
        username,
        rfids_scanned,
        display_rank,
        avatar,
        is_live,
      });
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