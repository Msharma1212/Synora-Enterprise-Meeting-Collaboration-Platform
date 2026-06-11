import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  title: string;
  code: string; // Unique meeting code
  host: mongoose.Types.ObjectId;
  audienceId?: mongoose.Types.ObjectId;
  startTime: string;
  endTime?: string;
  isLive: boolean;
  isBroadcast: boolean;
  enableWaitingRoom: boolean;
  participants: mongoose.Types.ObjectId[];
  waitingUsers: mongoose.Types.ObjectId[];
}

const MeetingSchema: Schema = new Schema({
  title: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  audienceId: { type: Schema.Types.ObjectId, ref: 'User' },
  startTime: { type: String, default: () => new Date().toISOString() },
  endTime: { type: String },
  isLive: { type: Boolean, default: true },
  isBroadcast: { type: Boolean, default: false },
  enableWaitingRoom: { type: Boolean, default: false },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  waitingUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);
