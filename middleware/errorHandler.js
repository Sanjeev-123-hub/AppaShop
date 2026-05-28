/**
 * middleware/errorHandler.js
 *
 * Two exports:
 *   asyncHandler(fn)  — wraps async route handlers so you never
 *                       need try/catch inside controllers.
 *   errorHandler      — Express global error middleware (4 params).
 */

"use strict";

/**
 * Wraps an async Express handler so uncaught rejections
 * are passed to next() automatically.
 *
 * Usage in controller:
 *   const handleChat = asyncHandler(async (req, res) => { ... });
 */
const asyncHandler = fn => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Global error handler — must be the LAST app.use() in server.js.
 * Formats all errors as consistent JSON.
 */
const errorHandler = (err, req, res, _next) => {
  // Log full error in development; minimal in production
  if (process.env.NODE_ENV !== "production") {
    console.error("❌  Error:", err.message);
    console.error(err.stack);
  } else {
    console.error("❌  Error:", err.message);
  }

  // Firebase / Firestore errors
  if (err.code && err.code.startsWith("firestore/")) {
    return res.status(503).json({
      error: "Database error — please try again later.",
    });
  }

  // Gemini API quota / key errors
  if (err.message && err.message.includes("API key")) {
    return res.status(500).json({
      error: "AI service configuration error.",
    });
  }

  // Generic
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || "Something went wrong — please try again.",
  });
};

module.exports = { asyncHandler, errorHandler };