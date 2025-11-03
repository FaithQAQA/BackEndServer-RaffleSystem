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

// ✅ **Fixed CORS Configuration**
const allowedOrigins = [
  'https://raffle-system-lac.vercel.app',
  'http://localhost:3000',
  'http://localhost:5000',
  'http://localhost:4200',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚫 Blocked by CORS:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
};

app.use(cors(corsOptions));

// ✅ Handle preflight requests properly
app.options('*', cors(corsOptions));

// Middleware
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', raffleRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api', userRoutes);
app.use('/api/email', emailRoutes);

// Health check
app.get('/', (req, res) => {
  res.status(200).json({ message: 'Backend server is running 🚀' });
});

// ✅ Improved error handler
app.use((err, req, res, next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ 
      message: 'CORS Error: Origin not allowed',
      allowedOrigins: allowedOrigins 
    });
  }
  
  console.error('💥 Server Error:', err.stack);
  res.status(500).json({ message: err.message || 'Internal Server Error' });
});

// Connect to MongoDB
connectDB();

module.exports = app;