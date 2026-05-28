/**
 * controllers/productController.js
 *
 * Handles GET /api/products
 * ─────────────────────────────────────────────────────────
 * Reads from your EXISTING /products Firestore collection.
 * Supports optional query params:
 *   ?category=vegetables
 *   ?maxPrice=200
 *   ?inStock=true
 *   ?limit=20
 */

"use strict";

const { db }           = require("../config/firebaseAdmin");
const { asyncHandler } = require("../middleware/errorHandler");

/**
 * GET /api/products
 */
const getProducts = asyncHandler(async (req, res) => {
  const {
    category,
    maxPrice,
    inStock,
    limit = 50,
  } = req.query;

  let query = db.collection("products");

  // Apply Firestore-level filters where possible
  if (category && category !== "all") {
    query = query.where("category", "==", category);
  }
  if (inStock === "true") {
    query = query.where("stock", ">", 0);
  }

  // Limit to prevent massive payloads
  const cap = Math.min(parseInt(limit) || 50, 100);
  query = query.orderBy("productName").limit(cap);

  const snap = await query.get();
  let products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Client-side filters that Firestore can't do in one query
  if (maxPrice) {
    products = products.filter(p => (p.price || 0) <= parseFloat(maxPrice));
  }

  res.json({ count: products.length, products });
});

module.exports = { getProducts };