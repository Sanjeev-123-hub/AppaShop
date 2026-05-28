// routes/searchRoutes.js
"use strict";
const express = require("express");
const { handleSearch } = require("../controllers/searchController");
const router = express.Router();
// GET /api/search?q=...  — AI-powered natural language search
router.get("/", handleSearch);
module.exports = router;