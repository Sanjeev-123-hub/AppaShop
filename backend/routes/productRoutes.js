// routes/productRoutes.js
"use strict";
const express = require("express");
const { getProducts } = require("../controllers/productController");
const router = express.Router();
// GET /api/products  — fetch products with optional filters
router.get("/", getProducts);
module.exports = router;