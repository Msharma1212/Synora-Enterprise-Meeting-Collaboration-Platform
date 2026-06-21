import express from 'express';
import { protect } from '../middleware/authMiddleware';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllAsRead,
  deleteNotification,
  clearAllNotifications
} from '../controllers/notificationController';

const router = express.Router();

router.get('/', protect, getUserNotifications);
router.post('/read-all', protect, markAllAsRead);
router.patch('/:id/read', protect, markNotificationAsRead);
router.delete('/:id', protect, deleteNotification);
router.delete('/', protect, clearAllNotifications);

export default router;
