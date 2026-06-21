import { Response } from 'express';
import Meeting from '../models/Meeting';
import Message from '../models/Message';
import Broadcast from '../models/Broadcast';
import AnalyticsLog from '../models/AnalyticsLog';
import User from '../models/User';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { getMeetingSummary, getChatCompletion } from '../lib/gemini';
import { sendNotification } from '../utils/notificationHelper';

const checkDbConnection = (res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ 
      message: 'Database connection is not established. Please check your MongoDB Atlas IP Whitelist settings (0.0.0.0/0 recommended) and verify your connection string in the app settings.' 
    });
    return false;
  }
  return true;
};

export const createMeeting = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { title, isBroadcast, enableWaitingRoom } = req.body;
  try {
    const code = uuidv4().substring(0, 8);
    const meeting = await Meeting.create({
      title: title || 'New Meeting',
      code,
      host: req.user._id,
      audienceId: req.user._id,
      isBroadcast: !!isBroadcast,
      enableWaitingRoom: !!enableWaitingRoom,
      participants: [req.user._id],
      waitingUsers: [],
    });

    // Log meeting creation
    AnalyticsLog.create({
      event: 'meeting_created',
      userId: req.user._id,
      meetingId: meeting._id,
      meetingCode: code
    }).catch(err => console.error("Analytics log error:", err));

    if (isBroadcast) {
      await Broadcast.create({
        hostId: req.user._id,
        hostName: req.user.name || 'Host',
        title: title || 'Live Broadcast',
        message: 'Join my live broadcast meeting!',
        meetingCode: code,
        expiresAt: new Date(Date.now() + 2 * 60 * 60000) // 2 hours
      });
    }

    // Trigger meeting-started live notifications for host's audience
    try {
      const io = req.app.get('io');
      const userSockets = req.app.get('userSockets') || {};
      const hostDoc = await User.findById(req.user._id);
      
      if (hostDoc && hostDoc.audience && hostDoc.audience.length > 0) {
        hostDoc.audience.forEach((memberId: any) => {
          // Persist and push beautiful notification
          sendNotification(req.app, {
            userId: memberId.toString(),
            category: 'Meetings',
            icon: '🔴',
            title: `${req.user.name} started a live meeting`,
            description: `Join now: ${meeting.title}`,
            link: `/meeting/${meeting.code}`
          });

          const memberSockets = userSockets[memberId.toString()];
          if (memberSockets && memberSockets.length > 0) {
            memberSockets.forEach((sid: string) => {
              if (io) {
                io.to(sid).emit("meeting-started", {
                  hostName: req.user.name,
                  hostId: req.user._id.toString(),
                  meetingTitle: meeting.title,
                  meetingCode: meeting.code,
                  isBroadcast: meeting.isBroadcast
                });
              }
            });
          }
        });
      }
    } catch (socketErr) {
      console.error("Failed to dispatch meeting-started socket alert:", socketErr);
    }

    res.status(201).json(meeting);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const scheduleMeeting = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { title, startTime, isBroadcast, enableWaitingRoom } = req.body;
  try {
    const code = uuidv4().substring(0, 8);
    const meeting = await Meeting.create({
      title: title || 'Scheduled Meeting',
      code,
      host: req.user._id,
      audienceId: req.user._id,
      startTime: startTime || new Date().toISOString(),
      isLive: false, // Scheduled meetings are not live yet
      isBroadcast: !!isBroadcast,
      enableWaitingRoom: !!enableWaitingRoom,
      participants: [req.user._id],
      waitingUsers: [],
    });

    // Log meeting creation
    AnalyticsLog.create({
      event: 'meeting_created',
      userId: req.user._id,
      meetingId: meeting._id,
      meetingCode: code
    }).catch(err => console.error("Analytics log error:", err));

    if (isBroadcast) {
      const scheduledTime = new Date(startTime || Date.now());
      await Broadcast.create({
        hostId: req.user._id,
        hostName: req.user.name || 'Host',
        title: title || 'Scheduled Broadcast',
        message: 'Upcoming broadcast meeting!',
        meetingCode: code,
        scheduledAt: startTime,
        expiresAt: new Date(scheduledTime.getTime() + 4 * 60 * 60000) // 4 hours after start
      });
    }

    // Persist scheduled notifications
    try {
      // 1. Notify host
      sendNotification(req.app, {
        userId: req.user._id.toString(),
        category: 'Meetings',
        icon: '📢',
        title: 'Your meeting has been scheduled successfully',
        description: `Your meeting "${meeting.title || 'Scheduled Meeting'}" is now scheduled.`,
        link: '/history'
      });

      // 2. Notify audience of host
      const hostDoc = await User.findById(req.user._id);
      if (hostDoc && hostDoc.audience && hostDoc.audience.length > 0) {
        hostDoc.audience.forEach((memberId: any) => {
          sendNotification(req.app, {
            userId: memberId.toString(),
            category: 'Meetings',
            icon: '📢',
            title: `New meeting scheduled by ${req.user.name}`,
            description: `Meeting "${meeting.title || 'Scheduled Meeting'}" scheduled at ${new Date(startTime || Date.now()).toLocaleString()}`,
            link: '/history'
          });
        });
      }
    } catch (schedErr) {
      console.error("Scheduled meeting notification error:", schedErr);
    }

    res.status(201).json(meeting);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const joinMeeting = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { code } = req.body;
  console.log(`[JoinMeeting POST] Attempting to find meeting to join with identifier: ${code}`);
  try {
    // 1. Try finding by code
    let meeting = await Meeting.findOne({ code });

    // 2. If not found, check if it is a valid ObjectId and try by ID
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      meeting = await Meeting.findById(code);
    }

    // 3. Fallback: Check if it's a Broadcast ID that points to a code
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      const broadcast = await Broadcast.findById(code);
      if (broadcast && broadcast.meetingCode) {
        meeting = await Meeting.findOne({ code: broadcast.meetingCode });
        if (!meeting) {
          console.log(`[JoinMeeting POST] Self-healing: Re-creating missing meeting on-the-fly for Broadcast ID: ${code}`);
          meeting = await Meeting.create({
            title: broadcast.title || 'Live Broadcast',
            code: broadcast.meetingCode,
            host: broadcast.hostId,
            isBroadcast: true,
            enableWaitingRoom: false,
            participants: [broadcast.hostId],
            waitingUsers: [],
            isLive: true
          });
        }
      }
    }

    // 4. Fallback 2: Check if any Broadcast exists with this meetingCode (code can be literal string)
    if (!meeting && code) {
      const broadcast = await Broadcast.findOne({ meetingCode: code as string });
      if (broadcast) {
        console.log(`[JoinMeeting POST] Self-healing: Re-creating missing meeting on-the-fly for meetingCode: "${code}"`);
        meeting = await Meeting.create({
          title: broadcast.title || 'Live Broadcast',
          code: code as string,
          host: broadcast.hostId,
          isBroadcast: true,
          enableWaitingRoom: false,
          participants: [broadcast.hostId],
          waitingUsers: [],
          isLive: true
        });
      }
    }

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    if (!meeting.isLive) {
      meeting.isLive = true;
      await meeting.save();
    }

    // Simplified system: retrieve host profile for standard info
    const hostUser = await User.findById(meeting.host);
    let creatorName = hostUser ? hostUser.name : '';

    const isAdmin = req.user.role === 'admin' || req.user.role === 'developer' || req.user.role === 'co-admin';
    const isHost = meeting.host.toString() === req.user._id.toString();
    const isParticipant = meeting.participants.some(p => p.toString() === req.user._id.toString());
    const isWaiting = meeting.waitingUsers.some(u => u.toString() === req.user._id.toString());

    // Admin or Host always skip waiting room
    if (isAdmin || isHost) {
      if (!isParticipant && !isHost) {
        meeting.participants.push(req.user._id);
        await meeting.save();
      }
      return res.json({ ...meeting.toObject(), inWaitingRoom: false, creatorName });
    }

    // Already a participant?
    if (isParticipant) {
      return res.json({ ...meeting.toObject(), inWaitingRoom: false, creatorName });
    }

    // New person joining a meeting with waiting room enabled
    if (meeting.enableWaitingRoom) {
      if (!isWaiting) {
        meeting.waitingUsers.push(req.user._id);
        await meeting.save();
      }
      return res.json({ ...meeting.toObject(), inWaitingRoom: true, creatorName });
    } else {
      // Normal join
      meeting.participants.push(req.user._id);
      await meeting.save();
      return res.json({ ...meeting.toObject(), inWaitingRoom: false, creatorName });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMeetingHistory = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    const meetings = await Meeting.find({ participants: req.user._id || req.user.id }).sort({ createdAt: -1 });
    res.json(meetings);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMeetingMessages = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { code } = req.params;
  try {
    // 1. Try finding by code
    let meeting = await Meeting.findOne({ code });

    // 2. If not found, check if it is a valid ObjectId and try by ID
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      meeting = await Meeting.findById(code);
    }

    // 3. Fallback: Check if it's a Broadcast ID that points to a code
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      const broadcast = await Broadcast.findById(code);
      if (broadcast && broadcast.meetingCode) {
        meeting = await Meeting.findOne({ code: broadcast.meetingCode });
      }
    }

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const messages = await Message.find({ meetingId: meeting._id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });
    
    res.json(messages);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMeeting = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });
    
    // Authorization check - only host (creator) or admin/developer/co-admin can delete
    const isMeetingHost = meeting.host.toString() === req.user._id.toString() || 
                          (meeting.audienceId && meeting.audienceId.toString() === req.user._id.toString());
    const isAdmin = req.user.role === 'admin' || req.user.role === 'developer' || req.user.role === 'co-admin';

    if (!isMeetingHost && !isAdmin) {
      return res.status(403).json({ message: 'Not authorized to delete this meeting' });
    }

    // Delete associated broadcast alerts for this meeting
    if (meeting.code) {
      await Broadcast.deleteMany({ meetingCode: meeting.code });
    }

    // Delete associated messages recorded under this meeting
    await Message.deleteMany({ meetingId: meeting._id });

    // Notify participants and audience
    try {
      const title = meeting.title || 'Scheduled Meeting';
      const participantsToNotify = meeting.participants || [];
      const uniques = Array.from(new Set([
        ...participantsToNotify.map((p: any) => p.toString()),
        meeting.host.toString()
      ])).filter(id => id !== req.user._id.toString()); // Don't notify the person who deleted it

      uniques.forEach((memberId: string) => {
        sendNotification(req.app, {
          userId: memberId,
          category: 'Meetings',
          icon: '🚫',
          title: 'Meeting Cancelled',
          description: `The meeting "${title}" has been cancelled.`,
          link: '/history'
        });
      });
    } catch (notifyErr) {
      console.error("Meeting cancellation notification error:", notifyErr);
    }

    await meeting.deleteOne();
    res.json({ message: 'Meeting removed' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getMeetingAISummary = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { code } = req.params;
  try {
    // 1. Try finding by code
    let meeting = await Meeting.findOne({ code });

    // 2. If not found, check if it is a valid ObjectId and try by ID
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      meeting = await Meeting.findById(code);
    }

    // 3. Fallback: Check if it's a Broadcast ID that points to a code
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      const broadcast = await Broadcast.findById(code);
      if (broadcast && broadcast.meetingCode) {
        meeting = await Meeting.findOne({ code: broadcast.meetingCode });
      }
    }

    if (!meeting) return res.status(404).json({ message: 'Meeting not found' });

    const messages = await Message.find({ meetingId: meeting._id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 });

    if (messages.length === 0) {
      return res.status(400).json({ message: 'No chat messages found to summarize.' });
    }

    const transcript = messages.map(m => `${(m.sender as any)?.name || 'Unknown'}: ${m.text}`);
    const summary = await getMeetingSummary(transcript, req.user.settings?.language || 'English (US)');
    
    res.json({ summary });
  } catch (error: any) {
    console.error("AI Summary Error:", error);
    res.status(500).json({ message: error.message || 'Failed to generate AI summary' });
  }
};

export const updateMessage = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { id } = req.params;
  const { text } = req.body;
  try {
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only edit your own messages' });
    }
    message.text = text;
    await message.save();
    res.json(message);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteMessage = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { id } = req.params;
  try {
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'You can only delete your own messages' });
    }
    await message.deleteOne();
    res.json({ message: 'Message deleted' });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const reactToMessage = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { id } = req.params;
  const { emoji } = req.body;
  try {
    const message = await Message.findById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    
    const reactionIndex = message.reactions.findIndex(r => r.user.toString() === req.user.id);
    if (reactionIndex > -1) {
      if (message.reactions[reactionIndex].emoji === emoji) {
        message.reactions.splice(reactionIndex, 1);
      } else {
        message.reactions[reactionIndex].emoji = emoji;
      }
    } else {
      message.reactions.push({ user: req.user.id, emoji });
    }
    
    await message.save();
    const updatedMessage = await Message.findById(id).populate('sender', 'name');
    res.json(updatedMessage);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const askAI = async (req: any, res: Response) => {
  const { prompt, history } = req.body;
  try {
    const response = await getChatCompletion(prompt, history || []);
    res.json({ response });
  } catch (error: any) {
    console.error("Ask AI Controller Error:", error);
    res.status(500).json({ message: error.message || 'AI Assistant failed' });
  }
};

export const getMeetingByCode = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { code } = req.query;
  console.log(`[JoinMeeting GET] Attempting to find meeting with identifier: "${code}" (type: ${typeof code})`);

  try {
    // 1. Try finding by the 'code' field in Meeting
    let meeting = await Meeting.findOne({ code }).populate('host', 'name email');
    console.log(`[JoinMeeting GET] Lookup by code "${code}" found:`, meeting ? `${meeting.title} (${meeting.code})` : 'null');

    // 2. If not found, check if 'code' is a valid ObjectId and try Meeting.findById
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      console.log(`[JoinMeeting GET] Not found by code, trying as Meeting ID: ${code}`);
      meeting = await Meeting.findById(code).populate('host', 'name email');
      console.log(`[JoinMeeting GET] Lookup by ID "${code}" found:`, meeting ? `${meeting.title} (${meeting.code})` : 'null');
    }

    // 3. If still not found, check if it's a Broadcast ID that points to a code
    if (!meeting && mongoose.Types.ObjectId.isValid(code as string)) {
      console.log(`[JoinMeeting GET] Not found in Meetings, checking Broadcast alerts: ${code}`);
      const broadcast = await Broadcast.findById(code);
      if (broadcast && broadcast.meetingCode) {
        console.log(`[JoinMeeting GET] Found Broadcast alert, searching for meeting with code: ${broadcast.meetingCode}`);
        meeting = await Meeting.findOne({ code: broadcast.meetingCode }).populate('host', 'name email');
        console.log(`[JoinMeeting GET] Lookup by broadcast's meeting code "${broadcast.meetingCode}" found:`, meeting ? `${meeting.title} (${meeting.code})` : 'null');

        // Self-heal: If broadcast exists but Meeting doc is missing
        if (!meeting) {
          console.log(`[JoinMeeting GET] Self-healing: Re-creating missing meeting for Broadcast ID: ${code}`);
          meeting = await Meeting.create({
            title: broadcast.title || 'Live Broadcast',
            code: broadcast.meetingCode,
            host: broadcast.hostId,
            isBroadcast: true,
            enableWaitingRoom: false,
            participants: [broadcast.hostId],
            waitingUsers: [],
            isLive: true
          });
          meeting = await Meeting.findById(meeting._id).populate('host', 'name email');
        }
      }
    }

    // 4. Default Self-heal: If meeting still not found, check if any Broadcast exists with this meetingCode
    if (!meeting && code) {
      console.log(`[JoinMeeting GET] Meeting not found by direct lookup. Checking for Broadcast alerts with meetingCode: "${code}"`);
      const broadcast = await Broadcast.findOne({ meetingCode: code as string });
      if (broadcast) {
        console.log(`[JoinMeeting GET] Self-healing: Found matching Broadcast with code "${code}". Creating meeting...`);
        meeting = await Meeting.create({
          title: broadcast.title || 'Live Broadcast',
          code: code as string,
          host: broadcast.hostId,
          isBroadcast: true,
          enableWaitingRoom: false,
          participants: [broadcast.hostId],
          waitingUsers: [],
          isLive: true
        });
        meeting = await Meeting.findById(meeting._id).populate('host', 'name email');
      }
    }

    if (!meeting) {
      console.log(`[JoinMeeting GET] Meeting NOT FOUND for identifier: "${code}"`);
      try {
        const lastMeetings = await Meeting.find({}).sort({ createdAt: -1 }).limit(5);
        console.log('[JoinMeeting GET Debug] Last 5 meetings in database:', lastMeetings.map(m => ({ title: m.title, code: m.code, id: m._id, isLive: m.isLive })));
        
        const lastBroadcasts = await Broadcast.find({}).sort({ createdAt: -1 }).limit(5);
        console.log('[JoinMeeting GET Debug] Last 5 broadcasts in database:', lastBroadcasts.map(b => ({ title: b.title, meetingCode: b.meetingCode, id: b._id })));
      } catch (dbErr) {
        console.error('[JoinMeeting GET Debug] Failed to fetch debugging list:', dbErr);
      }
      return res.status(404).json({ message: 'Meeting room not found or the session has expired.' });
    }

    console.log(`[JoinMeeting GET] Found meeting: ${meeting.title} (${meeting.code})`);
    res.json(meeting);
  } catch (error: any) {
    console.error(`[JoinMeeting GET] Error during lookup:`, error);
    res.status(500).json({ message: error.message });
  }
};

export const getHostMeetings = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    const user = await User.findById(req.user._id || req.user.id);
    if (!user || !user.referredBy) {
      return res.json({ hostName: null, meetings: [] });
    }
    const hostUser = await User.findById(user.referredBy);
    const meetings = await Meeting.find({ host: user.referredBy }).sort({ createdAt: -1 }).populate('host', 'name email');
    res.json({
      hostName: hostUser ? hostUser.name : 'Your Host',
      hostReferralCode: hostUser ? hostUser.referralCode : undefined,
      hostUsername: hostUser ? hostUser.username : undefined,
      meetings: meetings
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getLiveBroadcasts = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    const user = req.user;
    let query: any = { isBroadcast: true, isLive: true };
    
    if (user.role === 'developer' || user.role === 'admin' || user.role === 'co-admin') {
      // Developers and admins have full access to view all broadcasts
    } else if (user.role === 'host') {
      // Hosts see ONLY their own broadcasts
      query.$or = [
        { audienceId: user._id },
        { host: user._id }
      ];
    } else {
      // Regular user sees broadcasts only if created by their referredBy host
      if (user.referredBy) {
        query.$or = [
          { audienceId: user.referredBy },
          { host: user.referredBy }
        ];
      } else {
        return res.json([]);
      }
    }
    
    const broadcasts = await Meeting.find(query)
      .sort({ createdAt: -1 })
      .populate('host', 'name email');
      
    res.json(broadcasts);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const sendMeetingReminder = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { meetingCode, timeTier, customMinutes, announcementText } = req.body;
  try {
    const hostId = req.user._id;
    const hostName = req.user.name || 'Your Host';
    const io = req.app.get('io');
    const userSockets = req.app.get('userSockets') || {};

    const hostDoc = await User.findById(hostId);
    if (!hostDoc) return res.status(404).json({ message: 'Host not found' });

    let messageText = '';
    if (announcementText) {
      messageText = announcementText;
    } else {
      let timeStr = '';
      if (timeTier === 'Live Now') {
        timeStr = 'now';
      } else if (timeTier === '10 Minutes') {
        timeStr = 'in 10 minutes';
      } else if (timeTier === '30 Minutes') {
        timeStr = 'in 30 minutes';
      } else if (timeTier === '1 Hour') {
        timeStr = 'in 1 hour';
      } else if (timeTier === 'Custom Time') {
        timeStr = `in ${customMinutes || 15} minutes`;
      } else {
        timeStr = 'soon';
      }
      messageText = `${hostName} will go live ${timeStr}!`;
    }

    const payload = {
      hostId: hostId.toString(),
      hostName,
      meetingCode,
      message: messageText,
      timeTier,
      timestamp: new Date()
    };

    // Find audience members of this host
    if (hostDoc.audience && hostDoc.audience.length > 0) {
      hostDoc.audience.forEach((memberId: any) => {
        const memberSockets = userSockets[memberId.toString()];
        if (memberSockets && memberSockets.length > 0) {
          memberSockets.forEach((sid: string) => {
            if (io) {
              io.to(sid).emit("audience-reminder", payload);
            }
          });
        }
      });
    }

    res.json({ message: 'Announcement and reminders sent successfully!', messageText });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};


