export interface User {
  _id: string;
  name: string;
  email: string;
  avatar?: string;
  token?: string;
  role?: 'admin' | 'developer' | 'co-admin' | 'audience' | 'user' | 'host';
  audienceId?: string;
  audience?: string[];
  referralCode?: string;
  referredBy?: string;
  xp?: number;
  level?: number;
  badge?: string;
  inviteCount?: number;
  meetingsAttended?: number;
  lastLoginDate?: string;
  username?: string;
  settings?: {
    language: string;
    notifications: {
      reminders: boolean;
      emailNotifs: boolean;
    };
  };
}

export interface Meeting {
  _id: string;
  title: string;
  code: string;
  host: string;
  startTime: string;
  isLive: boolean;
  isBroadcast: boolean;
  enableWaitingRoom: boolean;
  participants: string[];
}

export interface ChatMessage {
  id: string;
  senderName: string;
  senderId: string;
  text: string;
  timestamp: Date;
}
