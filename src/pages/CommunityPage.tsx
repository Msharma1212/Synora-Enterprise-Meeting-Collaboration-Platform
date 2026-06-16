import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import api from '../services/api';
import toast from 'react-hot-toast';
import { 
  User as UserIcon, 
  Users, 
  Video, 
  Calendar, 
  History, 
  Megaphone, 
  Award, 
  Trophy, 
  Share2, 
  UserPlus, 
  Sparkles, 
  ArrowRight,
  Shield,
  Loader2,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';

export const CommunityPage = () => {
  const { username } = useParams<{ username: string }>();
  const { user, login } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [data, setData] = useState<{
    host: any;
    totalAudience: number;
    isLiveNow: boolean;
    liveMeetingCode: string | null;
    upcomingMeetings: any[];
    pastMeetings: any[];
    announcements: any[];
    leaderboard: any[];
    topHelpers: any[];
  } | null>(null);

  const fetchCommunityData = async () => {
    try {
      const response = await api.get(`/auth/community/${username}`);
      setData(response.data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.message || 'Failed to load community profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (username) {
      fetchCommunityData();
    }
  }, [username]);

  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
        <span className="font-bold tracking-widest text-slate-400 text-xs uppercase">Loading Community Hub...</span>
      </div>
    );
  }

  if (!data || !data.host) {
    return (
      <div className="h-screen bg-slate-950 flex flex-col items-center justify-center text-white p-8 text-center space-y-6">
        <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20">
          <UserIcon className="w-12 h-12 text-red-500" />
        </div>
        <div>
          <h2 className="text-2xl font-black uppercase tracking-tight text-white">Community Not Found</h2>
          <p className="text-slate-400 text-sm mt-2 max-w-sm">
            We couldn't locate any community profile registered under "{username}". Verify the URL and try again.
          </p>
        </div>
        <Link 
          to="/dashboard" 
          className="px-6 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-200 hover:text-white font-bold text-xs uppercase tracking-wider transition-all"
        >
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const {
    host,
    totalAudience,
    isLiveNow,
    liveMeetingCode,
    upcomingMeetings,
    pastMeetings,
    announcements,
    leaderboard,
    topHelpers
  } = data;

  const handleJoinCommunity = async () => {
    if (!user) {
      toast.error('Please log in or register to join this community.');
      navigate('/login', { state: { from: `/community/${username}` } });
      return;
    }

    setIsJoining(true);
    try {
      const response = await api.post(`/auth/community/${username}/join`);
      toast.success(response.data.message || t.joinCommunitySuccess);
      
      // Update our logged in profile context locally
      if (user) {
        const updatedUser = { 
          ...user, 
          parentHostId: host._id,
          role: 'audience' as const
        };
        login(updatedUser);
      }
      
      fetchCommunityData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to join community.');
    } finally {
      setIsJoining(false);
    }
  };

  const handleShareCommunity = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      toast.success(t.referralLinkCopied || 'Community page URL copied to clipboard!', { icon: '🔗' });
    }).catch(() => {
      toast.error('Failed to copy link.');
    });
  };

  const scrollToMeetings = () => {
    const el = document.getElementById('meetings-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Determine user relationship status
  const isSelf = user?._id === host._id;
  const isMemberObj = user?.parentHostId === host._id;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
      {/* 1. Header Hero Banner */}
      <div className="relative bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 border-b border-slate-800 py-12 md:py-16 px-4 md:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_50%)]" />
        
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1",
                isLiveNow 
                  ? "bg-red-500/10 text-red-500 border border-red-500/20 animate-pulse" 
                  : "bg-slate-800 text-slate-400 border border-slate-700"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full", isLiveNow ? "bg-red-500" : "bg-slate-500")} />
                {isLiveNow ? t.liveNow : t.offline}
              </span>
              {isMemberObj && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  Joined Member
                </span>
              )}
            </div>

            <h1 className="text-3xl md:text-5xl font-black text-white uppercase tracking-tighter">
              {host.name}'s Community
            </h1>
            <p className="text-slate-400 font-bold text-xs md:text-sm uppercase tracking-widest mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
              <span className="flex items-center gap-1.5 text-blue-400">
                <Users className="w-4 h-4" />
                {t.totalAudience}: <strong className="text-white">{totalAudience.toLocaleString()}</strong>
              </span>
              <span className="text-slate-700">•</span>
              <span className="flex items-center gap-1.5 text-indigo-400">
                <Video className="w-4 h-4" />
                Meetings: <strong className="text-white">{host.audienceCount || pastMeetings.length + upcomingMeetings.length}</strong>
              </span>
            </p>
          </div>

          <div className="flex flex-wrap gap-3 w-full md:w-auto shrink-0 mt-4 md:mt-0">
            {isSelf ? (
              <Link 
                to="/dashboard"
                className="flex-1 md:flex-none py-3 px-6 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase tracking-wider text-center transition-all duration-200 shadow-lg shadow-blue-600/20"
              >
                Manage My Space
              </Link>
            ) : (
              <button
                onClick={handleJoinCommunity}
                disabled={isJoining || isMemberObj}
                className={cn(
                  "flex-1 md:flex-none py-3 px-6 rounded-2xl font-black text-xs uppercase tracking-wider text-center transition-all duration-200 flex items-center justify-center gap-2",
                  isMemberObj
                    ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 cursor-default"
                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20 hover:-translate-y-0.5 active:translate-y-0"
                )}
              >
                {isJoining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4" />
                )}
                {isMemberObj ? t.alreadyInCommunity : t.joinCommunity}
              </button>
            )}

            <button
              onClick={handleShareCommunity}
              className="py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2"
              title={t.shareCommunity}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{t.shareCommunity}</span>
            </button>

            <button
              onClick={scrollToMeetings}
              className="py-3 px-4 rounded-2xl bg-slate-900/40 hover:bg-slate-900 border border-slate-800/60 text-slate-400 hover:text-slate-300 font-bold text-xs uppercase tracking-wider transition-all duration-200"
            >
              Sessions
            </button>
          </div>
        </div>
      </div>

      {/* 2. Main Content Grid */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT/MID COLUMN - Dynamic Feed, Profile, Meetings (Col-span-2) */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Live Session Alert Banner */}
            {isLiveNow && (
              <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-r from-red-600 to-orange-600 p-6 md:p-8 border border-red-500/30 shadow-xl shadow-red-900/10 animate-pulse">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                  <Video className="w-32 h-32" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="space-y-1">
                    <span className="font-extrabold text-[10px] tracking-widest text-white/90 uppercase bg-white/20 px-2.5 py-0.5 rounded-full">
                      🔴 Live Session Active
                    </span>
                    <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight mt-1">
                      Join the ongoing live room!
                    </h3>
                    <p className="text-red-100 text-xs font-medium">
                      Host is presenting on the main stage now. Click below to participate.
                    </p>
                  </div>
                  <Link
                    to={user ? `/meeting/${liveMeetingCode}` : '/login'}
                    className="w-full md:w-auto px-6 py-3 bg-white text-red-600 hover:bg-red-50 font-black text-xs uppercase tracking-wider rounded-xl text-center shadow-lg transition-all"
                  >
                    Join Live Broadcast
                  </Link>
                </div>
              </div>
            )}

            {/* Host Banner & Bio */}
            <div className="bg-slate-900/60 border border-slate-900 p-8 rounded-[2.5rem] relative overflow-hidden">
              <div className="absolute top-0 left-0 bg-blue-500/10 text-blue-400 px-4 py-1 rounded-br-2xl text-[9px] font-black uppercase tracking-wider border-r border-b border-blue-500/10">
                {t.hostProfile}
              </div>
              <div className="flex flex-col sm:flex-row items-start gap-4 mt-2">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center font-black text-white text-2xl uppercase shadow-lg select-none ring-4 ring-slate-950 shrink-0">
                  {host.name.charAt(0)}
                </div>
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                    {host.name}
                    {host.role && (
                      <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/25">
                        {host.role}
                      </span>
                    )}
                  </h2>
                  <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
                    {host.bio || `Welcome to my community! Join to earn XP, achieve exclusive member badges, attend scheduled webinars, and gain access to premium resources.`}
                  </p>
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest pt-2">
                    Level: {host.level || 5} • {host.badge || '👑 Community Legend'}
                  </p>
                </div>
              </div>
            </div>

            {/* Meetings Section */}
            <div id="meetings-section" className="space-y-6 scroll-mt-20">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3">
                <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-500" />
                  {t.upcomingMeetings}
                </h3>
                <span className="bg-slate-900 text-slate-400 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                  {upcomingMeetings.length}
                </span>
              </div>

              {upcomingMeetings.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-900/60 rounded-[1.5rem] p-8 text-center text-slate-500 text-sm">
                  No upcoming meetings scheduled right now. Check back soon for announcements!
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingMeetings.map((mt: any) => (
                    <div 
                      key={mt._id} 
                      className="bg-slate-900/40 border border-slate-900 hover:border-slate-800 p-5 rounded-2xl transition-all duration-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-white text-sm uppercase tracking-tight leading-snug">
                          {mt.title}
                        </h4>
                        <div className="text-slate-500 text-[10px] font-bold uppercase tracking-wider flex flex-wrap items-center gap-2">
                          <span>Code: {mt.code}</span>
                          <span>•</span>
                          <span className="text-indigo-400">Starts: {new Date(mt.startTime).toLocaleString()}</span>
                        </div>
                      </div>
                      
                      <Link
                        to={user ? `/meeting/${mt.code}` : '/login'}
                        className="py-1.5 px-3.5 rounded-lg bg-blue-600/10 border border-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white font-extrabold text-[10px] uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
                      >
                        Details
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              )}

              {/* Past Meetings */}
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 pt-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <History className="w-5 h-5 text-slate-400" />
                  {t.pastMeetings}
                </h3>
                <span className="bg-slate-900 text-slate-400 px-2.5 py-0.5 rounded-full text-[10px] font-black">
                  {pastMeetings.length}
                </span>
              </div>

              {pastMeetings.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-900/60 rounded-[1.5rem] p-8 text-center text-slate-500 text-sm">
                  No past sessions recorded yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {pastMeetings.map((mt: any) => (
                    <div 
                      key={mt._id} 
                      className="bg-slate-900/20 border border-slate-900/40 p-4 rounded-xl flex items-center justify-between"
                    >
                      <div>
                        <h4 className="font-bold text-slate-300 text-xs uppercase tracking-tight">
                          {mt.title}
                        </h4>
                        <span className="text-slate-500 text-[9px] font-bold tracking-wider">
                          Finished: {new Date(mt.startTime).toLocaleDateString()}
                        </span>
                      </div>
                      <span className="text-slate-500 text-[10px] font-mono tracking-tighter">
                        {mt.code}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Host Announcements Feed */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-900 pb-3 pt-4">
                <h3 className="text-lg font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-amber-500" />
                  {t.announcements}
                </h3>
              </div>

              {announcements.length === 0 ? (
                <div className="bg-slate-900/10 border border-slate-900/40 rounded-2xl p-8 text-center text-slate-500 text-xs uppercase tracking-widest">
                  No community announcements posted.
                </div>
              ) : (
                <div className="space-y-4">
                  {announcements.map((broadcast: any) => (
                    <div 
                      key={broadcast._id} 
                      className="bg-slate-900/40 border border-slate-900 rounded-[1.5rem] p-6 relative overflow-hidden"
                    >
                      <div className="flex items-start justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs uppercase">
                            {host.name.charAt(0)}
                          </div>
                          <div>
                            <span className="text-slate-200 text-xs font-extrabold uppercase tracking-tight block">
                              {host.name}
                            </span>
                            <span className="text-slate-500 text-[8px] font-bold uppercase tracking-wider block">
                              {new Date(broadcast.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <p className="text-slate-300 text-sm leading-relaxed mt-2 whitespace-pre-line">
                        {broadcast.message}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN - Leadboard & Helpers (Col-span-1) */}
          <div className="space-y-8">
            
            {/* Level & Badge Perks Panel (If logged in, show user's stats relative to leader) */}
            {user && (
              <div className="bg-slate-900/40 border border-slate-900 p-6 rounded-[2rem] space-y-4">
                <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">My Community Reputation</h4>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center font-bold text-slate-900 text-sm">
                    {user.level || 1}
                  </div>
                  <div>
                    <h5 className="font-extrabold text-white text-xs uppercase tracking-tight block">
                      {user.name}
                    </h5>
                    <span className="text-slate-400 text-[10px] font-medium block">
                      {user.badge || '🥉 Bronze Member'}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                  <div className="bg-slate-950/55 p-2 rounded-lg text-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">XP EARNED</span>
                    <strong className="text-white text-sm font-black">{user.xp || 0}</strong>
                  </div>
                  <div className="bg-slate-950/55 p-2 rounded-lg text-center">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block">ATTENDED</span>
                    <strong className="text-white text-sm font-black">{user.meetingsAttended || 0}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* ⭐ Community XP Leaderboard */}
            <div className="bg-slate-900/60 border border-slate-900 p-6 rounded-[2.5rem] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Trophy className="w-5 h-5 text-amber-500" />
                <h3 className="font-black text-xs uppercase tracking-wider text-white">
                  {t.communityXPLeaderboard}
                </h3>
              </div>

              {leaderboard.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-4">No XP leader history.</p>
              ) : (
                <div className="space-y-3">
                  {leaderboard.map((member: any, i: number) => {
                    const isTop3 = i < 3;
                    return (
                      <div 
                        key={member._id}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl transition-all",
                          user?._id === member._id ? "bg-blue-900/20 border border-blue-500/20" : "bg-slate-950/30 hover:bg-slate-950/65"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "w-5 h-5 rounded-md flex items-center justify-center font-black text-[9px] uppercase",
                            i === 0 ? "bg-amber-500 text-slate-900" :
                            i === 1 ? "bg-slate-300 text-slate-900" :
                            i === 2 ? "bg-amber-700 text-white" : "bg-slate-800 text-slate-400"
                          )}>
                            {i + 1}
                          </span>
                          <span className="text-slate-200 text-xs font-bold uppercase tracking-tight max-w-[120px] truncate block">
                            {member.name}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-black text-amber-400 tracking-tighter">
                            {member.xp} {t.xp}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 block tracking-widest uppercase">
                            LVL {member.level || 1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 🏆 Top Community Helpers */}
            <div className="bg-slate-900/60 border border-slate-900 p-6 rounded-[2.5rem] space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Award className="w-5 h-5 text-indigo-400" />
                <h3 className="font-black text-xs uppercase tracking-wider text-white">
                  {t.topCommunityHelpers}
                </h3>
              </div>

              {topHelpers.length === 0 ? (
                <p className="text-slate-500 text-xs text-center py-4">No helper logs found yet.</p>
              ) : (
                <div className="space-y-3">
                  {topHelpers.map((member: any) => (
                    <div 
                      key={member._id}
                      className={cn(
                        "flex items-center justify-between p-2.5 rounded-xl bg-slate-950/30 hover:bg-slate-950/50",
                        user?._id === member._id ? "bg-indigo-900/10 border border-indigo-500/15" : ""
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center font-bold text-[9px] text-indigo-400 uppercase">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-slate-200 text-xs font-bold uppercase tracking-tight block truncate max-w-[120px]">
                            {member.name}
                          </span>
                          <span className="text-[8px] font-bold text-slate-400 uppercase block">
                            {member.badge?.replace('Member', '') || 'Bronze'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right text-indigo-400 font-extrabold text-[10px] uppercase tracking-wider">
                        {member.count} invites
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
          
        </div>
      </div>
    </div>
  );
};
