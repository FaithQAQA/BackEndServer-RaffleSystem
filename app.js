// app.js
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const authRoutes = require('./Routes/authRoutes');
const raffleRoutes = require('./Routes/raffleRoutes');
const CartRoutes= require ('./Routes/cartRoutes')
const Orders = require('./Routes/orders');
const emailRoutes = require('./Routes/emailRoutes'); // Add this
const app = express();
const userRoutes = require('./Routes/users');
// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', raffleRoutes);
app.use('/api/cart', CartRoutes);
app.use('/api/orders', Orders); 
app.use('/api', userRoutes);
app.use('/api/email', emailRoutes); // Add this line
// Connect to MongoDB
connectDB();

module.exports = app;