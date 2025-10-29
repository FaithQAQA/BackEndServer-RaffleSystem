const Order = require("../Models/Order");

// Get monthly sales (existing - improved)
const getMonthlySales = async (req, res) => {
  try {
    const { year } = req.query; // Optional year filter
    
    const matchStage = {};
    if (year) {
      matchStage.createdAt = {
        $gte: new Date(`${year}-01-01`),
        $lt: new Date(`${parseInt(year) + 1}-01-01`)
      };
    }

    const sales = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { 
            year: { $year: "$createdAt" }, 
            month: { $month: "$createdAt" } 
          },
          totalSales: { $sum: "$amount" },
          totalBaseAmount: { $sum: "$baseAmount" },
          totalTaxAmount: { $sum: "$taxAmount" },
          totalOrders: { $sum: 1 },
          totalTickets: { $sum: "$ticketsBought" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    const formatted = sales.map((s) => ({
      year: s._id.year,
      month: s._id.month,
      totalSales: s.totalSales,
      totalBaseAmount: s.totalBaseAmount,
      totalTaxAmount: s.totalTaxAmount,
      totalOrders: s.totalOrders,
      totalTickets: s.totalTickets,
      averageOrderValue: s.totalOrders > 0 ? (s.totalSales / s.totalOrders).toFixed(2) : 0
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching monthly sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get sales by raffle
const getSalesByRaffle = async (req, res) => {
  try {
    const sales = await Order.aggregate([
      {
        $lookup: {
          from: "raffles",
          localField: "raffleId",
          foreignField: "_id",
          as: "raffle"
        }
      },
      { $unwind: "$raffle" },
      {
        $group: {
          _id: "$raffleId",
          raffleName: { $first: "$raffle.title" },
          totalSales: { $sum: "$amount" },
          totalTickets: { $sum: "$ticketsBought" },
          totalOrders: { $sum: 1 }
        }
      },
      { $sort: { totalSales: -1 } }
    ]);

    res.json(sales);
  } catch (error) {
    console.error("Error fetching sales by raffle:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get user order history
const getUserOrderHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const orders = await Order.find({ userId })
      .populate("raffleId", "title drawDate ticketPrice")
      .sort({ createdAt: -1 });

    const formattedOrders = orders.map(order => order.getOrderSummary());
    
    res.json(formattedOrders);
  } catch (error) {
    console.error("Error fetching user order history:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get daily sales for a specific period
const getDailySales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate && endDate) {
      matchStage.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const sales = await Order.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            day: { $dayOfMonth: "$createdAt" }
          },
          totalSales: { $sum: "$amount" },
          totalOrders: { $sum: 1 },
          totalTickets: { $sum: "$ticketsBought" }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 }
      }
    ]);

    const formatted = sales.map(s => ({
      date: `${s._id.year}-${s._id.month.toString().padStart(2, '0')}-${s._id.day.toString().padStart(2, '0')}`,
      totalSales: s.totalSales,
      totalOrders: s.totalOrders,
      totalTickets: s.totalTickets
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching daily sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get orders that need receipt (for cron job or admin)
const getPendingReceipts = async (req, res) => {
  try {
    const orders = await Order.find({ 
      receiptSent: false,
      status: "completed"
    })
    .populate("userId", "email name")
    .populate("raffleId", "title")
    .sort({ createdAt: 1 });

    res.json(orders);
  } catch (error) {
    console.error("Error fetching pending receipts:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get overall statistics
const getSalesStatistics = async (req, res) => {
  try {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
          totalBaseAmount: { $sum: "$baseAmount" },
          totalTaxAmount: { $sum: "$taxAmount" },
          totalOrders: { $sum: 1 },
          totalTicketsSold: { $sum: "$ticketsBought" },
          averageOrderValue: { $avg: "$amount" },
          averageTicketsPerOrder: { $avg: "$ticketsBought" }
        }
      }
    ]);

    const result = stats[0] || {
      totalRevenue: 0,
      totalBaseAmount: 0,
      totalTaxAmount: 0,
      totalOrders: 0,
      totalTicketsSold: 0,
      averageOrderValue: 0,
      averageTicketsPerOrder: 0
    };

    res.json(result);
  } catch (error) {
    console.error("Error fetching sales statistics:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = {
  getMonthlySales,
  getSalesByRaffle,
  getUserOrderHistory,
  getDailySales,
  getPendingReceipts,
  getSalesStatistics
};