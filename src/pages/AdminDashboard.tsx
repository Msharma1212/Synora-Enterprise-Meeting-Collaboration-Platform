import React, { useEffect, useState } from 'react';
import { 
  Users, Video, Shield, Trash2, Search, AlertTriangle, ShieldCheck, 
  Loader2, Activity, ToggleLeft, BarChart2, Radio, Zap, Clock, Info, Check, X, 
  ShieldAlert, Monitor, MessageSquare, Heart, RefreshCw, LogOut, Cpu, Globe, History, ShieldX
} from 'lucide-react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, 
  ResponsiveContainer, Legend
} from 'recharts';

export const AdminDashboard = () => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState<'live' | 'toggles' | 'analytics' | 'directory'>('directory');
  const [stats, setStats] = useState({ users: 0, meetings: 0, liveMeetings: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Advanced Users Management states
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetails, setUserDetails] = useState<any | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'online' | 'offline' | 'admin' | 'banned'>('all');

  // Real-time stats from socket
  const [activeStats, setActiveStats] = useState({
    activeMeetingsCount: 0,
    totalActiveUsers: 0,
    roomsList: [] as any[],
    onlineUserIds: [] as string[]
  });

  // Global Settings Toggles
  const [globalSettings, setGlobalSettings] = useState({
    chatEnabled: true,
    screenShareEnabled: true,
    waitingRoomEnabled: false,
    reactionsEnabled: true,
    mediaEnabled: true
  });

  // Analytics Logs Stats
  const [analytics, setAnalytics] = useState({
    dailyActiveUsers: 4,
    totalMeetingsCreated: 0,
    averageMeetingDuration: 2700,
    peakUsageText: '14:00 - 15:00',
    trendData: [] as any[]
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    loadGlobalSettings();
    loadAnalytics();

    // Hook Socket.IO for Live monitoring updates
    const socket = io();
    socket.emit("join-admin-console");
    
    socket.on("admin-stats-update", (data: any) => {
      console.log("[Admin Socket Update]:", data);
      setActiveStats(prev => ({
        ...prev,
        ...data,
        onlineUserIds: data.onlineUserIds || []
      }));
    });

    socket.on("global-settings-update", (data: any) => {
      setGlobalSettings(data);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchData = async () => {
    try {
      let usersData = [];
      let meetingsData = [];

      try {
        const usersRes = await api.get('/admin/users');
        usersData = usersRes.data || [];
      } catch (err) {
        console.error("Failed to load users registry directory, using safe fallback:", err);
      }

      try {
        const meetingsRes = await api.get('/admin/meetings');
        meetingsData = meetingsRes.data || [];
      } catch (err) {
        console.error("Failed to load meetings list from administrative records, using safe fallback:", err);
      }

      setUsers(usersData);
      setMeetings(meetingsData);
      setStats({
        users: usersData.length,
        meetings: meetingsData.length,
        liveMeetings: meetingsData.filter((m: any) => m.isLive).length
      });
    } catch (err) {
      console.error("Failed to compute administrative panel statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadGlobalSettings = async () => {
    try {
      const res = await api.get('/admin/global-settings');
      setGlobalSettings(res.data);
    } catch (err) {
      console.error("Failed to load global permissions toggles");
    }
  };

  const loadAnalytics = async () => {
    try {
      const res = await api.get('/admin/analytics');
      setAnalytics(res.data);
    } catch (err) {
      console.error("Failed to load platform stats trend log data");
    }
  };

  const fetchUserDetails = async (userId: string) => {
    setUserDetailLoading(true);
    try {
      const res = await api.get(`/admin/users/${userId}/activity`);
      setUserDetails(res.data);
      setSelectedUser(userId);
    } catch (err) {
      toast.error("Failed to fetch detailed profile metrics");
    } finally {
      setUserDetailLoading(false);
    }
  };

  const handleToggle = async (key: string, currentValue: boolean) => {
    const updated = { ...globalSettings, [key]: !currentValue };
    setGlobalSettings(updated);
    try {
      const res = await api.post('/admin/global-settings', updated);
      setGlobalSettings(res.data);
      toast.success("Feature configuration updated");
    } catch (err) {
      setGlobalSettings(prev => ({ ...prev, [key]: currentValue }));
      toast.error("Failed to push global config update");
    }
  };

  const handleRoleChange = async (userId: string, targetRole: string) => {
    try {
      await api.put(`/admin/users/${userId}/role`, { role: targetRole });
      toast.success(`User role modified to ${targetRole}`);
      await fetchUserDetails(userId);
      await fetchData();
    } catch (err) {
      toast.error("Failed to switch user role");
    }
  };

  const handleBanToggle = async (userId: string, isBanned: boolean) => {
    const route = isBanned ? 'unban' : 'ban';
    try {
      await api.post(`/admin/users/${userId}/${route}`);
      toast.success(`User successfully ${isBanned ? 'unbanned' : 'banned'}`);
      await fetchUserDetails(userId);
      await fetchData();
    } catch (err) {
      toast.error(`Failed to ${route} user account`);
    }
  };

  const handleForceLogout = async (userId: string) => {
    try {
      await api.post(`/admin/users/${userId}/logout`);
      toast.success("Sessions terminated. Forced logouts emitted.");
      await fetchUserDetails(userId);
    } catch (err) {
      toast.error("Failed to terminate active user session connections");
    }
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this user? This will remove all their hosted rooms.")) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/users/${id}`);
      setUsers(prev => prev.filter(u => u._id !== id));
      toast.success("User deleted successfully");
      if (selectedUser === id) {
        setSelectedUser(null);
        setUserDetails(null);
      }
      fetchData();
    } catch (err) {
      toast.error("Failed to delete user and associated records");
    } finally {
      setDeletingId(null);
    }
  };

  const deleteMeeting = async (id: string) => {
    if (!window.confirm("Are you sure you want to destroy this meeting room?")) return;
    setDeletingId(id);
    try {
      await api.delete(`/admin/meetings/${id}`);
      setMeetings(prev => prev.filter(m => m._id !== id));
      toast.success("Meeting room terminated successfully");
      fetchData();
    } catch (err) {
      toast.error("Failed to terminate meeting database record");
    } finally {
      setDeletingId(null);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins} mins`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hrs}h ${rem}m`;
  };

  // Filter users lists based on selected queries
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(search.toLowerCase()) || 
                          u.email.toLowerCase().includes(search.toLowerCase());
    
    const isUserOnline = activeStats.onlineUserIds.includes(u._id) || 
                         activeStats.roomsList.some((room: any) => room.participants.some((p: any) => p.userId === u._id));

    if (!matchesSearch) return false;

    if (userFilter === 'online') return isUserOnline;
    if (userFilter === 'offline') return !isUserOnline;
    if (userFilter === 'admin') return u.role === 'admin';
    if (userFilter === 'banned') return !!u.isBanned;
    return true;
  });

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-white bg-[#06080C] gap-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="text-xs font-black uppercase tracking-widest text-slate-400">Loading Developer Console...</span>
      </div>
    );
  }

  const tabs = [
    { id: 'directory', name: 'Users Directory', icon: Users },
    { id: 'live', name: 'Active Channels', icon: Activity },
    { id: 'toggles', name: 'Feature Controls', icon: Shield },
    { id: 'analytics', name: 'Usage Analytics', icon: BarChart2 }
  ] as const;

  return (
    <div className="flex-1 p-4 md:p-8 space-y-6 md:space-y-8 overflow-y-auto bg-[#06080C] text-white">
      {/* Upper Navigation Row */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.04] pb-6 md:pb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-white tracking-tighter uppercase">
              Admin <span className="text-blue-500">Panel</span>
            </h1>
            <span className="text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/10 px-2 py-0.5 rounded">
              SaaS Console
            </span>
          </div>
          <p className="text-slate-500 text-[10px] md:text-xs font-bold uppercase tracking-widest mt-1">
            Platform management, dynamic roles, real-time presence control
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button 
            onClick={fetchData} 
            className="p-2.5 bg-slate-900 border border-white/5 rounded-xl hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            title="Refresh statistics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-blue-600/10 border border-blue-500/20 rounded-xl">
             <ShieldCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-blue-500 animate-pulse" />
             <span className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-blue-400">
               Root Authority Active
             </span>
          </div>
        </div>
      </div>

      {/* Tabs list bar */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-2xl border border-white/5 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${
                isActive 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.name}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.2 }}
          className="space-y-6 md:space-y-8"
        >
          {/* TAB 1: Enterprise Users Directory */}
          {activeTab === 'directory' && (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {/* Users List block */}
              <div className="xl:col-span-2 bg-slate-900/40 border border-white/5 rounded-3xl p-6 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-black uppercase tracking-wider text-white">Registered Members</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Manage credentials, presence and authorization states</p>
                  </div>
                  
                  {/* Search box */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      placeholder="Search name, email..."
                      className="w-full bg-slate-950 border border-white/5 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-semibold text-white"
                    />
                  </div>
                </div>

                {/* Filter pill selectors */}
                <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.03] pb-4">
                  {(['all', 'online', 'offline', 'admin', 'banned'] as const).map(filter => {
                    const isSelected = userFilter === filter;
                    return (
                      <button
                        key={filter}
                        onClick={() => setUserFilter(filter)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                          isSelected 
                            ? 'bg-blue-600/10 text-blue-400 border-blue-500/20 shadow shadow-blue-500/5' 
                            : 'bg-transparent text-slate-500 border-white/[0.03] hover:text-slate-300'
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>

                {/* Users list list-view */}
                <div className="space-y-3 max-h-[550px] overflow-y-auto pr-1 scrollbar-thin">
                  {filteredUsers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-500 gap-2">
                      <Users className="w-8 h-8 opacity-30" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">No users match your filters</span>
                    </div>
                  ) : (
                    filteredUsers.map(u => {
                      const isOnline = activeStats.onlineUserIds.includes(u._id) || 
                                       activeStats.roomsList.some((room: any) => room.participants.some((p: any) => p.userId === u._id));
                      const isSelected = selectedUser === u._id;

                      return (
                        <div 
                          key={u._id} 
                          onClick={() => fetchUserDetails(u._id)}
                          className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between group cursor-pointer ${
                            isSelected 
                              ? 'bg-blue-600/5 border-blue-500/30' 
                              : 'bg-slate-950/40 border-white/[0.02] hover:bg-slate-900/40 hover:border-white/5'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-xs font-black text-slate-300 capitalize">
                                {u.name.charAt(0)}
                              </div>
                              <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#06080C] ${isOnline ? 'bg-emerald-500 shadow-lg shadow-emerald-500/35' : 'bg-slate-700'}`} />
                            </div>

                             <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">{u.name}</span>
                                {u.role && u.role !== 'user' && (
                                  <span className={`text-[8px] font-black uppercase tracking-widest border px-1.5 py-0.5 rounded ${
                                    u.role === 'developer' ? 'bg-red-500/10 text-red-500 border-red-500/10' :
                                    u.role === 'admin' ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/15' :
                                    u.role === 'co-admin' ? 'bg-teal-500/10 text-teal-400 border-teal-500/10' :
                                    u.role === 'audience' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' :
                                    u.role === 'host' ? 'bg-amber-500/10 text-amber-500 border-amber-500/10' : ''
                                  }`}>
                                    {u.role}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] font-black uppercase text-slate-600 tracking-tighter block">{u.email}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {u.isBanned && (
                              <span className="text-[8px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/10 px-1.5 py-0.5 rounded">Banned</span>
                            )}
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteUser(u._id);
                              }}
                              disabled={deletingId === u._id}
                              className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-500/15 rounded-xl transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
                              title="Delete member"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Advanced detailed User Profile column */}
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6">
                {!selectedUser ? (
                  <div className="flex flex-col items-center justify-center text-slate-500 py-32 text-center gap-3 border border-white/[0.02] border-dashed rounded-3xl">
                    <Radio className="w-8 h-8 opacity-35 animate-pulse text-blue-500" />
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Select dynamic peer node</h4>
                      <p className="text-[10px] text-slate-500 max-w-[200px] leading-relaxed mx-auto mt-1 uppercase font-semibold">Click on any registered account row to query user logs, security profile and tools controllers</p>
                    </div>
                  </div>
                ) : userDetailLoading ? (
                  <div className="flex flex-col items-center justify-center py-32 text-slate-500 gap-3">
                    <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Loading live node...</span>
                  </div>
                ) : userDetails ? (
                  <div className="space-y-6">
                    {/* Panel Header */}
                    <div className="flex items-start justify-between border-b border-white/5 pb-5">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600/10 border border-blue-500/10 text-blue-400 font-extrabold rounded-2xl flex items-center justify-center text-lg capitalize shadow-lg">
                          {userDetails.user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-extrabold text-white text-base leading-tight">{userDetails.user.name}</h4>
                            {userDetails.user.role && userDetails.user.role !== 'user' && (
                              <span className={`text-[8px] font-black uppercase tracking-widest border px-1.5 py-0.5 rounded ${
                                userDetails.user.role === 'developer' ? 'bg-red-500/10 text-red-500 border-red-500/10' :
                                userDetails.user.role === 'admin' ? 'bg-[#10b981]/15 text-[#10b981] border-[#10b981]/15' :
                                userDetails.user.role === 'co-admin' ? 'bg-teal-500/10 text-teal-400 border-teal-500/10' :
                                userDetails.user.role === 'audience' ? 'bg-purple-500/10 text-purple-400 border-purple-500/10' :
                                userDetails.user.role === 'host' ? 'bg-amber-500/10 text-amber-500 border-amber-500/10' : ''
                              }`}>
                                {userDetails.user.role}
                              </span>
                            )}
                          </div>
                          <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">{userDetails.user.email}</span>
                          <span className="text-[9px] text-slate-400 font-medium mt-0.5 block">Joined: {new Date(userDetails.user.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="p-1.5 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                    </div>

                    {/* Operational live presence status banner */}
                    <div className="p-4 bg-slate-950 rounded-2xl flex items-center justify-between border border-white/[0.02]">
                      <div className="space-y-0.5">
                        <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block">Websocket connectivity</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full ${userDetails.liveStatus.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                          <span className="text-xs font-bold text-slate-300">{userDetails.liveStatus.isOnline ? 'OnlineSession' : 'Offline'}</span>
                        </div>
                      </div>

                      {userDetails.liveStatus.currentMeetingCode && (
                        <div className="bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-xl border border-emerald-500/10 text-right">
                          <span className="text-[8px] font-black uppercase block tracking-wider">In meeting room</span>
                          <span className="font-mono text-xs font-bold">{userDetails.liveStatus.currentMeetingCode}</span>
                        </div>
                      )}
                    </div>

                    {/* Action controllers buttons */}
                    {(() => {
                      const getRoleLevel = (r?: string): number => {
                        switch (r?.toLowerCase()) {
                          case 'developer': return 4;
                          case 'admin':
                          case 'host':
                          case 'co-admin': return 3;
                          case 'audience': return 2;
                          case 'user': return 1;
                          default: return 1;
                        }
                      };

                      const actorLevel = getRoleLevel(currentUser?.role);
                      const targetLevel = getRoleLevel(userDetails.user.role);
                      const cannotManage = targetLevel >= actorLevel;

                      return (
                        <div className="space-y-2 border-t border-b border-white/5 py-5">
                          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block px-1">Admin Command Panel</span>
                          {cannotManage ? (
                            <div className="p-3 bg-red-950/10 border border-red-500/10 rounded-xl text-[10px] text-red-400 font-bold uppercase tracking-widest leading-relaxed">
                              Hierarchy Lock: This user holds a higher or equal role level. Access denied.
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {/* Only Developer (Level 4) can manage Admin or Co-Admin roles */}
                              {actorLevel > 3 && (
                                <>
                                  <button 
                                    onClick={() => handleRoleChange(userDetails.user._id, userDetails.user.role === 'admin' ? 'user' : 'admin')}
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-300 hover:text-white flex items-center justify-center gap-2"
                                  >
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{userDetails.user.role === 'admin' ? 'Remove Admin' : 'Make Admin'}</span>
                                  </button>

                                  <button 
                                    onClick={() => handleRoleChange(userDetails.user._id, userDetails.user.role === 'co-admin' ? 'user' : 'co-admin')}
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-300 hover:text-white flex items-center justify-center gap-2"
                                  >
                                    <Users className="w-3.5 h-3.5 text-teal-400" />
                                    <span>{userDetails.user.role === 'co-admin' ? 'Remove Co-Admin' : 'Make Co-Admin'}</span>
                                  </button>

                                  <button 
                                    onClick={() => handleRoleChange(userDetails.user._id, userDetails.user.role === 'developer' ? 'user' : 'developer')}
                                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-300 hover:text-white flex items-center justify-center gap-2"
                                  >
                                    <Zap className="w-3.5 h-3.5 text-blue-400" />
                                    <span>{userDetails.user.role === 'developer' ? 'Remove Dev' : 'Make Dev'}</span>
                                  </button>
                                </>
                              )}

                              {/* Admins and above can manage Audiences */}
                              {actorLevel > 2 && (
                                <button 
                                  onClick={() => handleRoleChange(userDetails.user._id, userDetails.user.role === 'audience' ? 'user' : 'audience')}
                                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-300 hover:text-white flex items-center justify-center gap-2"
                                >
                                  <Radio className="w-3.5 h-3.5 text-purple-400" />
                                  <span>{userDetails.user.role === 'audience' ? 'Remove Audience' : 'Make Audience'}</span>
                                </button>
                              )}

                              <button 
                                onClick={() => handleForceLogout(userDetails.user._id)}
                                className="px-4 py-2.5 bg-slate-900 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/10 border border-white/5 text-xs font-black uppercase tracking-wider rounded-xl transition-all text-slate-300 flex items-center justify-center gap-2"
                              >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Force Logout</span>
                              </button>

                              <button 
                                onClick={() => handleBanToggle(userDetails.user._id, userDetails.user.isBanned)}
                                className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 border ${
                                  userDetails.user.isBanned 
                                    ? 'bg-emerald-600/10 text-emerald-400 border-emerald-500/10 hover:bg-emerald-600/20' 
                                    : 'bg-red-600/10 text-red-500 border-red-500/10 hover:bg-red-600/20'
                                }`}
                              >
                                {userDetails.user.isBanned ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldX className="w-3.5 h-3.5" />}
                                <span>{userDetails.user.isBanned ? 'Unlock Account' : 'Ban Account'}</span>
                              </button>

                              <button 
                                onClick={() => deleteUser(userDetails.user._id)}
                                className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/10 col-span-2 mt-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete User Account</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Operational metrics stats grid */}
                    <div className="grid grid-cols-2 gap-3 pb-3">
                      <div className="p-3 bg-white/[0.01] border border-white/[0.02] rounded-2xl">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Meetings created</span>
                        <span className="text-sm font-extrabold text-slate-300">{userDetails.activity.totalCreated}</span>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/[0.02] rounded-2xl">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Meetings joined</span>
                        <span className="text-sm font-extrabold text-slate-300">{userDetails.activity.totalJoined}</span>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/[0.02] rounded-2xl">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Total session stay</span>
                        <span className="text-sm font-extrabold text-slate-300">{formatDuration(userDetails.activity.totalDuration)}</span>
                      </div>
                      <div className="p-3 bg-white/[0.01] border border-white/[0.02] rounded-2xl">
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">Last active activity</span>
                        <span className="text-sm font-extrabold text-slate-300 truncate block">
                          {new Date(userDetails.activity.lastActiveAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>

                    {/* Security history audit log list */}
                    <div className="space-y-3">
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block px-1">Security Audit History</span>
                      <div className="space-y-2 max-h-[140px] overflow-y-auto scrollbar-thin">
                        {(!userDetails.user.loginHistory || userDetails.user.loginHistory.length === 0) ? (
                          <div className="text-[9px] uppercase font-bold text-slate-600 p-3 italic">No security logs recorded</div>
                        ) : (
                          [...userDetails.user.loginHistory].reverse().map((log: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-2.5 bg-white/[0.01] border border-white/[0.02] rounded-xl text-[10px]">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <Cpu className="w-3.5 h-3.5 text-blue-500/60" />
                                <span className="font-semibold text-slate-300">{log.device}</span>
                              </div>
                              <div className="flex items-center gap-2 font-mono text-slate-500">
                                <span>{log.ip}</span>
                                <span>•</span>
                                <span>{new Date(log.timestamp).toLocaleDateString()}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Recent join timeline activity */}
                    <div className="space-y-3">
                      <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block px-1">Meeting Join/Leave Logs</span>
                      <div className="space-y-2 max-h-[150px] overflow-y-auto scrollbar-thin">
                        {userDetails.timeline.length === 0 ? (
                          <div className="text-[9px] uppercase font-bold text-slate-600 p-3 italic">No past meeting timeline traces</div>
                        ) : (
                          userDetails.timeline.map((act: any, i: number) => (
                            <div key={i} className="p-2.5 bg-[#0A0D14]/80 rounded-xl space-y-1 text-[10px] border border-white/[0.01]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 font-bold">
                                  <span className={`w-1.5 h-1.5 rounded-full ${act.event === 'meeting_joined' ? 'bg-indigo-500' : 'bg-[#EF4444]'}`} />
                                  <span className="text-slate-300 uppercase tracking-tighter">
                                    {act.event === 'meeting_joined' ? 'Joined Meeting' : 'Left Meeting'}
                                  </span>
                                </div>
                                <span className="font-mono text-slate-600">{new Date(act.timestamp).toLocaleTimeString()}</span>
                              </div>
                              <div className="flex items-center justify-between text-[9px] text-slate-500">
                                <span className="font-medium uppercase">Code: {act.meetingCode}</span>
                                {act.duration !== undefined && (
                                  <span className="font-medium">Stay: {formatDuration(act.duration)}</span>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          {/* TAB 2: Live Channels monitoring mappings */}
          {activeTab === 'live' && (
            <div className="space-y-6">
              {/* Monitoring Hero Panel */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="p-8 bg-slate-900/55 border border-white/5 rounded-3xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="flex h-3.5 w-3.5 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-2xl border border-emerald-500/20">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-white">{activeStats.totalActiveUsers}</h4>
                      <p className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mt-0.5">Total Connections Live</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-4">Active Socket connections across all live virtual meeting channels currently being updated instantly.</p>
                </div>

                <div className="p-8 bg-slate-900/55 border border-white/5 rounded-3xl relative overflow-hidden group">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 text-blue-500 rounded-2xl border border-blue-500/20">
                      <Radio className="w-6 h-6 animate-pulse" />
                    </div>
                    <div>
                      <h4 className="text-2xl font-black text-white">{activeStats.activeMeetingsCount}</h4>
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-widest mt-0.5">Rooms Live</p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400 font-medium mt-4">Active audio-visual rooms concurrently transmitting peer routing coordinates now.</p>
                </div>
              </div>

              {/* Active Sessions list */}
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight text-white">Active Channel Maps</h3>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Users per live videoconferencing room</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-[#06080C] bg-white px-3 py-1 rounded">Live Socket Records</span>
                </div>

                {activeStats.roomsList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-slate-500 border border-white/[0.02] border-dashed rounded-2xl gap-2">
                    <Radio className="w-8 h-8 opacity-30 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest">No active live sessions running</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {activeStats.roomsList.map((room) => (
                      <div key={room.roomCode} className="p-5 bg-slate-950/80 border border-white/5 rounded-2xl space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Room Identifier</span>
                            <span className="font-mono text-sm font-bold text-blue-400">{room.roomCode}</span>
                          </div>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/15 rounded-xl flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                            {room.activeCount} In Meeting
                          </span>
                        </div>

                        <div className="space-y-2 border-t border-white/[0.04] pt-3">
                          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest block px-1">Participating Peer Nodes</span>
                          <div className="flex flex-wrap gap-1.5">
                            {room.participants.map((p: any) => (
                              <div key={p.socketId} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] border border-white/5 rounded-xl text-xs text-slate-300">
                                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                <span className="font-bold">{p.name || "Anonymous User"}</span>
                                <span className="text-[8px] font-black text-slate-600 font-mono uppercase">({p.socketId.substr(0,4)})</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: Dynamic Feature Configuration Toggles */}
          {activeTab === 'toggles' && (
            <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 md:space-y-8">
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-blue-500" />
                  System Toggle Configuration
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Globally toggle interactive system parameters on-the-fly with instant WebRTC reflection</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <ToggleRow 
                  title="Live Sidebar Chat" 
                  desc="Enable or disable messaging communication capabilities inside rooms globally."
                  active={globalSettings.chatEnabled}
                  onToggle={() => handleToggle('chatEnabled', globalSettings.chatEnabled)}
                  icon={MessageSquare}
                />
                
                <ToggleRow 
                  title="Screen Sharing System" 
                  desc="Restrict or enable desktop/window streaming permissions instantly."
                  active={globalSettings.screenShareEnabled}
                  onToggle={() => handleToggle('screenShareEnabled', globalSettings.screenShareEnabled)}
                  icon={Monitor}
                />

                <ToggleRow 
                  title="Waiting Approval Room" 
                  desc="Forces users to wait in buffer screens until hosts admit or reject entry."
                  active={globalSettings.waitingRoomEnabled}
                  onToggle={() => handleToggle('waitingRoomEnabled', globalSettings.waitingRoomEnabled)}
                  icon={ShieldAlert}
                />

                <ToggleRow 
                  title="Microphone / Camera Transmissions" 
                  desc="Block or enable real-time camera/microphone device capture."
                  active={globalSettings.mediaEnabled}
                  onToggle={() => handleToggle('mediaEnabled', globalSettings.mediaEnabled)}
                  icon={Zap}
                />

                <ToggleRow 
                  title="Emoji Peer Reactions" 
                  desc="Allows users to float emoji symbols across meeting canvas channels."
                  active={globalSettings.reactionsEnabled}
                  onToggle={() => handleToggle('reactionsEnabled', globalSettings.reactionsEnabled)}
                  icon={Heart}
                />
              </div>

              <div className="p-6 bg-blue-600/5 border border-blue-500/10 rounded-2xl flex items-start gap-4">
                <Info className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider">How to test overrides?</h4>
                  <p className="text-xs text-slate-400 leading-relaxed font-semibold font-sans">Toggling these items propagates settings in MongoDB and emits a global broadcast update instantly to all connected channels. Users immediately see options gray out with tooltips labeled &quot;Disabled by Administrator&quot; and are blocked from operations.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: Usage Analytics & Flow Trends */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              {/* Stats Analytics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <AnalyticsCard icon={Users} label="Daily Active Users" value={analytics.dailyActiveUsers} desc="Unique logins & joins" />
                <AnalyticsCard icon={Video} label="All Time Created" value={analytics.totalMeetingsCreated} desc="Cumulative rooms in db" />
                <AnalyticsCard icon={Clock} label="Avg Room Stay" value={formatDuration(analytics.averageMeetingDuration)} desc="Session timeline length" />
                <AnalyticsCard icon={Zap} label="Peak Channel usage" value={analytics.peakUsageText} desc="Highest server connection" />
              </div>

              {/* Graphical Visualizations using Recharts */}
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6">
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight text-white">Platform System Activity Trend</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Visits and rooms creations graph past 7 days</p>
                </div>

                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorMeetings" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorParticipants" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} />
                      <ChartTooltip 
                        contentStyle={{ backgroundColor: '#090d16', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1rem' }}
                        labelStyle={{ color: '#fff', fontWeight: 'bold', fontSize: '11px' }}
                      />
                      <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold' }} />
                      <Area name="Meetings Created" type="monotone" dataKey="meetings" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorMeetings)" />
                      <Area name="Unique Participants" type="monotone" dataKey="participants" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorParticipants)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

interface ToggleRowProps {
  title: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
  icon: any;
}

const ToggleRow = ({ title, desc, active, onToggle, icon: Icon }: ToggleRowProps) => (
  <div className="p-5 bg-slate-950/80 border border-white/5 rounded-2xl flex items-center justify-between gap-6 hover:border-white/10 transition-all">
    <div className="flex items-start gap-4">
      <div className={`p-3 rounded-xl mt-0.5 ${active ? "bg-blue-600/10 text-blue-400" : "bg-slate-800/30 text-slate-500"}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="space-y-0.5">
        <h4 className="text-sm font-bold text-white">{title}</h4>
        <p className="text-[10px] text-slate-500 font-medium leading-relaxed">{desc}</p>
      </div>
    </div>
    
    <button 
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
        active ? 'bg-blue-600' : 'bg-slate-800'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
          active ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  </div>
);

const AnalyticsCard = ({ icon: Icon, label, value, desc }: any) => (
  <div className="p-6 bg-slate-900/50 border border-white/5 rounded-3xl relative overflow-hidden group hover:border-white/10 transition-all">
    <div className="flex items-center gap-4">
      <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/15">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[8px] font-black uppercase text-slate-500 tracking-widest">{label}</p>
        <p className="text-xl font-black text-white mt-0.5 truncate max-w-[150px]">{value}</p>
      </div>
    </div>
    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-4">{desc}</p>
  </div>
);
