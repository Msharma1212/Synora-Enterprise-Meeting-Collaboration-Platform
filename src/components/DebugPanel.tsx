import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Terminal, X, RefreshCw, Layers, Shield, Wifi, Server, Key, Copy, Check } from 'lucide-react';
import api from '../services/api';

interface DebugPanelProps {
  socketStatus: 'Connecting...' | 'Connected' | 'Disconnected';
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ socketStatus }) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [apiHealth, setApiHealth] = useState({
    server: 'unknown',
    database: 'unknown',
    success: false
  });

  const isDev = import.meta.env.DEV || process.env.NODE_ENV !== 'production';

  const checkHealth = async () => {
    setChecking(true);
    try {
      const { data } = await api.get('/health');
      setApiHealth({
        server: data.server || 'online',
        database: data.database || 'connected',
        success: data.success || true
      });
    } catch (err) {
      setApiHealth({
        server: 'offline',
        database: 'disconnected',
        success: false
      });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (isDev) {
      checkHealth();
      const interval = setInterval(checkHealth, 15000); // Poll health states every 15s in background
      return () => clearInterval(interval);
    }
  }, [isDev]);

  if (!isDev) return null; // Render absolutely nothing in production mode

  // Helper to decode JWT token
  const getJwtDetails = () => {
    if (!user || !user.token) return { status: 'Missing', exp: 'N/A' };
    try {
      const base64Url = user.token.split('.')[1];
      if (!base64Url) return { status: 'Malformed Token', exp: 'N/A' };
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(window.atob(base64));
      
      const expTimestamp = payload.exp * 1000;
      const isExpired = Date.now() > expTimestamp;
      const expiryDate = new Date(expTimestamp).toLocaleTimeString();
      
      return {
        status: isExpired ? 'Expired' : 'Valid & Active',
        exp: expiryDate,
        raw: payload
      };
    } catch {
      return { status: 'Decode Error', exp: 'N/A' };
    }
  };

  const jwtInfo = getJwtDetails();

  const handleCopyToken = () => {
    if (!user?.token) return;
    navigator.clipboard.writeText(user.token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRoleHierarchyLabel = (role?: string) => {
    switch (role?.toLowerCase()) {
      case 'developer': return 'Developer (100)';
      case 'admin':
      case 'host':
      case 'co-admin': return 'Host/Admin (80)';
      case 'moderator': return 'Moderator (60)';
      case 'audience':
      case 'user': return 'Audience/User (20)';
      default: return 'Audience/User (20)';
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-[999] p-3.5 bg-slate-900 border border-slate-800 rounded-full text-blue-400 hover:text-white shadow-2xl hover:bg-slate-800/80 transition-all cursor-pointer backdrop-blur-md group"
        title="Open Developer Debug Console"
      >
        <Terminal className="w-5 h-5 group-hover:scale-110 transition-transform" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
      </button>

      {/* Slide-out Terminal Panel */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-96 max-w-full z-[999] bg-slate-950/95 border border-slate-800/95 rounded-3xl overflow-hidden shadow-2xl backdrop-blur-2xl text-slate-300 font-sans shadow-blue-500/5 animate-[fadeIn_0.15s_ease-out]">
          
          {/* Header */}
          <div className="bg-slate-900/60 border-b border-slate-800 px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-black uppercase tracking-widest text-slate-100 font-mono">Dev Debug Console</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={checkHealth}
                disabled={checking}
                className="p-1 px-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                title="Refresh Statuses"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-5 space-y-4 max-h-[450px] overflow-y-auto font-mono text-[11px] leading-relaxed">
            
            {/* 1. User & Role Profile */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <Shield className="w-3 h-3 text-slate-500" /> Account Profile
              </span>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400">User:</span>
                <span className="text-slate-200 font-bold">{user?.name || 'Explorer'}</span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400">UID:</span>
                <span className="text-slate-300 select-all truncate max-w-[180px]">{user?._id || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Hierarchy level:</span>
                <span className="text-orange-400 font-black">{getRoleHierarchyLabel(user?.role)}</span>
              </div>
            </div>

            {/* 2. Socket.IO Gateway */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <Wifi className="w-3 h-3 text-slate-500" /> Socket Gateway
              </span>
              <div className="flex justify-between">
                <span className="text-slate-400">Socket Status:</span>
                <span className={`font-black ${
                  socketStatus === 'Connected' ? 'text-emerald-400' :
                  socketStatus === 'Connecting...' ? 'text-amber-400' : 'text-red-400'
                }`}>
                  {socketStatus}
                </span>
              </div>
            </div>

            {/* 3. API & Database Health Check */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <Server className="w-3 h-3 text-slate-500" /> Host Services
              </span>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400">API health:</span>
                <span className={`font-black uppercase ${apiHealth.server === 'online' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {apiHealth.server}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MongoDB state:</span>
                <span className={`font-black uppercase ${apiHealth.database === 'connected' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {apiHealth.database}
                </span>
              </div>
            </div>

            {/* 4. Auth JWT State */}
            <div className="bg-slate-900/40 border border-slate-800/60 rounded-2xl p-3.5 space-y-2">
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-1.5 mb-1">
                <Key className="w-3 h-3 text-slate-500" /> Secure Token (JWT)
              </span>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400">Token Status:</span>
                <span className={`font-black ${jwtInfo.status.includes('Valid') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {jwtInfo.status}
                </span>
              </div>
              <div className="flex justify-between border-b border-white/5 pb-1.5">
                <span className="text-slate-400">Decoded expire:</span>
                <span className="text-slate-300 font-bold">{jwtInfo.exp}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-slate-400">Bearer payload:</span>
                <button
                  type="button"
                  onClick={handleCopyToken}
                  disabled={!user?.token}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700/80 rounded border border-white/5 text-[9px] text-slate-300 hover:text-white transition-all cursor-pointer disabled:opacity-50"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}
    </>
  );
};
