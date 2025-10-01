const express = require("express");
const router = express.Router();
const { getMonthlySales } = require("../controllers/ordersController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/monthly-sales", authMiddleware, getMonthlySales);

module.exports = router;
