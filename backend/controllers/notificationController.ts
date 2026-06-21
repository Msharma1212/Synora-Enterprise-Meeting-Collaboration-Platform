import { Response } from 'express';
import Notification from '../models/Notification';
import { AuthRequest } from '../middleware/authMiddleware';

// Get user notifications (filtered to the past 7 days to never show expired ones)
export const getUserNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const notifications = await Notification.find({
      userId,
      createdAt: { $gte: sevenDaysAgo }
    }).sort({ createdAt: -1 });

    return res.json({
      success: true,
      notifications
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark single notification as read
export const markNotificationAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: notificationId, userId },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({ success: true, notification });
  } catch (error: any) {
    console.error('Error marking notification read:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Mark all as read
export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;

    await Notification.updateMany(
      { userId, isRead: false },
      { isRead: true }
    );

    return res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error: any) {
    console.error('Error marking all notifications read:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete single notification
export const deleteNotification = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;
    const notificationId = req.params.id;

    const result = await Notification.deleteOne({ _id: notificationId, userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    return res.json({ success: true, message: 'Notification deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Delete all notifications for the user
export const clearAllNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user._id;

    await Notification.deleteMany({ userId });

    return res.json({ success: true, message: 'All notifications cleared successfully' });
  } catch (error: any) {
    console.error('Error clearing notifications:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};
