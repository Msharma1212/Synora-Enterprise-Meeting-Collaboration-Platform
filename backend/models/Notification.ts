import mongoose, { Schema, Document } from 'mongoose';

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  category: 'Meetings' | 'Community' | 'Announcements' | 'Rewards' | 'System' | 'Messages';
  icon: string;
  title: string;
  description: string;
  link?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema: Schema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  category: { 
    type: String, 
    enum: ['Meetings', 'Community', 'Announcements', 'Rewards', 'System', 'Messages'], 
    required: true 
  },
  icon: { type: String, required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 } // MongoDB TTL index (expires after 7 days)
}, { timestamps: true });

export default mongoose.model<INotification>('Notification', NotificationSchema);
