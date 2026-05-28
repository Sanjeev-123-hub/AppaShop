// routes/chatRoutes.js
"use strict";
const express = require("express");
const { handleChat } = require("../controllers/chatController");
const router = express.Router();
// POST /api/chat  — AI chatbot response
router.post("/", handleChat);
module.exports = router;