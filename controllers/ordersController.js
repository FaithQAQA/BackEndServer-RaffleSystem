const Order = require("../Models/Order");

// Main controller functions
const getMonthlySales = async (req, res) => {
  try {
    const { year } = req.query;
    const salesData = await fetchMonthlySalesData(year);
    const formattedSales = formatMonthlySalesData(salesData);
    res.json(formattedSales);
  } catch (error) {
    handleServerError(res, error, "Error fetching monthly sales");
  }
};

const getSalesByRaffle = async (req, res) => {
  try {
    const raffleSales = await fetchSalesByRaffle();
    res.json(raffleSales);
  } catch (error) {
    handleServerError(res, error, "Error fetching sales by raffle");
  }
};

const getUserOrderHistory = async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = await fetchUserOrders(userId);
    const formattedOrders = formatUserOrders(orders);
    res.json(formattedOrders);
  } catch (error) {
    handleServerError(res, error, "Error fetching user order history");
  }
};

const getDailySales = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dailySales = await fetchDailySalesData(startDate, endDate);
    const formattedSales = formatDailySalesData(dailySales);
    res.json(formattedSales);
  } catch (error) {
    handleServerError(res, error, "Error fetching daily sales");
  }
};

const getPendingReceipts = async (req, res) => {
  try {
    const pendingOrders = await fetchPendingReceiptOrders();
    res.json(pendingOrders);
  } catch (error) {
    handleServerError(res, error, "Error fetching pending receipts");
  }
};

const getSalesStatistics = async (req, res) => {
  try {
    const statistics = await fetchSalesStatistics();
    res.json(statistics);
  } catch (error) {
    handleServerError(res, error, "Error fetching sales statistics");
  }
};

// Data fetching functions
const fetchMonthlySalesData = async (year) => {
  const matchStage = buildDateMatchStageForYear(year);
  
  return await Order.aggregate([
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
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
};

const fetchSalesByRaffle = async () => {
  return await Order.aggregate([
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
};

const fetchUserOrders = async (userId) => {
  return await Order.find({ userId })
    .populate("raffleId", "title drawDate ticketPrice")
    .sort({ createdAt: -1 });
};

const fetchDailySalesData = async (startDate, endDate) => {
  const matchStage = buildDateRangeMatchStage(startDate, endDate);
  
  return await Order.aggregate([
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
    { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } }
  ]);
};

const fetchPendingReceiptOrders = async () => {
  return await Order.find({ 
    receiptSent: false,
    status: "completed"
  })
  .populate("userId", "email name")
  .populate("raffleId", "title")
  .sort({ createdAt: 1 });
};

const fetchSalesStatistics = async () => {
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

  return stats[0] || createEmptyStatistics();
};

// Data formatting functions
const formatMonthlySalesData = (salesData) => {
  return salesData.map((sale) => ({
    year: sale._id.year,
    month: sale._id.month,
    totalSales: sale.totalSales,
    totalBaseAmount: sale.totalBaseAmount,
    totalTaxAmount: sale.totalTaxAmount,
    totalOrders: sale.totalOrders,
    totalTickets: sale.totalTickets,
    averageOrderValue: calculateAverageOrderValue(sale.totalSales, sale.totalOrders)
  }));
};

const formatUserOrders = (orders) => {
  return orders.map(order => order.getOrderSummary());
};

const formatDailySalesData = (dailySales) => {
  return dailySales.map(sale => ({
    date: formatDateString(sale._id.year, sale._id.month, sale._id.day),
    totalSales: sale.totalSales,
    totalOrders: sale.totalOrders,
    totalTickets: sale.totalTickets
  }));
};

// Utility functions
const buildDateMatchStageForYear = (year) => {
  if (!year) return {};
  
  return {
    createdAt: {
      $gte: new Date(`${year}-01-01`),
      $lt: new Date(`${parseInt(year) + 1}-01-01`)
    }
  };
};

const buildDateRangeMatchStage = (startDate, endDate) => {
  if (!startDate || !endDate) return {};
  
  return {
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  };
};

const calculateAverageOrderValue = (totalSales, totalOrders) => {
  return totalOrders > 0 ? (totalSales / totalOrders).toFixed(2) : 0;
};

const formatDateString = (year, month, day) => {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const createEmptyStatistics = () => ({
  totalRevenue: 0,
  totalBaseAmount: 0,
  totalTaxAmount: 0,
  totalOrders: 0,
  totalTicketsSold: 0,
  averageOrderValue: 0,
  averageTicketsPerOrder: 0
});

const handleServerError = (res, error, message) => {
  console.error(`${message}:`, error);
  res.status(500).json({ error: "Internal Server Error" });
};

module.exports = {
  getMonthlySales,
  getSalesByRaffle,
  getUserOrderHistory,
  getDailySales,
  getPendingReceipts,
  getSalesStatistics
};