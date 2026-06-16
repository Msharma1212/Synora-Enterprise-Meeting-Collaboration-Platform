import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Shield, 
  Bell, 
  User, 
  Monitor, 
  Globe, 
  Save, 
  Loader2, 
  Check, 
  Volume2, 
  Mic, 
  ChevronDown,
  Gift,
  Tag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';
import { useTranslation } from '../hooks/useTranslation';

export const SettingsPage = () => {
  const { user, login } = useAuth();
  const { t, language: currentLanguage } = useTranslation();
  
  // Profile State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [password, setPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Referral State
  const [profileReferralCode, setProfileReferralCode] = useState(user?.referralCode || '');
  const [enterReferral, setEnterReferral] = useState('');
  const [isUpdatingReferrals, setIsUpdatingReferrals] = useState(false);

  // Notifications State
  const [reminders, setReminders] = useState(user?.settings?.notifications?.reminders ?? true);
  const [emailNotifs, setEmailNotifs] = useState(user?.settings?.notifications?.emailNotifs ?? false);

  // System State
  const [language, setLanguage] = useState(user?.settings?.language || 'English (US)');
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(user?.settings?.voiceEnabled ?? true);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setLanguage(user.settings?.language || 'English (US)');
      setReminders(user.settings?.notifications?.reminders ?? true);
      setEmailNotifs(user.settings?.notifications?.emailNotifs ?? false);
      setVoiceEnabled(user.settings?.voiceEnabled ?? true);
      setProfileReferralCode(user.referralCode || '');
    }
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return toast.error('Name and email are required');
    
    setIsUpdating(true);
    try {
      const payload: any = { 
        name, 
        email, 
        settings: {
          language,
          notifications: { reminders, emailNotifs }
        }
      };
      if (password) payload.password = password;
      
      const { data } = await api.put('/auth/profile', payload);
      login(data);
      setPassword('');
      toast.success(t.settingsUpdated || 'Settings updated successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update settings');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateReferrals = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingReferrals(true);
    try {
      const payload: any = {};
      if (profileReferralCode && profileReferralCode !== user?.referralCode) {
        payload.referralCode = profileReferralCode.trim().toUpperCase();
      }
      if (enterReferral) {
        payload.enterReferralCode = enterReferral.trim().toUpperCase();
      }

      if (Object.keys(payload).length === 0) {
        toast.error('No referral modifications made.');
        setIsUpdatingReferrals(false);
        return;
      }

      const { data } = await api.put('/auth/profile', payload);
      login(data);
      setEnterReferral('');
      toast.success('Referral settings updated successfully!');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update referral details');
    } finally {
      setIsUpdatingReferrals(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    try {
      const newSettings = {
        language,
        notifications: { reminders, emailNotifs },
        voiceEnabled,
        ...((key === 'language') ? { language: value } : {}),
        ...((key === 'reminders') ? { notifications: { reminders: value, emailNotifs } } : {}),
        ...((key === 'emailNotifs') ? { notifications: { reminders, emailNotifs: value } } : {}),
        ...((key === 'voiceEnabled') ? { voiceEnabled: value } : {})
      };

      const { data } = await api.put('/auth/profile', { settings: newSettings });
      login(data);
    } catch (error) {
      console.error('Failed to sync setting:', error);
    }
  };

  const languages = ['English (US)', 'Hindi (India)', 'Spanish (ES)', 'French (FR)', 'Arabic (AR)'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Audio & Video Section */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6 md:col-span-2">
          <div className="flex items-center gap-4 mb-2">
             <div className="p-3 bg-blue-600/10 rounded-2xl">
              <Mic className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Audio & Video Settings</h3>
          </div>
          <MediaTester />
        </div>

        {/* Profile Section */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-600/10 rounded-2xl">
              <User className="w-6 h-6 text-blue-500" />
            </div>
            <h3 className="text-xl font-bold text-white">{t.profile}</h3>
          </div>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{t.displayName}</label>
              <input 
                type="text" 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{t.emailAddress}</label>
              <input 
                type="email" 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">{t.newPassword}</label>
              <input 
                type="password" 
                placeholder={t.placeholderPassword}
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-500" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button 
              type="submit" 
              disabled={isUpdating}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-2xl font-bold transition-all"
            >
              {isUpdating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isUpdating ? t.saving : t.saveChanges}
            </button>
          </form>
        </div>

        {/* Referrals & Invites Section */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-600/10 rounded-2xl">
              <Gift className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-white">Referrals & Audience</h3>
          </div>
          <form onSubmit={handleUpdateReferrals} className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Your Referral Code</label>
                <span className="text-[9px] text-[#10b981] font-bold uppercase tracking-tight bg-[#10b981]/15 px-2 py-0.5 rounded border border-[#10b981]/15">Share with others</span>
              </div>
              <input 
                type="text" 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono uppercase tracking-wider" 
                value={profileReferralCode} 
                onChange={(e) => setProfileReferralCode(e.target.value)}
                placeholder="E.G. MAYANK123"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Enter Sponsor / Referral Code</label>
                {user?.referredBy && (
                  <span className="text-[9px] text-purple-400 font-bold uppercase tracking-tight bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/10">Code Applied</span>
                )}
              </div>
              <input 
                type="text" 
                className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono uppercase tracking-wider placeholder:text-slate-600" 
                value={enterReferral} 
                onChange={(e) => setEnterReferral(e.target.value)}
                placeholder={user?.referredBy ? "Change existing host's code..." : "e.g. MAYANK123"}
              />
            </div>

            <button 
              type="submit" 
              disabled={isUpdatingReferrals}
              className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-800 text-white rounded-2xl font-bold transition-all shadow-lg shadow-purple-600/10"
            >
              {isUpdatingReferrals ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {isUpdatingReferrals ? "Updating..." : "Update Referrals"}
            </button>
          </form>
        </div>

        {/* Security Section */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-emerald-600/10 rounded-2xl">
              <Shield className="w-6 h-6 text-emerald-500" />
            </div>
            <h3 className="text-xl font-bold text-white">{t.security}</h3>
          </div>
          <div className="space-y-4">
            <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800/50">
              <p className="text-sm text-slate-400 mb-4">{t.secureContent}</p>
              <div className="flex items-center gap-2 text-xs font-bold text-emerald-500 uppercase">
                <Check className="w-4 h-4" />
                {t.accountSecure}
              </div>
            </div>

            {/* Login History Session Tracker Display */}
            <div className="pt-4 border-t border-slate-800/50 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Recent Logins</span>
                <span className="text-[8px] text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-500/10 font-mono uppercase font-black">Latest 5 active</span>
              </div>
              
              {(!user?.loginHistory || user.loginHistory.length === 0) ? (
                <div className="p-4 text-center rounded-2xl bg-slate-850/30 text-xs text-slate-500 border border-slate-800/30 italic">
                  No registered active login sessions recorded.
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {[...user.loginHistory].reverse().slice(0, 5).map((log: any, idx: number) => (
                    <div 
                      key={idx} 
                      className="group flex justify-between items-center p-3 px-4 bg-slate-800/20 hover:bg-slate-800/50 rounded-2xl transition-all border border-slate-800/30 hover:border-emerald-500/20"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-slate-800/40 border border-white/5 group-hover:bg-slate-800">
                          <Monitor className="w-3.5 h-3.5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-200 group-hover:text-white transition-colors">
                            {log.device || 'Web Browser'}
                          </span>
                          <span className="text-[10px] text-slate-550 font-mono">
                            IP: {log.ip || '127.0.0.1'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 font-mono">
                          {new Date(log.timestamp || log.date || Date.now()).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric'
                          })}
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono block">
                          {new Date(log.timestamp || log.date || Date.now()).toLocaleTimeString(undefined, {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Notifications Section */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-purple-600/10 rounded-2xl">
              <Bell className="w-6 h-6 text-purple-500" />
            </div>
            <h3 className="text-xl font-bold text-white">{t.notifications}</h3>
          </div>
          <div className="space-y-6 text-sm font-medium text-slate-400">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white font-bold">{t.meetingReminders}</p>
                <p className="text-xs text-slate-500">{t.getNotified}</p>
              </div>
              <button 
                onClick={() => {
                  setReminders(!reminders);
                  updateSetting('reminders', !reminders);
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  reminders ? "bg-blue-600" : "bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                  reminders ? "right-1" : "left-1"
                )} />
              </button>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800/50 pt-6">
              <div>
                <p className="text-white font-bold">{t.emailNotifications}</p>
                <p className="text-xs text-slate-500">{t.weeklySummaries}</p>
              </div>
              <button 
                onClick={() => {
                  setEmailNotifs(!emailNotifs);
                  updateSetting('emailNotifs', !emailNotifs);
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  emailNotifs ? "bg-blue-600" : "bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                  emailNotifs ? "right-1" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>

        {/* System Section */}
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-[2.5rem] space-y-6">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-orange-600/10 rounded-2xl">
              <Globe className="w-6 h-6 text-orange-500" />
            </div>
            <h3 className="text-xl font-bold text-white">{t.system}</h3>
          </div>
          <div className="space-y-4 text-sm font-medium">
             <div className="relative">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 block mb-2">{t.appLanguage}</label>
              <button 
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 rounded-2xl border border-slate-700 transition-all text-white font-bold"
              >
                <span>{language}</span>
                <Globe className="w-4 h-4 text-slate-500" />
              </button>
              
              {isLangOpen && (
                <div className="absolute top-full left-0 w-full mt-2 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl z-10 overflow-hidden">
                  {languages.map(lang => (
                    <button 
                      key={lang}
                      onClick={() => {
                        setLanguage(lang);
                        setIsLangOpen(false);
                        updateSetting('language', lang);
                        toast.success(`${t.appLanguage}: ${lang}`);
                      }}
                      className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    >
                      <span>{lang}</span>
                      {language === lang && <Check className="w-4 h-4 text-blue-500" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-slate-800/50 pt-4 mt-2">
              <div>
                <p className="text-white font-bold flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-slate-400" />
                  Voice Greeting
                </p>
                <p className="text-xs text-slate-500">Enable voice greeting upon login & registration</p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  const newVal = !voiceEnabled;
                  setVoiceEnabled(newVal);
                  updateSetting('voiceEnabled', newVal);
                }}
                className={cn(
                  "w-12 h-6 rounded-full transition-colors relative px-0",
                  voiceEnabled ? "bg-blue-600" : "bg-slate-800"
                )}
              >
                <div className={cn(
                  "w-4 h-4 bg-white rounded-full absolute top-1 transition-all",
                  voiceEnabled ? "right-1" : "left-1"
                )} />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="py-12 mt-8 flex flex-col items-center gap-2 opacity-30 select-none">
        <div className="w-12 h-[1px] bg-white/10" />
        <p className="text-[10px) font-black text-slate-500 uppercase tracking-[0.3em]">Developed by Mayank Sharma</p>
      </div>
    </div>
  );
};

export const MediaTester = () => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMic, setSelectedMic] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [selectedCamera, setSelectedCamera] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const getDevices = async () => {
      try {
        // Small pause to let browser update permission state
        await new Promise(r => setTimeout(r, 100));
        let dev = await navigator.mediaDevices.enumerateDevices();
        const hasLabels = dev.some(d => !!d.label);

        if (!hasLabels) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            stream.getTracks().forEach(t => t.stop());
            dev = await navigator.mediaDevices.enumerateDevices();
          } catch (e) {
            console.warn("Permission denied for hardware listing", e);
          }
        }

        setDevices(dev);
        // Auto-select if nothing selected yet
        if (dev.length > 0) {
          const mic = dev.find(d => d.kind === 'audioinput' && d.deviceId !== 'default');
          const spk = dev.find(d => d.kind === 'audiooutput' && d.deviceId !== 'default');
          const cam = dev.find(d => d.kind === 'videoinput' && d.deviceId !== 'default');
          if (mic && !selectedMic) setSelectedMic(mic.deviceId);
          if (spk && !selectedSpeaker) setSelectedSpeaker(spk.deviceId);
          if (cam && !selectedCamera) setSelectedCamera(cam.deviceId);
        }
      } catch (err) {
        console.error("Failed to get devices", err);
      }
    };

    getDevices();
    
    // Listen for device changes
    navigator.mediaDevices.ondevicechange = getDevices;

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach((t: any) => t.stop());
      navigator.mediaDevices.ondevicechange = null;
    };
  }, []);

  useEffect(() => {
    const startMedia = async () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (animationRef.current) cancelAnimationFrame(animationRef.current);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: { deviceId: selectedMic ? { exact: selectedMic } : undefined },
          video: { deviceId: selectedCamera ? { exact: selectedCamera } : undefined }
        });
        streamRef.current = stream;
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }

        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const updateLevel = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          setAudioLevel(average);
          animationRef.current = requestAnimationFrame(updateLevel);
        };
        updateLevel();
      } catch (err) {
        console.error("Media access denied", err);
      }
    };
    
    if (selectedMic || selectedCamera) {
      startMedia();
    }
  }, [selectedMic, selectedCamera]);

  const mics = devices.filter(d => d.kind === 'audioinput');
  const speakers = devices.filter(d => d.kind === 'audiooutput');
  const cameras = devices.filter(d => d.kind === 'videoinput');

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="space-y-6">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Microphone</label>
          <div className="relative group">
            <select 
              value={selectedMic} 
              onChange={(e) => setSelectedMic(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium pr-10"
            >
              {mics.map(m => (
                <option key={m.deviceId} value={m.deviceId}>{m.label || `Microphone ${m.deviceId.slice(0, 4)}`}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-blue-500 pointer-events-none transition-colors" />
          </div>
          
          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Input Level</span>
              <Mic className={cn("w-3.5 h-3.5", audioLevel > 10 ? "text-blue-500 animate-pulse" : "text-slate-600")} />
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700/50 p-0.5">
              <div 
                className={cn(
                  "h-full rounded-full transition-all duration-75",
                  audioLevel > 50 ? "bg-orange-500" : "bg-blue-600"
                )}
                style={{ width: `${Math.min(100, (audioLevel / 128) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Speaker</label>
          <div className="relative group">
            <select 
              value={selectedSpeaker} 
              onChange={(e) => setSelectedSpeaker(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium pr-10"
            >
              {speakers.map(s => (
                <option key={s.deviceId} value={s.deviceId}>{s.label || `Speaker ${s.deviceId.slice(0, 4)}`}</option>
              ))}
              {speakers.length === 0 && <option value="">System Default</option>}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-blue-500 pointer-events-none transition-colors" />
          </div>
          <button 
            onClick={() => {
              const audio = new Audio('https://www.soundjay.com/buttons/beep-01a.mp3');
              audio.volume = 1.0;
              if ((audio as any).setSinkId && selectedSpeaker) {
                (audio as any).setSinkId(selectedSpeaker).catch((err: any) => console.error("setSinkId error", err));
              }
              audio.play().catch(err => {
                console.error("Audio playback error", err);
                toast.error("Click anywhere on page first to enable sound");
              });
              toast.success("Playing test sound...");
            }}
            className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all active:scale-95 group border border-slate-700/50"
          >
            <Volume2 className="w-4 h-4 group-hover:text-blue-500" />
            Test Speakers
          </button>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Camera</label>
          <div className="relative group">
            <select 
              value={selectedCamera} 
              onChange={(e) => setSelectedCamera(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-3 text-white appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium pr-10"
            >
              {cameras.map(c => (
                <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 4)}`}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-blue-500 pointer-events-none transition-colors" />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Video Preview</label>
        <div className="aspect-video bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden relative group">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-xl border border-white/10">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-[10px] font-bold text-white uppercase tracking-widest">Live Preview</span>
          </div>
        </div>
      </div>
    </div>
  );
};
