import express from 'express';
import { 
  registerUser, 
  loginUser, 
  getMe, 
  updateProfile, 
  getAudienceStats, 
  getReferralInfo,
  addXP
} from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.get('/profile', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/audience', protect, getAudienceStats);
router.get('/referral-info/:code', getReferralInfo);

// XP system endpoint
router.post('/xp/add', protect, addXP);

export default router;

