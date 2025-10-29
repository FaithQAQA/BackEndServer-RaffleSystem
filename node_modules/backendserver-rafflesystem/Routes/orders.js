const express = require("express");
const router = express.Router();
const {
  getMonthlySales,
  getSalesByRaffle,
  getUserOrderHistory,
  getDailySales,
  getPendingReceipts,
  getSalesStatistics
} = require("../controllers/ordersController");
const authMiddleware = require("../middleware/authMiddleware");
const Order = require("../Models/Order");

// ==========================
// 🧾 USER ROUTES
// ==========================

// Get current user's orders
router.get("/user/my-orders", authMiddleware, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.id })
      .populate("raffleId", "title price")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching user orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get a specific user's order history (admin or same user)
router.get("/user/:userId/history", authMiddleware, getUserOrderHistory);

// ==========================
// 📊 SALES / ANALYTICS ROUTES
// ==========================

router.get("/sales/monthly", authMiddleware, getMonthlySales);
router.get("/sales/daily", authMiddleware, getDailySales);
router.get("/sales/by-raffle", authMiddleware, getSalesByRaffle);
router.get("/sales/statistics", authMiddleware, getSalesStatistics);
router.get("/receipts/pending", authMiddleware, getPendingReceipts);

// ==========================
// 🛒 ADMIN ROUTES
// ==========================

// Get all orders (admin only)
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!req.user.isAdmin) {
      return res.status(403).json({ error: "Admin access required" });
    }

    const orders = await Order.find()
      .populate("raffleId", "title price")
      .populate("userId", "username email")
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching all orders:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ==========================
// 📦 INDIVIDUAL ORDER ROUTE
// ==========================

// ⚠️ MUST BE LAST: handles /:id safely
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("raffleId", "title price")
      .populate("userId", "username email");

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Allow only owner or admin
    if (order.userId._id.toString() !== req.user.id && !req.user.isAdmin) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json(order);
  } catch (error) {
    console.error("Error fetching order:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
