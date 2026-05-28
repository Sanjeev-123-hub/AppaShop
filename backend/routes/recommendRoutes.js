// routes/recommendRoutes.js
"use strict";
const express = require("express");
const { handleRecommend } = require("../controllers/recommendController");
const router = express.Router();
// POST /api/recommend  — AI product recommendations
router.post("/", handleRecommend);
module.exports = router;