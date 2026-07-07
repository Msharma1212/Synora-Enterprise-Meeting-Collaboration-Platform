import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Trash,
  Sparkles,
  Inbox,
  Volume2,
  VolumeX,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';

interface NotificationItem {
  _id: string;
  category: 'Meetings' | 'Announcements' | 'Rewards' | 'System' | 'Messages';
  icon: string;
  title: string;
  description: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export const NotificationCenter: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    return localStorage.getItem('synora_notif_sound') !== 'false';
  });
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [isNewArrival, setIsNewArrival] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);

  // Play subtle ping sound on new notifications
  const playPing = () => {
    if (!soundEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5 note
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1); // A5 note

      gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch (e) {
      // Ignored if browser policy blocks instant play
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      if (data && data.success) {
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Setup Socket.io real-time listener
    const socket = io();

    socket.on('new-notification', (notif: NotificationItem) => {
      setNotifications(prev => [notif, ...prev]);
      setIsNewArrival(true);
      playPing();
      
      // Temporary animation trigger reset
      setTimeout(() => setIsNewArrival(false), 1200);
      
      toast.custom((t_toast) => (
        <div className="flex bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow-2xl max-w-sm gap-3 items-start animate-in slide-in-from-top-4">
          <div className="text-2xl mt-0.5">{notif.icon}</div>
          <div className="flex-1 text-left font-sans">
            <p className="font-bold text-white text-sm">{notif.title}</p>
            <p className="text-slate-400 text-xs mt-0.5">{notif.description}</p>
          </div>
          <button onClick={() => toast.dismiss(t_toast.id)} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      ), { duration: 6000, position: 'top-right' });
    });

    socket.on('new-notification-broadcast', () => {
      // Re-fetch notifications safely
      fetchNotifications();
      setIsNewArrival(true);
      playPing();
      setTimeout(() => setIsNewArrival(false), 1200);
    });

    // Close dropdown on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        bellRef.current && !bellRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      socket.disconnect();
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [soundEnabled]);

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    localStorage.setItem('synora_notif_sound', String(newVal));
  };

  // Actions
  const markAsRead = async (id: string) => {
    try {
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      await api.patch(`/notifications/${id}/read`);
    } catch (err) {
      console.error(err);
    }
  };

  const markAllRead = async () => {
    try {
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast.success(t.allNotificationsMarkedRead || 'All marked as read');
      await api.post('/notifications/read-all');
    } catch (err) {
      console.error(err);
    }
  };

  const deleteOne = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success(t.notificationCleared || 'Notification deleted');
      await api.delete(`/notifications/${id}`);
    } catch (err) {
      console.error(err);
    }
  };

  const clearAll = async () => {
    try {
      setNotifications([]);
      setConfirmClearOpen(false);
      toast.success(t.notificationsClearedSuccess || 'Notifications cleared successfully');
      await api.delete('/notifications');
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markAsRead(notif._id);
    }
    setIsOpen(false);
    if (notif.link) {
      navigate(notif.link);
    }
  };

  // Counting logic
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Formatting date distance elegantly
  const formatTimeAgo = (dateStr: string) => {
    if (!dateStr) return t.justNow || 'Just now';
    try {
      const created = new Date(dateStr);
      const diffMs = Date.now() - created.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return t.justNow || 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch (e) {
      return t.justNow || 'Just now';
    }
  };

  // Filtering
  const filteredNotifications = notifications.filter(n => {
    if (activeCategory === 'All') return true;
    return n.category === activeCategory;
  });

  const categories = ['All', 'Meetings', 'Announcements', 'Rewards', 'System', 'Messages'];

  return (
    <div className="relative inline-block">
      {/* Bell Button */}
      <button
        id="notification-bell-btn"
        ref={bellRef}
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl border border-slate-800 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/50 group shrink-0"
      >
        <motion.div
          animate={isNewArrival ? {
            rotate: [0, -18, 18, -18, 18, -8, 8, 0],
            scale: [1, 1.2, 1.2, 1.1, 1.1, 1, 1]
          } : {}}
          transition={{ duration: 0.85 }}
        >
          <Bell className="w-5 h-5 group-hover:scale-105 transition-transform" />
        </motion.div>

        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 bg-red-500 border-2 border-slate-950 rounded-full flex items-center justify-center text-[10px] uppercase tracking-tighter text-white font-black animate-in zoom-in-50 duration-300">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Modern Notification Center Modal Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dark background overlay only on mobile to lock focus and style sidebar */}
            <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-[100] md:hidden" onClick={() => setIsOpen(false)} />

            <motion.div
              ref={panelRef}
              id="notification-center-panel"
              // Desktop: dropdown below bell | Mobile: slide-in from right
              initial={{ 
                opacity: 0,
                y: window.innerWidth < 768 ? 0 : 15,
                x: window.innerWidth < 768 ? 320 : 0,
                scale: window.innerWidth < 768 ? 1 : 0.95
              }}
              animate={{ 
                opacity: 1, 
                y: 0,
                x: 0,
                scale: 1
              }}
              exit={{ 
                opacity: 0, 
                y: window.innerWidth < 768 ? 0 : 12,
                x: window.innerWidth < 768 ? 320 : 0,
                scale: window.innerWidth < 768 ? 1 : 0.95
              }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
              className={`
                fixed top-0 right-0 h-full w-[310px] sm:w-[380px] bg-slate-950/95 backdrop-blur-2xl border-l border-slate-800 shadow-2xl z-[110] p-6 flex flex-col
                md:absolute md:top-full md:right-0 md:h-[530px] md:w-[410px] md:bg-slate-900/90 md:border md:border-slate-800 md:rounded-[2rem] md:mt-2 md:shadow-blue-950/15
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-800/60 pb-4 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-blue-600/10 rounded-xl">
                    <Sparkles className="w-4 h-4 text-blue-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">{t.notificationCenter || 'Notification Center'}</h2>
                    {unreadCount > 0 && (
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                        {unreadCount} {t.pending || 'Pending'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Sound Switch */}
                  <button
                    onClick={toggleSound}
                    title={soundEnabled ? 'Mute' : 'Unmute'}
                    className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4 text-red-500" />}
                  </button>

                  {/* Mark All as Read */}
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors"
                      title={t.markAllAsRead || 'Mark all as read'}
                    >
                      <CheckCheck className="w-4 h-4" />
                    </button>
                  )}

                  {/* Close on mobile / Desktop toggle */}
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-1.5 hover:bg-slate-800/80 rounded-lg text-slate-400 hover:text-white transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Categories Navigation Slider */}
              <div className="flex gap-1 overflow-x-auto py-3 shrink-0 scrollbar-none border-b border-slate-800/30">
                {categories.map(cat => {
                  const labelKey = cat === 'All' ? 'allNotifications' : `${cat.toLowerCase()}Category`;
                  const label = t[labelKey] || cat;
                  const countInCat = notifications.filter(n => (cat === 'All' || n.category === cat) && !n.isRead).length;

                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      className={`
                        relative px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider shrink-0 transition-all duration-200
                        ${activeCategory === cat 
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/35' 
                          : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/50'}
                      `}
                    >
                      <span>{label}</span>
                      {countInCat > 0 && (
                        <span className="ml-1 px-1 bg-red-500 rounded-full text-[9px] text-white">
                          {countInCat}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Notification Item Collection */}
              <div className="flex-1 overflow-y-auto py-4 space-y-2.5 font-sans min-h-0 relative">
                <AnimatePresence initial={false}>
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map(notif => (
                      <motion.div
                        key={notif._id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        className={`
                          group border rounded-2xl p-4 flex gap-3 cursor-pointer relative items-start transition-all duration-300 select-none
                          ${notif.isRead 
                            ? 'bg-slate-900/30 border-slate-800/65 opacity-70 hover:opacity-100 hover:bg-slate-900/50' 
                            : 'bg-gradient-to-br from-slate-900/80 to-slate-900/90 border-slate-800 hover:border-slate-700 shadow-lg shadow-slate-950/10'}
                        `}
                        onClick={() => handleNotificationClick(notif)}
                      >
                        {/* Status Unread Dot Indicator */}
                        {!notif.isRead && (
                          <span className="absolute left-2.5 top-2.5 w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-sm shadow-blue-500" />
                        )}

                        {/* Category Emoji Indicator Icon */}
                        <div className="text-xl shrink-0 mt-0.5 select-none">{notif.icon}</div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-white text-xs sm:text-sm tracking-tight leading-tight group-hover:text-blue-400 transition-colors">
                            {notif.title}
                          </p>
                          <p className="text-xs text-slate-400 mt-1 leading-snug">
                            {notif.description}
                          </p>
                          <span className="text-[10px] font-bold text-slate-500 tracking-wide uppercase block mt-2">
                            {formatTimeAgo(notif.createdAt)}
                          </span>
                        </div>

                        {/* Hover Clear/Delete Control Button Contextual */}
                        <div className="flex gap-1 shrink-0 self-start md:opacity-0 group-hover:opacity-100 transition-all duration-300">
                          {!notif.isRead && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notif._id);
                              }}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                              title="Mark as read"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => deleteOne(e, notif._id)}
                            className="p-1.5 bg-slate-800/80 hover:bg-red-500/10 hover:text-red-500 text-slate-400 rounded-lg transition-colors"
                            title={t.deleteNotification || "Delete"}
                          >
                            <Trash className="w-3 h-3" />
                          </button>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    /* Elegant illustration of empty notification panel */
                    <div className="flex flex-col items-center justify-center h-full text-center py-10 px-6 animate-in fade-in duration-500 select-none">
                      <div className="relative mb-4">
                        <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-500 ring-4 ring-slate-950">
                          <Inbox className="w-6 h-6 text-slate-500" />
                        </div>
                        <span className="absolute bottom-0 right-0 w-4.5 h-4.5 bg-blue-500 rounded-full border-3 border-slate-950 flex items-center justify-center text-[8px] text-white font-bold animate-bounce">
                          ✓
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white">{t.noNotificationsYet || 'No notifications yet'}</p>
                      <p className="text-xs text-slate-500 mt-1.5 max-w-[240px]">
                        We'll alert you with deep-grounded updates when events occur!
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>

              {/* Confirmation Clear All Modal Overlay */}
              <AnimatePresence>
                {confirmClearOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="absolute inset-0 bg-slate-950/95 z-[120] rounded-b-[2rem] p-6 flex flex-col justify-center items-center text-center font-sans border border-slate-800 md:border-none"
                  >
                    <div className="p-3 bg-red-600/10 rounded-2xl mb-4">
                      <Trash2 className="w-6 h-6 text-red-500" />
                    </div>
                    <span className="font-bold text-white text-sm">{t.confirmClearAll || 'Are you sure you want to clear all notifications?'}</span>
                    <p className="text-slate-500 text-xs mt-1.5">This action is irreversible.</p>
                    
                    <div className="flex gap-2.5 mt-6 w-full max-w-[260px]">
                      <button
                        onClick={() => setConfirmClearOpen(false)}
                        className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={clearAll}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all"
                      >
                        Clear All
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bulk Clear Footer */}
              {notifications.length > 0 && (
                <div className="border-t border-slate-800/60 pt-3 flex justify-between items-center shrink-0">
                  <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest leading-none">
                    {filteredNotifications.length} of {notifications.length} logged
                  </span>
                  <button
                    onClick={() => setConfirmClearOpen(true)}
                    className="text-slate-400 hover:text-red-400 text-xs font-bold px-3 py-1.5 hover:bg-red-500/5 hover:border-red-500/10 border border-transparent rounded-lg flex items-center gap-1.5 transition-colors leading-none"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    <span>{t.clearAll || 'Clear All'}</span>
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
