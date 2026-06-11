import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { History as HistoryIcon, Video, Clock, Calendar, Search, ArrowRight, ExternalLink, Trash2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';
import io from 'socket.io-client';

interface Meeting {
  _id: string;
  title: string;
  code: string;
  startTime: string;
  endTime?: string;
  isLive: boolean;
  isBroadcast?: boolean;
}

export const HistoryPage = () => {
  const { user } = useAuth();
  const { t, localeCode } = useTranslation();
  const [history, setHistory] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const { data } = await api.get('/meetings/history');
        setHistory(Array.isArray(data) ? data : []);
      } catch (error: any) {
        console.error('Failed to fetch history:', error);
        setHistory([]);
        if (error.response?.status !== 401) {
          const errorMessage = error.response?.data?.message || 'Failed to fetch meeting history';
          toast.error(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchHistory();
    } else {
      setLoading(false);
      setHistory([]);
    }
  }, [user]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteMeeting = async (id: string, code: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/meetings/${id}`);
      setHistory(prev => prev.filter(m => m._id !== id));
      toast.success("Meeting deleted permanently from everywhere");

      // Notify active room participants of deletion to force client exit using socket
      try {
        const socket = io();
        socket.emit("meeting-deleted", { meetingId: id, meetingCode: code });
        setTimeout(() => socket.disconnect(), 1000);
      } catch (e) {
        console.error("Failed to emit meeting-deleted:", e);
      }
    } catch (err: any) {
      console.error("Failed to delete meeting:", err);
      toast.error(err.response?.data?.message || "Failed to delete meeting");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredHistory = Array.isArray(history) ? history.filter(meeting => 
    meeting.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    meeting.code.toLowerCase().includes(searchQuery.toLowerCase())
  ) : [];

  const isRegularUser = !user || (!['host', 'admin', 'developer', 'co-admin'].includes(user.role || ''));
  const displayedHistory = isRegularUser ? filteredHistory.slice(0, 3) : filteredHistory;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-end mb-4">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input 
            type="text" 
            placeholder={t.searchMeetings}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-2xl pl-12 pr-6 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="p-10 md:p-20 text-center space-y-4">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">{t.loadingSessions}</p>
          </div>
        ) : displayedHistory.length > 0 ? (
          displayedHistory.map((meeting) => {
            const isMeetingHostOrAdmin = user?.role === 'admin' || user?.role === 'developer' || user?.role === 'co-admin' || user?.role === 'host' ||
                                         (meeting as any).host === user?._id || (meeting as any).audienceId === user?._id ||
                                         (typeof (meeting as any).host === 'object' && (meeting as any).host?._id === user?._id);
            return (
              <div 
                key={meeting._id}
                className="bg-slate-900/50 border border-slate-800 hover:border-blue-500/30 p-4 md:p-6 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 transition-all group"
              >
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-12 h-12 md:w-16 md:h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600/10 group-hover:text-blue-500 transition-colors shrink-0">
                    <Video className="w-6 h-6 md:w-8 md:h-8" />
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg md:text-xl font-bold text-white group-hover:text-blue-400 transition-colors truncate">{meeting.title}</h3>
                      {meeting.isBroadcast && (
                        <span className="px-2 py-0.5 bg-blue-600/10 border border-blue-500/20 text-blue-500 text-[8px] font-black uppercase tracking-tighter rounded-md">Broadcast</span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 md:gap-4 text-xs md:text-sm text-slate-500 font-medium">
                      <span className="flex items-center gap-1 md:gap-1.5 shrink-0">
                        <Calendar className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        {meeting.startTime && !isNaN(new Date(meeting.startTime).getTime()) ? new Date(meeting.startTime).toLocaleDateString(localeCode, { day: 'numeric', month: 'short', year: 'numeric' }) : t.unknownDate}
                      </span>
                      <span className="flex items-center gap-1 md:gap-1.5 shrink-0">
                        <Clock className="w-3.5 h-3.5 md:w-4 md:h-4" />
                        {meeting.startTime && !isNaN(new Date(meeting.startTime).getTime()) ? new Date(meeting.startTime).toLocaleTimeString(localeCode, { hour: '2-digit', minute: '2-digit' }) : t.unknownTime}
                      </span>
                      <span className="bg-slate-800 px-2 py-0.5 rounded text-[10px] md:text-xs font-mono text-slate-400 border border-slate-700 shrink-0">
                        ID: {meeting.code}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isMeetingHostOrAdmin && (
                    <div className="flex items-center gap-1.5 transition-all">
                      {confirmDeleteId === meeting._id ? (
                        <>
                          <button 
                            onClick={() => handleDeleteMeeting(meeting._id, meeting.code)}
                            disabled={deletingId === meeting._id}
                            className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold text-xs transition-all flex items-center justify-center gap-1 disabled:opacity-50 shrink-0"
                          >
                            {deletingId === meeting._id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              "Yes, Delete"
                            )}
                          </button>
                          <button 
                            onClick={() => setConfirmDeleteId(null)}
                            disabled={deletingId === meeting._id}
                            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl font-bold text-xs transition-all shrink-0"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => setConfirmDeleteId(meeting._id)}
                          className="px-4 py-2.5 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-2xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 group/delete shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5 group-hover:scale-110 transition-transform" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                  <button 
                    onClick={() => navigate(`/meeting/${meeting.code}`)}
                    className="w-full md:w-auto px-4 py-2.5 md:px-6 md:py-3 bg-slate-800 hover:bg-blue-600 text-white rounded-2xl font-bold text-xs md:text-sm transition-all flex items-center justify-center gap-2 group/btn"
                  >
                    <ExternalLink className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    {t.rejoin}
                    <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4 group-hover/btn:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="p-10 md:p-20 text-center bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-[2rem] md:rounded-[3rem]">
            <div className="w-16 h-16 md:w-20 md:h-20 bg-slate-800/50 rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 text-slate-600 shrink-0">
              <HistoryIcon className="w-8 h-8 md:w-10 md:h-10" />
            </div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">{t.noSessionsFound}</h3>
            <p className="text-sm md:text-base text-slate-500 max-w-xs mx-auto">{t.noSessionsDesc}</p>
          </div>
        )}
      </div>
      <div className="py-12 mt-8 flex flex-col items-center gap-2 opacity-30 select-none">
        <div className="w-12 h-[1px] bg-white/10" />
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Developed by Mayank Sharma</p>
      </div>
    </div>
  );
};
