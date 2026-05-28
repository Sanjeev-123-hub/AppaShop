/**
 * controllers/searchController.js
 *
 * Handles GET /api/search?q=...
 * ─────────────────────────────────────────────────────────
 * Flow:
 *   1. Parse the natural-language query with Gemini
 *      (extracts keywords, budget, categories, tags)
 *   2. Query Firestore using the extracted filters
 *   3. Do in-memory keyword scoring for relevance ranking
 *   4. Log the search to /customer_searches
 *   5. Return results
 */

"use strict";

const { parseSearchQuery } = require("../services/geminiService");
const { db }               = require("../config/firebaseAdmin");
const { asyncHandler }     = require("../middleware/errorHandler");

/**
 * GET /api/search?q=protein rich food under 200
 */
const handleSearch = asyncHandler(async (req, res) => {
  const { q, userId = "guest" } = req.query;

  if (!q || q.trim().length === 0) {
    return res.status(400).json({ error: "q (query) parameter is required" });
  }
  if (q.length > 200) {
    return res.status(400).json({ error: "query too long" });
  }

  // ── Parse query with Gemini ──────────────────────────────
  const parsed = await parseSearchQuery(q.trim());
  // parsed = { keywords, maxPrice, categories, tags }

  // ── Fetch candidate products from Firestore ──────────────
  let dbQuery = db.collection("products").where("stock", ">", 0);

  // If Gemini identified a specific category, filter in DB
  if (parsed.categories && parsed.categories.length === 1) {
    dbQuery = dbQuery.where("category", "==", parsed.categories[0]);
  }

  const snap     = await dbQuery.limit(100).get();
  let products   = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // ── In-memory scoring ────────────────────────────────────
  const keywords = [
    ...(parsed.keywords  || []),
    ...(parsed.tags      || []),
    ...(parsed.categories|| []),
  ].map(k => k.toLowerCase());

  // Apply price filter
  if (parsed.maxPrice) {
    products = products.filter(p => (p.price || 0) <= parsed.maxPrice);
  }

  // Score each product by how many keywords it matches
  const scored = products.map(p => {
    const searchable = [
      p.productName || "",
      p.category    || "",
      p.description || "",
      ...(p.tags    || []),
    ].join(" ").toLowerCase();

    const score = keywords.filter(kw => searchable.includes(kw)).length;
    return { ...p, _score: score };
  });

  // Sort by score (most relevant first), then alphabetically
  const results = scored
    .filter(p => p._score > 0 || keywords.length === 0)
    .sort((a, b) => b._score - a._score || a.productName.localeCompare(b.productName))
    .slice(0, 30)
    .map(({ _score, ...p }) => p);  // strip internal _score field

  // ── Log search (async) ───────────────────────────────────
  db.collection("customer_searches").add({
    userId,
    query     : q.trim(),
    parsed,
    resultCount: results.length,
    timestamp : new Date(),
  }).catch(err => console.error("Search log failed:", err.message));

  res.json({ count: results.length, parsed, results });
});

module.exports = { handleSearch };