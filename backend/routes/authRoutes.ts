import express from 'express';
import { registerUser, loginUser, getMe, updateProfile, getAudienceStats, getReferralInfo } from '../controllers/authController';
import { protect } from '../middleware/authMiddleware';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);
router.get('/audience', protect, getAudienceStats);
router.get('/referral-info/:code', getReferralInfo);

export default router;
