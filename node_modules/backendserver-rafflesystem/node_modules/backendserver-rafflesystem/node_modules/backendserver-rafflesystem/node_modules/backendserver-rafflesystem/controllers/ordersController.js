const Order = require("../Models/Order");

const getMonthlySales = async (req, res) => {
  try {
    const sales = await Order.aggregate([
      {
        $group: {
          _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
          totalSales: { $sum: "$amount" },
          totalOrders: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ]);

    // format output
    const formatted = sales.map((s) => ({
      year: s._id.year,
      month: s._id.month,
      totalSales: s.totalSales,
      totalOrders: s.totalOrders
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching monthly sales:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

module.exports = { getMonthlySales };
