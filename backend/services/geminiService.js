/**
 * services/geminiService.js
 *
 * Single place where ALL Gemini API calls are made.
 * ─────────────────────────────────────────────────
 * • The API key lives ONLY here (loaded from .env).
 * • Controllers never touch the Gemini SDK directly —
 *   they call the exported functions below.
 * • Prompt engineering is done here so it is easy to
 *   improve prompts without touching business logic.
 */

"use strict";

const { GoogleGenerativeAI } = require("@google/generative-ai");

// ── Initialise Gemini client ───────────────────────────────
if (!process.env.GEMINI_API_KEY) {
  throw new Error("❌  GEMINI_API_KEY is not set in .env");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// We use gemini-1.5-flash — fast, cheap, great for text tasks
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// ══════════════════════════════════════════════════════════
//  SYSTEM PERSONA
//  Every prompt includes this so Gemini never goes off-topic
// ══════════════════════════════════════════════════════════
const GROCERY_PERSONA = `
You are "Appa AI", the friendly grocery assistant for Appa Groceries Shop —
a local grocery store in Tamil Nadu, India.

YOUR RULES:
1. ONLY answer questions related to groceries, food, cooking ingredients,
   kitchen products, nutrition, recipes, or shopping budgets.
2. If the user asks anything unrelated to groceries (politics, coding,
   movies, etc.) politely redirect them: "I can only help with grocery
   shopping — what would you like to buy today? 🛒"
3. Respond in the same language the user wrote in.
   If they mix Tamil and English (Tanglish), reply in Tanglish naturally.
4. Keep responses concise — no more than 200 words.
5. Format lists as clean bullet points (•).
6. Always mention prices in ₹ (Indian Rupees).
7. Be warm and helpful — like a knowledgeable shop owner.
`.trim();

// ══════════════════════════════════════════════════════════
//  FUNCTION 1 — CHATBOT RESPONSE
//  Used by: POST /api/chat
// ══════════════════════════════════════════════════════════

/**
 * Generate a grocery chatbot reply.
 *
 * @param {string} userMessage   — what the customer typed
 * @param {Array}  history       — previous [{role, text}] turns (optional)
 * @returns {Promise<string>}    — Gemini's reply text
 */
async function getChatResponse(userMessage, history = []) {
  // Build a multi-turn conversation prompt
  const conversationHistory = history
    .slice(-6)   // keep last 6 turns to avoid token overload
    .map(h => `${h.role === "user" ? "Customer" : "Appa AI"}: ${h.text}`)
    .join("\n");

  const prompt = `
${GROCERY_PERSONA}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}\n` : ""}
Customer: ${userMessage}
Appa AI:`.trim();

  try {
    const result   = await model.generateContent(prompt);
    const response = result.response;
    return response.text().trim();
  } catch (err) {
    console.error("Gemini chat error:", err.message);
    throw new Error("AI service temporarily unavailable. Please try again.");
  }
}

// ══════════════════════════════════════════════════════════
//  FUNCTION 2 — PRODUCT RECOMMENDATION
//  Used by: POST /api/recommend
// ══════════════════════════════════════════════════════════

/**
 * Ask Gemini to recommend products from the store's inventory.
 *
 * @param {string} userQuery     — e.g. "breakfast items under ₹300"
 * @param {Array}  products      — array of product objects from Firestore
 * @returns {Promise<Object>}    — { response: string, recommended: Array }
 */
async function getProductRecommendations(userQuery, products) {
  // Build a compact product list for the prompt (stay within token limits)
  const productList = products
    .slice(0, 80)  // max 80 products per call
    .map(p =>
      `• ${p.productName} | ₹${p.price} | ${p.category} | Stock: ${p.stock > 0 ? "available" : "out of stock"} | Tags: ${(p.tags || []).join(", ")}`
    )
    .join("\n");

  const prompt = `
${GROCERY_PERSONA}

TASK: The customer is looking for: "${userQuery}"

AVAILABLE PRODUCTS IN THE STORE:
${productList}

INSTRUCTIONS:
1. From the list above, pick the BEST matching products for the customer's request.
2. Consider: budget, category, health needs, occasion, and availability.
3. Only recommend products that are IN STOCK (Stock: available).
4. Return your answer in this EXACT JSON format (no extra text before or after):
{
  "message": "A warm 2-3 sentence response explaining your recommendations",
  "recommendedIds": ["exact productName 1", "exact productName 2", "exact productName 3"],
  "tip": "One helpful shopping tip related to the query"
}
`.trim();

  try {
    const result       = await model.generateContent(prompt);
    const rawText      = result.response.text().trim();

    // Safely parse JSON — Gemini sometimes wraps in markdown code fences
    const jsonString   = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed       = JSON.parse(jsonString);

    // Match recommended names back to actual product objects
    const recommended  = products.filter(p =>
      (parsed.recommendedIds || []).some(name =>
        p.productName.toLowerCase().includes(name.toLowerCase())
      )
    );

    return {
      message      : parsed.message || "Here are my recommendations for you!",
      tip          : parsed.tip     || "",
      recommended,   // full product objects ready to render on frontend
    };

  } catch (err) {
    console.error("Gemini recommend error:", err.message);
    // Graceful fallback — keyword match instead of AI
    const keywords   = userQuery.toLowerCase().split(/\s+/);
    const fallback   = products.filter(p =>
      keywords.some(kw =>
        p.productName.toLowerCase().includes(kw) ||
        (p.tags || []).some(t => t.toLowerCase().includes(kw)) ||
        (p.category || "").toLowerCase().includes(kw)
      )
    ).slice(0, 6);

    return {
      message     : "Here are some products that might match your request:",
      tip         : "",
      recommended : fallback,
    };
  }
}

// ══════════════════════════════════════════════════════════
//  FUNCTION 3 — SMART SEARCH SUGGESTION
//  Used by: GET /api/search
// ══════════════════════════════════════════════════════════

/**
 * Turn a natural-language search query into structured filters.
 *
 * @param {string} query  — e.g. "protein rich food under 200"
 * @returns {Promise<Object>} — { keywords: [], maxPrice: number|null, categories: [] }
 */
async function parseSearchQuery(query) {
  const prompt = `
You are a grocery search parser. Extract search intent from this query: "${query}"

Return ONLY valid JSON (no markdown, no explanation):
{
  "keywords"   : ["keyword1", "keyword2"],
  "maxPrice"   : 200,
  "categories" : ["grains", "dairy"],
  "tags"       : ["protein", "healthy"]
}

Rules:
- keywords: important product words from the query
- maxPrice: number if budget mentioned, else null
- categories: only from [vegetables, fruits, grains, dairy, spices, snacks, oil, other]
- tags: health/occasion tags if mentioned
`.trim();

  try {
    const result     = await model.generateContent(prompt);
    const rawText    = result.response.text().trim();
    const jsonString = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonString);
  } catch {
    // Fallback: simple split
    return { keywords: query.split(/\s+/), maxPrice: null, categories: [], tags: [] };
  }
}

module.exports = { getChatResponse, getProductRecommendations, parseSearchQuery };