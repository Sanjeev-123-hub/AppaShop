/**
 * controllers/recommendController.js
 *
 * Handles POST /api/recommend
 * ─────────────────────────────────────────────────────────
 * Flow:
 *   1. Validate query
 *   2. Fetch in-stock products from your existing Firestore /products collection
 *   3. Send products + query to Gemini
 *   4. Return AI-filtered recommendations
 *   5. Save to /recommendation_history (async)
 */

"use strict";

const { getProductRecommendations } = require("../services/geminiService");
const { db }                        = require("../config/firebaseAdmin");
const { asyncHandler }              = require("../middleware/errorHandler");

/**
 * POST /api/recommend
 * Body: { query: string, userId?: string }
 */
const handleRecommend = asyncHandler(async (req, res) => {
  const { query, userId = "guest" } = req.body;

  // ── Validation ───────────────────────────────────────────
  if (!query || typeof query !== "string" || query.trim().length === 0) {
    return res.status(400).json({ error: "query field is required" });
  }
  if (query.length > 300) {
    return res.status(400).json({ error: "query too long (max 300 chars)" });
  }

  // ── Fetch products from your EXISTING Firestore /products collection ──
  //    We only pass in-stock products to Gemini to avoid recommending
  //    items customers can't buy.
  const productsSnap = await db.collection("products")
    .where("stock", ">", 0)
    .limit(100)           // token safety — send max 100 to Gemini
    .get();

  if (productsSnap.empty) {
    return res.json({
      message     : "Our store is currently restocking — check back soon!",
      tip         : "",
      recommended : [],
    });
  }

  const products = productsSnap.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  }));

  // ── Ask Gemini to filter & recommend ────────────────────
  const result = await getProductRecommendations(query.trim(), products);

  // ── Save recommendation history (async, non-blocking) ───
  saveRecommendHistoryAsync(userId, query.trim(), result).catch(err =>
    console.error("Recommendation history save failed:", err.message)
  );

  res.json(result);
});

async function saveRecommendHistoryAsync(userId, query, result) {
  await db.collection("recommendation_history").add({
    userId,
    query,
    recommendedCount : result.recommended.length,
    recommendedNames : result.recommended.map(p => p.productName),
    timestamp        : new Date(),
  });
}

module.exports = { handleRecommend };