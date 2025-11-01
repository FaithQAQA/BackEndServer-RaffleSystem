const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const {
  createRaffle,
  getAllRaffles,
  getRecentRaffles,
  getRaffleById,
  updateRaffle,
  deleteRaffle,
  getRaffleWinningChance,
  purchaseTickets,
  getUserRaffles,
  exportRaffleCSV,
  pickWinner
} = require('../controllers/raffleController');
 
const router = express.Router();
 
// Protected routes (require authentication)
router.post('/raffles', authMiddleware, createRaffle);
router.get('/raffles', authMiddleware, getAllRaffles);
router.get('/raffles/recent', authMiddleware, getRecentRaffles);
router.get('/raffles/:id', authMiddleware, getRaffleById);
router.put('/raffles/:id', authMiddleware, updateRaffle);
router.delete('/raffles/:id', authMiddleware, deleteRaffle);
router.get('/raffles/:raffleId/winning-chance/:userId', authMiddleware, getRaffleWinningChance);
router.post('/raffles/:raffleId/purchase',authMiddleware, purchaseTickets);
router.get("/user/:userId/raffles", getUserRaffles);
router.get('/raffles/:id/export', authMiddleware, exportRaffleCSV);
// In your raffle routes
router.post('/raffles/:raffleId/pick-winner', authMiddleware, pickWinner); 
module.exports = router;