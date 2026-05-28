/**
 * controllers/chatController.js
 *
 * Handles POST /api/chat
 * ─────────────────────────────────────────────────────────
 * Flow:
 *   1. Validate request body
 *   2. Call Gemini for a reply
 *   3. Log conversation to Firestore (async, non-blocking)
 *   4. Return AI reply to frontend
 */

"use strict";

const { getChatResponse }    = require("../services/geminiService");
const { db }                 = require("../config/firebaseAdmin");
const { asyncHandler }       = require("../middleware/errorHandler");

/**
 * POST /api/chat
 * Body: { message: string, history: Array, sessionId: string }
 */
const handleChat = asyncHandler(async (req, res) => {
  const { message, history = [], sessionId = "anonymous" } = req.body;

  // ── Input validation ─────────────────────────────────────
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "message field is required" });
  }
  if (message.trim().length === 0) {
    return res.status(400).json({ error: "message cannot be empty" });
  }
  if (message.length > 500) {
    return res.status(400).json({ error: "message too long (max 500 chars)" });
  }

  // ── Get AI reply ─────────────────────────────────────────
  const aiReply = await getChatResponse(message.trim(), history);

  // ── Log to Firestore (fire-and-forget — don't block the response) ──
  logChatAsync(sessionId, message.trim(), aiReply).catch(err =>
    console.error("Chat log failed (non-critical):", err.message)
  );

  res.json({ reply: aiReply });
});

/**
 * Stores one chat turn in /chatbot_logs/{sessionId}/messages
 * Non-blocking — errors are caught silently so a DB issue
 * never breaks the chat experience.
 */
async function logChatAsync(sessionId, userMsg, aiReply) {
  const sessionRef = db.collection("chatbot_logs").doc(sessionId);

  // Upsert the session document
  await sessionRef.set({
    sessionId,
    lastActive : new Date(),
    updatedAt  : new Date(),
  }, { merge: true });

  // Append message pair as a subcollection entry
  await sessionRef.collection("messages").add({
    userMessage : userMsg,
    aiReply,
    timestamp   : new Date(),
  });
}

module.exports = { handleChat };