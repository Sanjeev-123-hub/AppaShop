/**
 * ╔══════════════════════════════════════════════════════╗
 *   APPA GROCERIES — AI Backend Server
 *   server.js  (entry point)
 *
 *   Starts Express, mounts all route modules, and
 *   exports the app for testing.
 * ╚══════════════════════════════════════════════════════╝
 */

"use strict";

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const rateLimit  = require("express-rate-limit");
require("dotenv").config();

// ── Route modules (one file per feature) ──────────────────
const chatRoutes    = require("./routes/chatRoutes");
const recommendRoutes = require("./routes/recommendRoutes");
const productRoutes = require("./routes/productRoutes");
const searchRoutes  = require("./routes/searchRoutes");

// ── Global error handler ───────────────────────────────────
const { errorHandler } = require("./middleware/errorHandler");

const app  = express();
const PORT = process.env.PORT || 5000;

// ══════════════════════════════════════════════════════════
//  MIDDLEWARE STACK
// ══════════════════════════════════════════════════════════

// Security headers (prevents common web vulnerabilities)
app.use(helmet());

// Allow requests from your frontend origin only
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  methods: ["GET", "POST"],
}));

// Parse JSON request bodies (max 10 kb to prevent abuse)
app.use(express.json({ limit: "10kb" }));

// HTTP request logging in development
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ── Rate limiter: max 60 requests per minute per IP ───────
//   Protects the Gemini API from runaway usage / abuse
const limiter = rateLimit({
  windowMs : 60 * 1000,   // 1 minute window
  max      : 60,
  message  : { error: "Too many requests — please slow down." },
  standardHeaders: true,
  legacyHeaders : false,
});
app.use("/api", limiter);

// ══════════════════════════════════════════════════════════
//  ROUTES
//  All AI routes live under /api/*
// ══════════════════════════════════════════════════════════

app.use("/api/chat",     chatRoutes);        // POST /api/chat
app.use("/api/recommend",recommendRoutes);   // POST /api/recommend
app.use("/api/products", productRoutes);     // GET  /api/products
app.use("/api/search",   searchRoutes);      // GET  /api/search?q=...

// Health-check (useful for Vercel / Railway uptime monitors)
app.get("/health", (_req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// 404 handler — catches any unmatched route
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler (must be LAST middleware)
app.use(errorHandler);

// ══════════════════════════════════════════════════════════
//  START SERVER
// ══════════════════════════════════════════════════════════
app.listen(PORT, () => {
  console.log(`✅  Appa AI backend running on http://localhost:${PORT}`);
  console.log(`   NODE_ENV : ${process.env.NODE_ENV || "development"}`);
});

module.exports = app;