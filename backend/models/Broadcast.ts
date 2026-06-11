import mongoose from 'mongoose';

const broadcastSchema = new mongoose.Schema({
  hostName: { type: String, required: true },
  hostId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  audienceId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  meetingCode: { type: String },
  scheduledAt: { type: String },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

// Auto-delete after expiry
broadcastSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model('Broadcast', broadcastSchema);
