import { Response } from 'express';
import Broadcast from '../models/Broadcast';
import Meeting from '../models/Meeting';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';

const checkDbConnection = (res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ 
      message: 'Database connection is not established.' 
    });
    return false;
  }
  return true;
};

export const createBroadcast = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { title, message, meetingCode, scheduledAt, durationMinutes = 60 } = req.body;
  try {
    // Only administrators can create broadcasts
    if (req.user.role !== 'admin' && req.user.role !== 'developer' && req.user.role !== 'co-admin') {
      return res.status(403).json({ message: 'Only administrators are authorized to create broadcasts.' });
    }

    let expiresAt: Date;
    if (scheduledAt) {
      const startBase = new Date(scheduledAt);
      if (isNaN(startBase.getTime())) {
        return res.status(400).json({ message: 'Invalid scheduled date' });
      }
      expiresAt = new Date(startBase.getTime() + durationMinutes * 60000);
    } else {
      expiresAt = new Date(Date.now() + durationMinutes * 60000);
    }
    
    // Ensure a matching Meeting document always exists
    let finalCode = (meetingCode && meetingCode.trim()) || '';
    if (!finalCode) {
      finalCode = uuidv4().substring(0, 8);
    }

    let meeting = await Meeting.findOne({ code: finalCode });
    if (!meeting) {
      meeting = await Meeting.create({
        title: title || 'Live Broadcast',
        code: finalCode,
        host: req.user._id,
        isBroadcast: true,
        enableWaitingRoom: false,
        participants: [req.user._id],
        waitingUsers: [],
        isLive: true
      });
    } else {
      meeting.isBroadcast = true;
      meeting.isLive = true;
      await meeting.save();
    }

    const broadcast = await Broadcast.create({
      hostId: req.user._id,
      hostName: req.user.name || 'Host',
      audienceId: req.user._id,
      title,
      message,
      meetingCode: finalCode,
      scheduledAt: scheduledAt || undefined,
      expiresAt
    });
    console.log(`[Broadcast] Created broadcast "${title}" with meeting code: ${finalCode}`);
    res.status(201).json(broadcast);
  } catch (error: any) {
    console.error('[Broadcast] Error creating broadcast:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getBroadcasts = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    // Return all broadcasts that haven't expired to all logged in users
    const broadcasts = await Broadcast.find({
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });

    res.json(broadcasts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteBroadcast = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });
    
    const isAdmin = req.user.role === 'admin' || req.user.role === 'developer' || req.user.role === 'co-admin';
    if (broadcast.hostId.toString() !== req.user._id.toString() && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this broadcast' });
    }

    if (broadcast.meetingCode) {
      await Meeting.deleteMany({ code: broadcast.meetingCode, isBroadcast: true });
    }

    await broadcast.deleteOne();
    res.json({ message: 'Broadcast removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
