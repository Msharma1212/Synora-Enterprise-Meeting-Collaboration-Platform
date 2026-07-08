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
import MediaTester from '../components/MediaTester';
import { DEFAULT_MEDIA_SETTINGS, AdvancedAudioSettings } from '../lib/mediaService';

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

  // Advanced Media Settings State (linked with localStorage)
  const [mediaSettings, setMediaSettings] = useState<AdvancedAudioSettings>(() => {
    const saved = localStorage.getItem('synora_media_settings');
    if (saved) {
      try {
        return { ...DEFAULT_MEDIA_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_MEDIA_SETTINGS;
      }
    }
    return DEFAULT_MEDIA_SETTINGS;
  });

  const updateMediaSetting = (key: keyof AdvancedAudioSettings, value: any) => {
    const updated = { ...mediaSettings, [key]: value };
    setMediaSettings(updated);
    localStorage.setItem('synora_media_settings', JSON.stringify(updated));
  };

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

  const languages = ['English (US)', 'Hindi (India)', 'Spanish (ES)', 'French (FR)', 'Arabic (AR)', 'বাংলা'];

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
          
          <div className="border-t border-slate-800/60 pt-8 mt-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
              <h4 className="text-sm font-black text-slate-300 uppercase tracking-widest">Advanced Media Tuning</h4>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Audio Preferences */}
              <div className="space-y-6">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Audio Processing Pipeline
                </h5>
                
                {/* Mic Boost Slider */}
                <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-400">Microphone Boost</span>
                    <span className="text-emerald-400">{(mediaSettings.micBoost ?? 1.0).toFixed(1)}x</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.5" 
                    max="2.5" 
                    step="0.1"
                    value={mediaSettings.micBoost ?? 1.0}
                    onChange={(e) => updateMediaSetting('micBoost', parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-none mt-1">Boosts low gain microphone devices mechanically</p>
                </div>

                {/* Input Volume Slider */}
                <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-400">Input Capture Volume</span>
                    <span className="text-blue-400">{Math.round((mediaSettings.inputVolume ?? 1.0) * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0.0" 
                    max="1.0" 
                    step="0.05"
                    value={mediaSettings.inputVolume ?? 1.0}
                    onChange={(e) => updateMediaSetting('inputVolume', parseFloat(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-none mt-1">Adjusts target volume of Web Audio capture node</p>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { key: 'echoCancellation', label: 'Echo Cancel', desc: 'Prevent speaker feedback' },
                    { key: 'noiseSuppression', label: 'Noise Suppress', desc: 'Filter room background noise' },
                    { key: 'autoGainControl', label: 'Auto Gain', desc: 'Automatically level voice' },
                    { key: 'voiceIsolation', label: 'Voice Isolation', desc: 'Isolate vocal frequencies' },
                    { key: 'hdAudio', label: 'HD Audio (48kHz)', desc: 'Pristine high-fidelity sampling' },
                    { key: 'stereoAudio', label: 'Stereo Audio', desc: 'Dual-channel microphone' },
                    { key: 'originalSound', label: 'Original Sound', desc: 'Pass raw, unfiltered audio' },
                    { key: 'musicMode', label: 'Music Mode', desc: 'High bandwidth full-band audio' },
                    { key: 'lowLatency', label: 'Low Latency', desc: 'Interactive audio buffers' },
                    { key: 'audioEnhancement', label: 'Enhance Audio', desc: 'Dynamic frequency tuning' },
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => updateMediaSetting(item.key as any, !mediaSettings[item.key as keyof AdvancedAudioSettings])}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-95 flex flex-col justify-between gap-1",
                        mediaSettings[item.key as keyof AdvancedAudioSettings]
                          ? "bg-blue-600/10 border-blue-500/40 text-blue-400"
                          : "bg-slate-950/40 border-slate-800/60 text-slate-500 hover:bg-slate-800/30"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider block">{item.label}</span>
                      <span className="text-[8px] opacity-65 leading-tight block">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Video & Stream Settings */}
              <div className="space-y-6">
                <h5 className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Video & Stream Quality
                </h5>

                {/* Resolution */}
                <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                  <label className="text-xs text-slate-400 block font-bold mb-1">Target Video Resolution</label>
                  <select 
                    value={mediaSettings.resolution ?? '720p'}
                    onChange={(e) => updateMediaSetting('resolution', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer"
                  >
                    <option value="360p">360p (Standard definition / lowest bandwidth)</option>
                    <option value="720p">720p (High definition / recommended standard)</option>
                    <option value="1080p">1080p (Full High definition / high bandwidth)</option>
                  </select>
                </div>

                {/* Frame Rate */}
                <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                  <label className="text-xs text-slate-400 block font-bold mb-1">Frame Rate Limit</label>
                  <select 
                    value={mediaSettings.frameRate ?? 30}
                    onChange={(e) => updateMediaSetting('frameRate', parseInt(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium cursor-pointer"
                  >
                    <option value="15">15 FPS (Slideshow quality / low bandwidth)</option>
                    <option value="30">30 FPS (Standard standard motion video)</option>
                    <option value="60">60 FPS (Ultra-smooth / high bandwidth)</option>
                  </select>
                </div>

                {/* Bitrate slider */}
                <div className="space-y-2 bg-slate-950/40 p-4 rounded-2xl border border-slate-800/50">
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-400">Max WebRTC Video Bitrate</span>
                    <span className="text-indigo-400">{mediaSettings.bitrate ?? 2000} kbps</span>
                  </div>
                  <input 
                    type="range" 
                    min="500" 
                    max="4000" 
                    step="100"
                    value={mediaSettings.bitrate ?? 2000}
                    onChange={(e) => updateMediaSetting('bitrate', parseInt(e.target.value))}
                    className="w-full accent-blue-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                  />
                  <p className="text-[9px] text-slate-500 leading-none mt-1">Caps dynamic WebRTC video streaming bandwidth</p>
                </div>

                {/* Toggles */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {[
                    { key: 'mirrorCamera', label: 'Mirror Camera', desc: 'Mirror local webcam visual preview' },
                    { key: 'backgroundBlur', label: 'Background Blur', desc: 'Enable dynamic visual background blurring' }
                  ].map((item) => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => updateMediaSetting(item.key as any, !mediaSettings[item.key as keyof AdvancedAudioSettings])}
                      className={cn(
                        "p-3.5 rounded-2xl border text-left transition-all hover:scale-[1.01] active:scale-95 flex flex-col justify-between gap-1",
                        mediaSettings[item.key as keyof AdvancedAudioSettings]
                          ? "bg-blue-600/10 border-blue-500/40 text-blue-400"
                          : "bg-slate-950/40 border-slate-800/60 text-slate-500 hover:bg-slate-800/30"
                      )}
                    >
                      <span className="text-[10px] font-black uppercase tracking-wider block">{item.label}</span>
                      <span className="text-[8px] opacity-65 leading-tight block">{item.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
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


