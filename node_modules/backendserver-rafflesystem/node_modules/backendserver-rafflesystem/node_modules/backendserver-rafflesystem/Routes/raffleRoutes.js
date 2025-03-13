// routes/raffleRoutes.js
const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createRaffle,
  getAllRaffles,
  getRecentRaffles,
  getRaffleById,
  updateRaffle,
  deleteRaffle,
} = require('../controllers/raffleController');

const router = express.Router();

// Protected routes (require authentication)
router.post('/raffles', authMiddleware, createRaffle);
router.get('/raffles', authMiddleware, getAllRaffles);
router.get('/raffles/recent', authMiddleware, getRecentRaffles);
router.get('/raffles/:id', authMiddleware, getRaffleById);
router.put('/raffles/:id', authMiddleware, updateRaffle);
router.delete('/raffles/:id', authMiddleware, deleteRaffle);

module.exports = router;