// app.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./Routes/authRoutes');
const raffleRoutes = require('./Routes/raffleRoutes');
const cartRoutes = require('./Routes/cartRoutes');
const ordersRoutes = require('./Routes/orders');
const emailRoutes = require('./Routes/emailRoutes');
const userRoutes = require('./Routes/users');

const app = express();

// ✅ Proper CORS setup
const allowedOrigins = [
  'https://raffle-system-lac.vercel.app', // your Vercel frontend
  'http://localhost:3000',                // local dev
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));

// Middleware
app.use(express.json());

// ✅ Optional: Handle preflight requests globally
app.options('*', cors());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', raffleRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api', userRoutes);
app.use('/api/email', emailRoutes);

// ✅ Health check route (useful for Render uptime)
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Backend server is running 🚀' });
});

// ✅ Global error handler (prevents unhandled 503s)
app.use((err, req, res, next) => {
  console.error('💥 Server Error:', err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Connect to MongoDB
connectDB();

module.exports = app;
