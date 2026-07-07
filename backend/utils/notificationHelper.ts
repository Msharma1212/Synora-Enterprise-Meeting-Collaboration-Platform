import Notification from '../models/Notification';
import User from '../models/User';

interface NotificationParams {
  userId: string;
  category: 'Meetings' | 'Announcements' | 'Rewards' | 'System' | 'Messages';
  icon: string;
  title: string;
  description: string;
  link?: string;
}

export const sendNotification = async (app: any, params: NotificationParams) => {
  try {
    const { userId, category, icon, title, description, link } = params;
    
    // Save to Database
    const notification = await Notification.create({
      userId,
      category,
      icon,
      title,
      description,
      link
    });

    // Real-time Push via Socket.IO
    const io = app.get('io');
    const userSockets = app.get('userSockets');
    if (io && userSockets && userSockets[userId]) {
      const socketIds = userSockets[userId];
      socketIds.forEach((sid: string) => {
        io.to(sid).emit('new-notification', notification);
      });
    }

    return notification;
  } catch (err) {
    console.error('[sendNotification Error]:', err);
  }
};

export const broadcastNotification = async (app: any, params: Omit<NotificationParams, 'userId'>) => {
  try {
    const { category, icon, title, description, link } = params;

    // Get all active users
    const users = await User.find({ isBanned: { $ne: true } }).select('_id');
    if (!users || users.length === 0) return;

    // Create notifications for each user
    const notificationsToCreate = users.map(user => ({
      userId: user._id,
      category,
      icon,
      title,
      description,
      link
    }));

    await Notification.insertMany(notificationsToCreate);

    // Push to ALL connected sockets
    const io = app.get('io');
    if (io) {
      io.emit('new-notification-broadcast', {
        category,
        icon,
        title,
        description,
        link
      });
    }
  } catch (err) {
    console.error('[broadcastNotification Error]:', err);
  }
};
