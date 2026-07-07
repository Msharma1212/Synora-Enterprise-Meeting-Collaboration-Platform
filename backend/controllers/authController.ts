import { Request, Response } from 'express';
import User from '../models/User';
import AnalyticsLog from '../models/AnalyticsLog';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { sendNotification } from '../utils/notificationHelper';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

const checkDbConnection = (res: Response) => {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ 
      message: 'Database connection is not established. Please check your MongoDB Atlas IP Whitelist settings (0.0.0.0/0 recommended) and verify your connection string in the app settings.' 
    });
    return false;
  }
  return true;
};

const generateToken = (id: string, name: string, role: string) => {
  return jwt.sign({ id, name, role }, JWT_SECRET, { expiresIn: '30d' });
};

const getDevice = (ua?: string) => {
  if (!ua) return 'Web Browser';
  const lowercase = ua.toLowerCase();
  if (lowercase.includes('mobi') || lowercase.includes('android') || lowercase.includes('iphone')) return 'Mobile';
  if (lowercase.includes('ipad') || lowercase.includes('tablet')) return 'Tablet';
  return 'Desktop';
};

export const registerUser = async (req: Request, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { name, email, password, referralCode, helperCode } = req.body;
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    let referredById: any = undefined;
    if (referralCode && typeof referralCode === 'string' && referralCode.trim() !== '') {
      const codeUpper = referralCode.trim().toUpperCase();
      const referrer = await User.findOne({ referralCode: codeUpper });
      if (!referrer) {
        return res.status(400).json({ message: 'The referral code you entered is invalid.' });
      }
      if (referrer.email.toLowerCase() === email.toLowerCase()) {
        return res.status(400).json({ message: 'You cannot refer yourself.' });
      }
      referredById = referrer._id;
    }

    let invitedById: any = undefined;
    if (helperCode && typeof helperCode === 'string' && helperCode.trim() !== '') {
      const helperUpper = helperCode.trim().toUpperCase();
      const helperUser = await User.findOne({ referralCode: helperUpper });
      if (helperUser) {
        invitedById = helperUser._id;
      }
    }

    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const deviceType = getDevice(req.headers['user-agent']);

    const userRole = (email === 'kmayank122004@gmail.com') 
      ? 'developer' 
      : (referredById ? 'audience' : 'user');

    const hostRefCode = (referralCode && typeof referralCode === 'string') 
      ? referralCode.trim().toUpperCase() 
      : undefined;

    const user = await User.create({ 
      name, 
      email, 
      password,
      role: userRole, // Force appropriate role
      referredBy: referredById,
      invitedBy: invitedById,
      parentHostId: referredById,
      hostReferralCode: hostRefCode,
      lastActiveAt: new Date(),
      lastLoginDate: new Date().toISOString().split('T')[0],
      xp: 0,
      loginHistory: [{
        ip: clientIp,
        device: deviceType,
        timestamp: new Date()
      }]
    });

    if (referredById) {
      // Find Host and add this user to their audience list and increment audienceCount
      await User.findByIdAndUpdate(referredById, {
        $addToSet: { audience: user._id },
        $inc: { audienceCount: 1 }
      });

      // Send join notification
      try {
        sendNotification(req.app, {
          userId: referredById.toString(),
          category: 'Rewards',
          icon: '👥',
          title: 'Referral Joined!',
          description: `${user.name} joined using your referral code!`,
          link: '/dashboard'
        });
      } catch (refErr) {
        console.error("Referral join notification error:", refErr);
      }
    }

    if (invitedById) {
      // Award invite XP to the inviter
      await User.findByIdAndUpdate(invitedById, {
        $inc: { xp: 50, inviteCount: 1 }
      });
      // Save to trigger level/badge recalculation on pre-save
      try {
        const inviter = await User.findById(invitedById);
        if (inviter) {
          await inviter.save();
          // Dispatch beautiful reward notification
          sendNotification(req.app, {
            userId: inviter._id.toString(),
            category: 'Rewards',
            icon: '🎉',
            title: 'You earned 50 XP!',
            description: `${user.name} joined the platform using your invite code!`,
            link: '/dashboard'
          });
        }
      } catch (err) {
        console.error("Failed to rerun inviter save pre-save hook & notifications:", err);
      }
    }

    // Log user login/registration event
    AnalyticsLog.create({ event: 'user_login', userId: user._id }).catch(err => console.error("Analytics log error:", err));
    
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      settings: user.settings,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      token: generateToken(user._id.toString(), user.name, user.role),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const loginUser = async (req: Request, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { email, password } = req.body;

  // 1. Validate email and password inputs
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ success: false, message: 'Email address is required' });
  }
  if (!password || typeof password !== 'string' || !password.trim()) {
    return res.status(400).json({ success: false, message: 'Password is required' });
  }

  try {
    // 2. Validate user existence
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    // Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }

    if (user.isBanned) {
      return res.status(403).json({ success: false, message: 'Your account has been banned by an administrator.' });
    }

    const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
    const deviceType = getDevice(req.headers['user-agent']);

    user.lastActiveAt = new Date();
    if (!user.loginHistory) {
      user.loginHistory = [];
    }
    user.loginHistory.unshift({
      ip: clientIp,
      device: deviceType,
      timestamp: new Date()
    });

    // Limit login history to the 5 most recent entries for ultra-clean auto optimization
    if (user.loginHistory.length > 5) {
      user.loginHistory = user.loginHistory.slice(0, 5);
    }

    // Force developer role for the super admin
    if (email.trim().toLowerCase() === 'kmayank122004@gmail.com' && user.role !== 'developer') {
      user.role = 'developer';
    }

    // Handle Daily Login XP
    const todayStr = new Date().toISOString().split('T')[0];
    if (user.lastLoginDate !== todayStr) {
      user.lastLoginDate = todayStr;
      user.xp = (user.xp || 0) + 5;
    }

    // Ensure every logged in user has a referralCode
    if (!user.referralCode) {
      const base = (user.name || 'USER').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
      const random = Math.floor(1000 + Math.random() * 9000);
      user.referralCode = `${base}${random}`;
    }

    await user.save();

    // Log user login event
    AnalyticsLog.create({ event: 'user_login', userId: user._id }).catch(err => console.error("Analytics log error:", err));

    // 3. Validate JWT generation
    let token;
    try {
      token = generateToken(user._id.toString(), user.name, user.role);
      if (!token) {
        throw new Error('JWT generation returned empty token');
      }
    } catch (jwtError: any) {
      console.error("JWT GENERATION ERROR", jwtError);
      return res.status(500).json({
        success: false,
        message: 'Auth system failed to authorize the session. Please contact support.'
      });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      settings: user.settings,
      referralCode: user.referralCode,
      referredBy: user.referredBy,
      token,
    });
  } catch (error: any) {
    console.error("LOGIN ERROR", error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error occurred during login'
    });
  }
};

export const getMe = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id || req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Handle Daily Login XP
    const todayStr = new Date().toISOString().split('T')[0];
    if (user.lastLoginDate !== todayStr) {
      user.lastLoginDate = todayStr;
      user.xp = (user.xp || 0) + 5;
      await user.save();
    }

    res.json(user);
  } catch (error: any) {
    console.error("GET PROFILE ERROR", error);
    res.status(500).json({ message: error.message || 'Server error fetching profile' });
  }
};

export const updateProfile = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const user = await User.findById(req.user.id || req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (req.body.name) user.name = req.body.name;
    if (req.body.email) user.email = req.body.email;
    if (req.body.password) user.password = req.body.password;
    
    if (req.body.referralCode) {
      const codeUpper = req.body.referralCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,20}$/.test(codeUpper)) {
        return res.status(400).json({ message: 'Referral code must be alphanumeric and 3-20 characters long.' });
      }
      const existing = await User.findOne({ referralCode: codeUpper });
      if (existing && existing._id.toString() !== user._id.toString()) {
        return res.status(400).json({ message: 'This referral code is already in use by another user.' });
      }
      user.referralCode = codeUpper;
    }

    if (req.body.enterReferralCode) {
      const codeUpper = req.body.enterReferralCode.trim().toUpperCase();
      if (codeUpper === user.referralCode) {
        return res.status(400).json({ message: 'You cannot refer yourself.' });
      }
      const referrer = await User.findOne({ referralCode: codeUpper });
      if (!referrer) {
        return res.status(400).json({ message: 'Invalid referral code. Referrer not found.' });
      }
      if (referrer._id.toString() === user._id.toString()) {
        return res.status(400).json({ message: 'You cannot refer yourself.' });
      }
      user.referredBy = referrer._id as mongoose.Types.ObjectId;
    }

    if (req.body.settings) {
      user.settings = {
        ...user.settings,
        ...req.body.settings,
        notifications: {
          ...user.settings.notifications,
          ...(req.body.settings.notifications || {})
        }
      };
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      settings: updatedUser.settings,
      referralCode: updatedUser.referralCode,
      referredBy: updatedUser.referredBy,
      token: generateToken(updatedUser._id.toString(), updatedUser.name, updatedUser.role),
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAudienceStats = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  try {
    const hostId = req.user.id || req.user._id;
    const audienceCount = await User.countDocuments({ referredBy: hostId });
    const audienceList = await User.find({ referredBy: hostId })
      .select('name email lastActiveAt createdAt referralCode role invitedBy')
      .sort({ createdAt: -1 });

    // Build the Top Helpers leaderboard by aggregating registrations within this host's space with invitedBy
    const helperAggregate = await User.aggregate([
      {
        $match: {
          referredBy: new mongoose.Types.ObjectId(hostId),
          invitedBy: { $ne: null }
        }
      },
      {
        $group: {
          _id: '$invitedBy',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      }
    ]);

    const helpers = [];
    for (const item of helperAggregate) {
      if (item._id) {
        const helperUser = await User.findById(item._id).select('name email avatar role xp level badge');
        if (helperUser) {
          helpers.push({
            _id: helperUser._id,
            name: helperUser.name,
            email: helperUser.email,
            avatar: helperUser.avatar,
            role: helperUser.role,
            xp: helperUser.xp,
            level: helperUser.level,
            badge: helperUser.badge,
            count: item.count
          });
        }
      }
    }

    // Top XP Earners from this space
    const topXPEarners = await User.find({ parentHostId: hostId })
      .select('name email avatar xp level badge')
      .sort({ xp: -1 })
      .limit(10);

    // Most Active Members from this space
    const mostActive = await User.find({ parentHostId: hostId })
      .select('name email avatar meetingsAttended xp level badge')
      .sort({ meetingsAttended: -1 })
      .limit(10);

    // Top Inviters from this space
    const topInviters = await User.find({ parentHostId: hostId })
      .select('name email avatar inviteCount xp level badge')
      .sort({ inviteCount: -1 })
      .limit(10);

    res.json({
      count: audienceCount,
      users: audienceList,
      helpers: helpers,
      topXPEarners,
      mostActive,
      topInviters
    });
  } catch (error: any) {
    console.error('Error in getAudienceStats:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getReferralInfo = async (req: Request, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { code } = req.params;
  try {
    if (!code) return res.status(400).json({ message: 'Referral code is required' });
    const host = await User.findOne({ referralCode: code.trim().toUpperCase() });
    if (!host) {
      return res.status(404).json({ message: 'Referral code is invalid' });
    }
    res.json({
      name: host.name,
      referralCode: host.referralCode,
      id: host._id
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const addXP = async (req: any, res: Response) => {
  if (!checkDbConnection(res)) return;
  const { action, meetingCode } = req.body;
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    let xpToAdd = 0;
    let limitCheck = false;

    switch (action) {
      case 'join_meeting':
        xpToAdd = 10;
        limitCheck = true;
        break;
      case 'attend_30m':
        xpToAdd = 20;
        limitCheck = true;
        break;
      case 'attend_1h':
        xpToAdd = 40;
        limitCheck = true;
        break;
      case 'raise_hand':
        xpToAdd = 2;
        break;
      case 'chat_participation':
        xpToAdd = 1;
        break;
      case 'daily_login':
        xpToAdd = 5;
        break;
      default:
        return res.status(400).json({ message: 'Invalid action' });
    }

    if (xpToAdd === 0) {
      return res.json({ xp: user.xp, level: user.level, badge: user.badge });
    }

    if (limitCheck && meetingCode) {
      const alreadyAwarded = await AnalyticsLog.exists({
        event: `xp_${action}` as any,
        userId: user._id,
        meetingCode
      });
      if (alreadyAwarded) {
        return res.json({ xp: user.xp, level: user.level, badge: user.badge, message: 'XP already awarded.' });
      }

      await AnalyticsLog.create({
        event: `xp_${action}` as any,
        userId: user._id,
        meetingCode
      });
    }

    if (action === 'join_meeting') {
      user.meetingsAttended = (user.meetingsAttended || 0) + 1;
    }

    user.xp = (user.xp || 0) + xpToAdd;
    await user.save();

    // Trigger Notification for earning XP
    try {
      sendNotification(req.app, {
        userId: user._id.toString(),
        category: 'Rewards',
        icon: '🎉',
        title: 'XP Earned!',
        description: `You earned ${xpToAdd} XP for ${action.replace('_', ' ')}.`,
        link: '/dashboard'
      });
    } catch (xpNotifyErr) {
      console.error("XP notification integration error:", xpNotifyErr);
    }

    res.json({
      xp: user.xp,
      level: user.level,
      badge: user.badge,
      meetingsAttended: user.meetingsAttended,
      xpAdded: xpToAdd
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
};

