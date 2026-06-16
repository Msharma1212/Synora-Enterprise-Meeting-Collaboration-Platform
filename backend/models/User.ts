import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcryptjs';

export interface IUser extends Document {
  name: string;
  email: string;
  password?: string;
  avatar?: string;
  role: 'admin' | 'developer' | 'co-admin' | 'audience' | 'user' | 'host';
  isBanned?: boolean;
  bannedAt?: Date;
  lastActiveAt?: Date;
  loginHistory?: {
    ip: string;
    device: string;
    timestamp: Date;
  }[];
  audience?: string[];
  audienceId?: string;
  parentHostId?: mongoose.Types.ObjectId;
  referralCode?: string;
  hostReferralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  invitedBy?: mongoose.Types.ObjectId;
  audienceCount?: number;
  notificationToken?: string;
  xp?: number;
  level?: number;
  badge?: string;
  inviteCount?: number;
  meetingsAttended?: number;
  lastLoginDate?: string;
  username?: string;
  settings: {
    language: string;
    notifications: {
      reminders: boolean;
      emailNotifs: boolean;
    };
    voiceEnabled: boolean;
  };
  comparePassword: (password: string) => Promise<boolean>;
}

const UserSchema: Schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  avatar: { type: String, default: '' },
  role: { type: String, enum: ['admin', 'developer', 'co-admin', 'audience', 'user', 'host'], default: 'user' },
  isBanned: { type: Boolean, default: false },
  bannedAt: { type: Date },
  lastActiveAt: { type: Date, default: Date.now },
  loginHistory: [{
    ip: { type: String, default: '127.0.0.1' },
    device: { type: String, default: 'Web Browser' },
    timestamp: { type: Date, default: Date.now }
  }],
  audience: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  audienceId: { type: Schema.Types.ObjectId, ref: 'User' },
  parentHostId: { type: Schema.Types.ObjectId, ref: 'User' },
  referralCode: { type: String, unique: true, sparse: true },
  hostReferralCode: { type: String },
  referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
  invitedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  audienceCount: { type: Number, default: 0 },
  notificationToken: { type: String, default: "" },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  badge: { type: String, default: '🥉 Bronze Member' },
  inviteCount: { type: Number, default: 0 },
  meetingsAttended: { type: Number, default: 0 },
  lastLoginDate: { type: String, default: "" },
  username: { type: String, unique: true, sparse: true },
  settings: {
    language: { type: String, default: 'English (US)' },
    notifications: {
      reminders: { type: Boolean, default: true },
      emailNotifs: { type: Boolean, default: false }
    },
    voiceEnabled: { type: Boolean, default: true }
  }
}, { timestamps: true });

UserSchema.pre('save', async function(this: any) {
  // Compute user level & badge automatically when XP updates
  const score = this.xp || 0;
  if (score >= 1000) {
    this.level = 5 + Math.floor((score - 1000) / 1000);
    this.badge = '👑 Community Legend';
  } else if (score >= 500) {
    this.level = 4;
    this.badge = '💎 Diamond Member';
  } else if (score >= 250) {
    this.level = 3;
    this.badge = '🥇 Gold Member';
  } else if (score >= 100) {
    this.level = 2;
    this.badge = '🥈 Silver Member';
  } else {
    this.level = 1;
    this.badge = '🥉 Bronze Member';
  }

  // Derive username if not set helper
  if (!this.username) {
    const base = (this.name || 'user').toLowerCase().replace(/[^a-z0-9]/g, '');
    const random = Math.floor(100 + Math.random() * 900);
    this.username = `${base}${random}`;
  }

  const hostRoles = ['admin', 'developer', 'co-admin', 'host'];
  if (hostRoles.includes(this.role)) {
    if (!this.referralCode) {
      const base = (this.name || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const random = Math.floor(1000 + Math.random() * 9000);
      this.referralCode = `${base}${random}`;
    }
  } else {
    this.referralCode = undefined;
  }

  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password as string, salt);
});

UserSchema.methods.comparePassword = async function(password: string) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
