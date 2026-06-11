import express from 'express';
import { 
  getAllUsers, 
  getAllMeetings, 
  deleteUser, 
  deleteMeeting,
  getGlobalSettings,
  updateGlobalSettings,
  getAnalyticsStats,
  updateUserRole,
  banUser,
  unbanUser,
  forceLogoutUser,
  getUserActivityDetail,
  updateTargetUserHost
} from '../controllers/adminController';
import User from '../models/User';
import jwt from 'jsonwebtoken';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const adminMiddleware = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token provided' });

    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user || (user.role !== 'admin' && user.role !== 'developer')) {
      return res.status(403).json({ message: 'Administrator access required' });
    }

    if (user.isBanned) {
      return res.status(403).json({ message: 'Your account has been banned.' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: 'Unauthorized' });
  }
};

const strictAdminOnly = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'developer') {
    next();
  } else {
    res.status(403).json({ message: 'Only developer accounts can perform this action.' });
  }
};

router.get('/users', adminMiddleware, getAllUsers);
router.get('/meetings', adminMiddleware, getAllMeetings);
router.delete('/users/:id', adminMiddleware, deleteUser);
router.delete('/meetings/:id', adminMiddleware, deleteMeeting);

router.put('/users/:id/role', adminMiddleware, updateUserRole);
router.put('/users/:id/host', adminMiddleware, strictAdminOnly, updateTargetUserHost);
router.post('/users/:id/ban', adminMiddleware, banUser);
router.post('/users/:id/unban', adminMiddleware, unbanUser);
router.post('/users/:id/logout', adminMiddleware, forceLogoutUser);
router.get('/users/:id/activity', adminMiddleware, getUserActivityDetail);

router.get('/global-settings', adminMiddleware, getGlobalSettings);
router.post('/global-settings', adminMiddleware, strictAdminOnly, updateGlobalSettings);
router.get('/analytics', adminMiddleware, getAnalyticsStats);

export default router;
