const express = require("express");
const router = express.Router();
const { getMonthlySales } = require("../controllers/ordersController");
const authMiddleware = require("../middleware/authMiddleware");

// Protected route: only admins can see monthly sales
router.get("/sales/monthly", authMiddleware, getMonthlySales);

module.exports = router;
