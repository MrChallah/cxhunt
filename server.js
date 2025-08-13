import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

const TEMPLATE = process.env.UPSTREAM_TEMPLATE || "https://api.iceposeidon.com/overlay/{kick}";

// tiny in-memory cache to avoid hammering upstream
const cache = new Map();
const CACHE_MS = Number(process.env.CACHE_MS || 2000);
function getCache(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.t < CACHE_MS) return item.v;
}
function setCache(key, v) { cache.set(key, { v, t: Date.now() }); }

// Keeps the last successful overlay JSON per slug so we can serve stale data
// when upstream temporarily fails. This does not expire automatically.
const lastGoodOverlay = new Map();

async function fetchJson(url, opts = {}) {
  const cached = getCache(url);
  if (cached) return cached;
  const r = await fetch(url, { headers: { "cache-control": "no-cache" }, ...opts });
  if (!r.ok) throw new Error(`${url} -> ${r.status}`);
  const j = await r.json();
  setCache(url, j);
  return j;
}

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

// Fetch the authoritative leaderboard the event site uses and return an array of entries
// We try viewerapi first, then api as a fallback
async function fetchLeaderboard() {
  const urls = [
    "https://viewerapi.iceposeidon.com/viewer.leaderboard",
    "https://api.iceposeidon.com/viewer/leaderboard",
  ];
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      if (Array.isArray(data) && data.length) return data;
    } catch {
      // try next url
    }
  }
  return [];
}

function normalizeString(v) {
  return (v || "").toString().trim().toLowerCase();
}

// Try to find a leaderboard row for a given user
function findLeaderboardRow(leaderboard, { username, kick_slug }) {
  const name = normalizeString(username);
  const slug = normalizeString(kick_slug || username);
  let idx = leaderboard.findIndex((row) => {
    const rUser = normalizeString(row?.username);
    const rSlug = normalizeString(row?.slug || row?.kick_slug || row?.username);
    return rUser === name || rSlug === slug;
  });
  if (idx === -1) {
    // loose contains as last resort
    idx = leaderboard.findIndex((row) => normalizeString(row?.username) === name);
  }
  if (idx === -1) return null;
  return { idx, row: leaderboard[idx] };
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

      // Derive avatar + live from Kick
      const avatar = kickData?.user?.profile_pic || null;
      const is_live = Boolean(kickData?.livestream?.is_live);

      // Correct the rank (and optionally stats) using the authoritative leaderboard
      let corrected = { ...upstream };
      try {
        const leaderboard = await fetchLeaderboard();
        const match = findLeaderboardRow(leaderboard, {
          username: upstream?.username,
          kick_slug: upstream?.kick_slug,
        });
        if (match) {
          const { idx, row } = match; // idx is zero-based
          corrected.leaderboard_ranking = idx + 1;
          if (row?.points != null) corrected.points = row.points;
          // Accept multiple field names used by the event for RFID count
          if (row?.rfids_scanned != null) corrected.rfids_scanned = row.rfids_scanned;
          else if (row?.rfids != null) corrected.rfids_scanned = row.rfids;
        }
      } catch {
        // ignore leaderboard correction errors; fall back to upstream
      }

      const payload = { ...corrected, avatar, is_live };
      // Save last good responses by both the requested slug and resolved slug
      lastGoodOverlay.set(kick, payload);
      if (slug && slug !== kick) lastGoodOverlay.set(slug, payload);
      return res.json(payload);
    } catch (e) {
      // Serve last known good data for this slug if available
      const stale = lastGoodOverlay.get(kick);
      if (stale) return res.json({ ...stale, stale: true });
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