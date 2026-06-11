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
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password as string, salt);
  } catch (err: any) {
    throw err;
  }
});

UserSchema.methods.comparePassword = async function(password: string) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model<IUser>('User', UserSchema);
