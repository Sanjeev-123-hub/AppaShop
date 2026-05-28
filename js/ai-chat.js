/**
 * ai-chat.js
 * ─────────────────────────────────────────────────────────
 * Self-contained AI chatbot + recommendation widget.
 *
 * HOW TO ADD TO ANY EXISTING PAGE:
 *   1. Link the CSS:   <link rel="stylesheet" href="/css/ai-chat.css" />
 *   2. Set the API URL before this script:
 *        <script>window.APPA_AI_URL = "http://localhost:5000";</script>
 *   3. Add this script: <script src="/js/ai-chat.js"></script>
 *   That's it. The chatbot button appears automatically.
 *
 * NO changes needed to your existing HTML, CSS, or Firebase code.
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════════════════
     CONFIGURATION
  ══════════════════════════════════════════════════════ */
  const API_URL = window.APPA_AI_URL || "http://localhost:5000";
  const MAX_HISTORY = 10; // keep last N turns in memory

  /* ══════════════════════════════════════════════════════
     STATE
  ══════════════════════════════════════════════════════ */
  let isOpen        = false;
  let isTyping      = false;
  let chatHistory   = [];   // [{ role: "user"|"bot", text: string }]
  let sessionId     = "session_" + Date.now(); // unique per page load
  let hasGreeted    = false;

  /* ══════════════════════════════════════════════════════
     BUILD HTML WIDGET
     Injected once into document.body at page load.
  ══════════════════════════════════════════════════════ */
  function buildWidget() {
    const html = `
      <!-- Floating launcher button -->
      <button class="ac-launcher" id="acLauncher" aria-label="Open Appa AI chat">
        <i class="fas fa-robot"></i>
        <span class="ac-launcher-badge" id="acBadge">1</span>
      </button>

      <!-- Chat window -->
      <div class="ac-window" id="acWindow" role="dialog" aria-label="Appa AI Chat">

        <!-- Header -->
        <div class="ac-header">
          <div class="ac-header-avatar">🛒</div>
          <div class="ac-header-info">
            <div class="ac-header-name">Appa AI</div>
            <div class="ac-header-status">
              <span class="ac-status-dot"></span> Grocery Assistant
            </div>
          </div>
          <button class="ac-close-btn" id="acClose" aria-label="Close chat">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- Quick prompt chips -->
        <div class="ac-quick-prompts" id="acQuickPrompts">
          <button class="ac-quick-btn" data-msg="Suggest snacks under ₹100">🍿 Snacks</button>
          <button class="ac-quick-btn" data-msg="Healthy breakfast items under ₹200">🥗 Healthy</button>
          <button class="ac-quick-btn" data-msg="Festival shopping list for Diwali">🪔 Diwali</button>
          <button class="ac-quick-btn" data-msg="Protein rich foods under ₹300">💪 Protein</button>
          <button class="ac-quick-btn" data-msg="Monthly grocery list under ₹1000">📋 Monthly</button>
        </div>

        <!-- Messages area -->
        <div class="ac-messages" id="acMessages"></div>

        <!-- Input row -->
        <div class="ac-input-row">
          <textarea
            class="ac-input"
            id="acInput"
            placeholder="Ask about groceries…"
            rows="1"
            aria-label="Chat message input"
          ></textarea>
          <button class="ac-send-btn" id="acSend" aria-label="Send message">
            <i class="fas fa-paper-plane"></i>
          </button>
        </div>

        <div class="ac-footer">Powered by Gemini AI · Grocery assistant only</div>
      </div>`;

    const wrapper = document.createElement("div");
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  /* ══════════════════════════════════════════════════════
     OPEN / CLOSE TOGGLE
  ══════════════════════════════════════════════════════ */
  function openChat() {
    isOpen = true;
    document.getElementById("acWindow").classList.add("open");
    document.getElementById("acBadge").style.display = "none";
    document.getElementById("acInput").focus();

    // Show welcome message on first open
    if (!hasGreeted) {
      hasGreeted = true;
      setTimeout(() => {
        appendBotMessage(
          "👋 Vanakkam! I'm Appa AI — your grocery assistant.\n\n" +
          "I can help you:\n" +
          "• Find products in your budget\n" +
          "• Suggest healthy foods\n" +
          "• Plan festival shopping\n\n" +
          "What are you looking for today? 🛒",
          false // don't call API for greeting
        );
      }, 300);
    }
  }

  function closeChat() {
    isOpen = false;
    document.getElementById("acWindow").classList.remove("open");
  }

  /* ══════════════════════════════════════════════════════
     SEND MESSAGE FLOW
  ══════════════════════════════════════════════════════ */
  async function sendMessage(messageText) {
    const text = (messageText || document.getElementById("acInput").value).trim();
    if (!text || isTyping) return;

    // Clear input and append user bubble
    document.getElementById("acInput").value = "";
    autoResizeInput();
    appendUserMessage(text);

    // Save to history
    chatHistory.push({ role: "user", text });
    if (chatHistory.length > MAX_HISTORY) chatHistory.shift();

    // Show typing indicator
    isTyping = true;
    document.getElementById("acSend").disabled = true;
    const typingId = showTypingIndicator();

    try {
      const response = await fetch(`${API_URL}/api/chat`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({
          message   : text,
          history   : chatHistory.slice(-6),
          sessionId,
        }),
      });

      removeTypingIndicator(typingId);

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Server error");
      }

      const data  = await response.json();
      const reply = data.reply || "Sorry, I didn't get that. Please try again.";

      appendBotMessage(reply);
      chatHistory.push({ role: "bot", text: reply });
      if (chatHistory.length > MAX_HISTORY) chatHistory.shift();

      // If the reply looks like it recommends products, show a search CTA
      if (/recommend|suggest|show|here are/i.test(reply)) {
        appendRecommendPrompt(text);
      }

    } catch (err) {
      removeTypingIndicator(typingId);
      appendBotMessage(
        "⚠️ I'm having trouble connecting right now. " +
        "Please check your internet and try again."
      );
      console.error("Chat API error:", err.message);
    } finally {
      isTyping = false;
      document.getElementById("acSend").disabled = false;
      document.getElementById("acInput").focus();
    }
  }

  /* ══════════════════════════════════════════════════════
     RECOMMENDATION FETCH (inline in chat)
  ══════════════════════════════════════════════════════ */
  async function fetchRecommendations(query) {
    const typingId = showTypingIndicator();
    try {
      const response = await fetch(`${API_URL}/api/recommend`, {
        method  : "POST",
        headers : { "Content-Type": "application/json" },
        body    : JSON.stringify({ query }),
      });

      removeTypingIndicator(typingId);

      if (!response.ok) throw new Error("Recommend API error");

      const data = await response.json();

      // Show message from Gemini
      if (data.message) appendBotMessage(data.message);
      if (data.tip)     appendBotMessage(`💡 Tip: ${data.tip}`);

      // Render product cards
      if (data.recommended && data.recommended.length > 0) {
        appendProductCards(data.recommended.slice(0, 5));
      } else {
        appendBotMessage("I couldn't find matching products right now — try a different query!");
      }
    } catch (err) {
      removeTypingIndicator(typingId);
      appendBotMessage("⚠️ Couldn't load recommendations. Please try again.");
      console.error("Recommend API error:", err.message);
    }
  }

  /* ══════════════════════════════════════════════════════
     DOM HELPERS — append messages
  ══════════════════════════════════════════════════════ */

  function appendUserMessage(text) {
    const msgs = document.getElementById("acMessages");
    const div  = document.createElement("div");
    div.className = "ac-msg user";
    div.innerHTML = `<div class="ac-bubble">${escapeHTML(text)}</div>`;
    msgs.appendChild(div);
    scrollToBottom();
  }

  function appendBotMessage(text) {
    const msgs = document.getElementById("acMessages");
    const div  = document.createElement("div");
    div.className = "ac-msg bot";
    div.innerHTML = `
      <div class="ac-avatar">🤖</div>
      <div class="ac-bubble">${formatBotText(text)}</div>`;
    msgs.appendChild(div);
    scrollToBottom();
  }

  /** CTA button that triggers inline product fetch */
  function appendRecommendPrompt(query) {
    const msgs = document.getElementById("acMessages");
    const div  = document.createElement("div");
    div.className = "ac-msg bot";
    div.innerHTML = `
      <div class="ac-avatar">🤖</div>
      <div class="ac-bubble" style="padding:6px 10px">
        <button
          style="background:#e8f5e9;border:1.5px solid #a5d6a7;color:#2e7d32;
                 border-radius:20px;padding:5px 14px;font-size:.78rem;
                 font-weight:700;cursor:pointer;border:none"
          onclick="window.__acShowProducts(this, '${escapeHTML(query)}')">
          🛒 Show matching products
        </button>
      </div>`;
    msgs.appendChild(div);
    scrollToBottom();
  }

  /** Render product recommendation cards inside chat */
  function appendProductCards(products) {
    const msgs  = document.getElementById("acMessages");
    const cards = products.map(p => {
      const img = p.imageURL
        ? `<img class="ac-rec-img" src="${escapeHTML(p.imageURL)}" alt="${escapeHTML(p.productName)}" onerror="this.src='https://placehold.co/44x44/e8f5e9/2e7d32?text=🛒'" />`
        : `<div class="ac-rec-img" style="display:flex;align-items:center;justify-content:center;font-size:1.3rem">🛒</div>`;

      return `
        <div class="ac-rec-card">
          ${img}
          <div>
            <div class="ac-rec-name">${escapeHTML(p.productName)}</div>
            <div class="ac-rec-price">₹${p.price}</div>
            <div class="ac-rec-cat">${escapeHTML(p.category || "")}</div>
          </div>
        </div>`;
    }).join("");

    const div = document.createElement("div");
    div.className = "ac-msg bot";
    div.innerHTML = `
      <div class="ac-avatar">🤖</div>
      <div class="ac-bubble" style="background:transparent;padding:4px 0">
        <div class="ac-rec-cards">${cards}</div>
      </div>`;
    msgs.appendChild(div);
    scrollToBottom();
  }

  function showTypingIndicator() {
    const msgs = document.getElementById("acMessages");
    const id   = "typing_" + Date.now();
    const div  = document.createElement("div");
    div.className = "ac-msg bot ac-typing";
    div.id        = id;
    div.innerHTML = `
      <div class="ac-avatar">🤖</div>
      <div class="ac-bubble">
        <div class="ac-dots">
          <div class="ac-dot"></div>
          <div class="ac-dot"></div>
          <div class="ac-dot"></div>
        </div>
      </div>`;
    msgs.appendChild(div);
    scrollToBottom();
    return id;
  }

  function removeTypingIndicator(id) {
    document.getElementById(id)?.remove();
  }

  function scrollToBottom() {
    const msgs = document.getElementById("acMessages");
    msgs.scrollTop = msgs.scrollHeight;
  }

  /* ══════════════════════════════════════════════════════
     TEXT FORMATTERS
  ══════════════════════════════════════════════════════ */

  /** Convert plain text to safe HTML with line breaks and bullet styling */
  function formatBotText(text) {
    return escapeHTML(text)
      .replace(/\n/g, "<br>")
      .replace(/^•\s(.+)$/gm, '<span style="display:block;padding-left:8px">• $1</span>');
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ══════════════════════════════════════════════════════
     AUTO-RESIZE TEXTAREA
  ══════════════════════════════════════════════════════ */
  function autoResizeInput() {
    const input = document.getElementById("acInput");
    if (!input) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 80) + "px";
  }

  /* ══════════════════════════════════════════════════════
     INIT — runs after DOM is ready
  ══════════════════════════════════════════════════════ */
  function init() {
    buildWidget();

    // Wire up events
    document.getElementById("acLauncher").addEventListener("click", openChat);
    document.getElementById("acClose").addEventListener("click", closeChat);
    document.getElementById("acSend").addEventListener("click", () => sendMessage());

    // Send on Enter (Shift+Enter = new line)
    document.getElementById("acInput").addEventListener("keydown", e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    document.getElementById("acInput").addEventListener("input", autoResizeInput);

    // Quick prompt chips
    document.getElementById("acQuickPrompts").addEventListener("click", e => {
      const btn = e.target.closest(".ac-quick-btn");
      if (!btn) return;
      if (!isOpen) openChat();
      setTimeout(() => sendMessage(btn.dataset.msg), isOpen ? 0 : 400);
    });

    // Show badge on launcher (hint: someone has a message waiting)
    setTimeout(() => {
      const badge = document.getElementById("acBadge");
      if (!isOpen && badge) {
        badge.style.display = "flex";
      }
    }, 3000);

    // Global function used by the inline "Show products" button
    window.__acShowProducts = async (btn, query) => {
      btn.disabled = true;
      btn.textContent = "Loading…";
      if (!isOpen) openChat();
      await fetchRecommendations(query);
    };

    console.log("🤖  Appa AI chatbot widget initialised");
  }

  // Wait for DOM
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})(); // end IIFE