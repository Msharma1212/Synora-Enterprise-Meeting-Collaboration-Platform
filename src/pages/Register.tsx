import React, { useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import api from '../services/api';
import { Video, User, Mail, Lock, Loader2, ArrowRight, Tag, ShieldCheck, Sparkles, Calendar, Plus, Users, CheckCircle2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { PortalTransition } from '../components/PortalTransition';

export const Register = () => {
  const { t, language, setLanguage } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [helperCode, setHelperCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPortal, setShowPortal] = useState(false);
  const [authorizedUser, setAuthorizedUser] = useState<any>(null);
  const [searchParams] = useSearchParams();
  const [hostCommunityName, setHostCommunityName] = useState<string | null>(null);
  const [isVerifyingRef, setIsVerifyingRef] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    const refCode = searchParams.get('ref');
    const helperParam = searchParams.get('helper');
    if (helperParam) {
      setHelperCode(helperParam.trim());
    }
    if (refCode) {
      const trimmed = refCode.trim();
      setReferralCode(trimmed);
      setIsVerifyingRef(true);
      api.get(`/auth/referral-info/${trimmed}`)
        .then(({ data }) => {
          setHostCommunityName(data.name);
          toast.success(`Joining ${data.name}'s Community!`, {
            icon: '👋',
            style: {
              background: '#0B0E14',
              color: '#f97316',
              border: '1px solid rgba(249, 115, 22, 0.2)',
            }
          });
        })
        .catch(() => {
          setHostCommunityName(null);
        })
        .finally(() => {
          setIsVerifyingRef(false);
        });
    }
  }, [searchParams]);

  React.useEffect(() => {
    if (user) {
      const delay = setTimeout(() => {
        navigate('/dashboard');
      }, 800);
      return () => clearTimeout(delay);
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setShake(false);
    try {
      const { data } = await api.post('/auth/register', { 
        name, 
        email, 
        password, 
        referralCode: referralCode.trim(),
        helperCode: helperCode.trim() || undefined
      });
      setIsSuccess(true);
      setAuthorizedUser(data);
      toast.success(t.registerSuccess || "Registration successful!", {
        icon: '🚀',
        style: {
          background: '#0f172a',
          color: '#f97316',
          border: '1px solid rgba(249, 115, 22, 0.2)',
        }
      });
      // Delay to let the micro-animation display fully before moving to portal transition
      setTimeout(() => {
        setShowPortal(true);
      }, 700);
    } catch (error: any) {
      setShake(true);
      // Automatically reset shake state after animation finishes
      setTimeout(() => setShake(false), 500);
      const errorMsg = error.response?.data?.message || t.registrationFailed || 'Registration failed';
      toast.error(errorMsg, {
        icon: '⚠️',
        style: {
          background: '#0f172a',
          color: '#f87171',
          border: '1px solid rgba(248, 113, 113, 0.2)',
        }
      });
    } finally {
      setLoading(false);
    }
  };

  // Safe Fallback locale translations
  const strJoinSynora = t.joinSynora || 'Join Synora';
  const strCreateProfessionalAccount = t.createProfessionalAccount || 'Create your professional account to unlock high-definition collaboration';
  const strDisplayName = t.displayName || 'Display Name';
  const strEmailAddress = t.emailAddress || 'Email Address';
  const strPassword = t.password || 'Password';
  const strCreateAccount = t.createAccount || 'Create Account';
  const strAlreadyHaveAccount = t.alreadyHaveAccount || 'Already have an account?';
  const strSignIn = t.signIn || 'Sign In';

  const strReferralCode = t('referralCode', 'Referral Code');
  const strRole = t('role', 'Role');
  const strAudience = t('audience', 'Audience');
  const strHost = t('host', 'Host');
  const strDeveloper = t('developer', 'Developer');
  const strCancel = t('cancel', 'Cancel');
  const strSave = t('save', 'Save');
  const strCopyLink = t('copyLink', 'Copy Link');
  
  const strConnectMeet = t('connectMeetCollab', 'Connect, Meet & Collab with High Fidelity.');
  const strLiveWebinar = t('liveWebinarSession', 'Live Webinar Session');
  const strSarahConnor = t('sarahConnor', 'Sarah Connor');
  const strRaised = t('raisedHandText', '✋ Hand Raised');
  const strMuted = t('muted', 'MUTED');
  const strAlexSharing = t('alexIsSharing', 'Alex is screen sharing...');
  const strAuthSuccess = t('authorizedSuccessfully', 'Authorized Successfully');
  const strSecureAirspace = t('enteringSecureCollaborativeAirspace', 'Entering secure collaborative airspace...');
  const strEncrypted = t('endToEndEncrypted', 'Full End-to-End Encrypted Tunneling');
  const strDevCredits = t('developerCredits', 'Developed by Mayank Sharma');

  return (
    <>
      <AnimatePresence>
        {showPortal && authorizedUser && (
          <PortalTransition
            key={Date.now().toString()}
            userName={authorizedUser?.user?.name || authorizedUser?.name || 'Explorer'}
            accentColor="orange"
            voiceEnabled={authorizedUser?.settings?.voiceEnabled ?? authorizedUser?.user?.settings?.voiceEnabled ?? true}
            isFirstLogin={true}
            onComplete={() => {
              login(authorizedUser);
            }}
          />
        )}
      </AnimatePresence>
      <div className="min-h-screen bg-[#07090e] text-white flex items-center justify-center p-4 md:p-8 overflow-x-hidden relative font-sans">
      
      {/* Floating Language Switcher */}
      <div className="absolute top-6 right-6 z-50">
        <div className="relative">
          <button 
            type="button"
            onClick={() => setIsLangOpen(!isLangOpen)}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-slate-900/80 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-300 hover:text-white transition-all text-xs font-bold font-mono tracking-wider backdrop-blur-md cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-slate-400" />
            <span>{language}</span>
          </button>
          
          {isLangOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden backdrop-blur-lg">
              {['English (US)', 'Hindi (India)', 'Spanish (ES)', 'French (FR)', 'Arabic (AR)'].map(lang => (
                <button 
                  key={lang}
                  type="button"
                  onClick={() => {
                    setLanguage(lang);
                    setIsLangOpen(false);
                    toast.success(`Language: ${lang}`);
                  }}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-800/60 text-slate-400 hover:text-white transition-colors text-xs text-left"
                >
                  <span>{lang}</span>
                  {language === lang && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* 1. Animated mesh gradient background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-orange-600/5 blur-[130px] animate-mesh-1"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-violet-600/10 blur-[130px] animate-mesh-2"></div>
        <div className="absolute bottom-[20%] right-[30%] w-[35%] h-[35%] rounded-full bg-orange-500/10 blur-[100px] animate-mesh-3"></div>
        
        {/* Shimmer overlay grid */}
        <div className="absolute inset-0 grid-bg-overlay opacity-50"></div>
      </div>

      <div className="w-full max-w-6xl z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
        
        {/* ============== LEFT SIDEBAR: Premium Live Meeting Visual Mockup (Desktop) ============== */}
        <div className="col-span-12 lg:col-span-6 hidden lg:flex flex-col space-y-8 pr-4">
          <div className="space-y-4">
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-xs font-black uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400 animate-pulse" />
              Instant Secure Global Space
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl font-extrabold tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 leading-[1.1]"
            >
              {t('setupWorkspace', 'Setup Workspace in Seconds. Secure Forever.')}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-slate-400 text-base font-medium max-w-md leading-relaxed"
            >
              {strCreateProfessionalAccount}
            </motion.p>
          </div>

          {/* Interactive Scheduler Card Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 50, delay: 0.3 }}
            className="w-full h-80 glass-panel rounded-3xl p-6 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top Bar for Dashboard panel */}
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-500" />
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{t('upcomingCollaborationEvents', 'Upcoming Collaboration Events')}</span>
              </div>
              <button className="p-1 px-2.5 bg-orange-500/10 border border-orange-500/20 hover:bg-orange-500/20 text-orange-400 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center gap-1 transition-all">
                <Plus className="w-2.5 h-2.5" /> {t('newSchedule', 'New Schedule')}
              </button>
            </div>

            {/* List of active planned events */}
            <div className="flex flex-col gap-2.5 my-3 flex-1 overflow-y-auto scrollbar-hide">
              
              {/* Event Card Row 1 */}
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-orange-500/20 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-orange-500/10 rounded-xl flex items-center justify-center text-orange-400 font-bold border border-orange-500/20 text-xs">
                    MT
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-white tracking-tight">{t('marketingSyncTitle', 'Marketing Sync & Sprint Planning')}</h5>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{t('marketingSyncSubtitle', 'Today at 18:30 • Space Alpha')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    <div className="w-5 h-5 bg-blue-600 rounded-full border border-slate-900 text-[6px] font-bold flex items-center justify-center">MS</div>
                    <div className="w-5 h-5 bg-emerald-600 rounded-full border border-slate-900 text-[6px] font-bold flex items-center justify-center">SC</div>
                  </div>
                  <span className="text-[8px] font-black uppercase text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full border border-orange-500/10">{t.join}</span>
                </div>
              </div>

              {/* Event Card Row 2 */}
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-white/5 flex justify-between items-center group hover:border-purple-500/20 transition-all duration-300">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 font-bold border border-purple-500/20 text-xs">
                    PD
                  </div>
                  <div>
                    <h5 className="text-[11px] font-bold text-white tracking-tight">{t('productDesignWorkshopTitle', 'Product Design Workshop')}</h5>
                    <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">{t('productDesignWorkshopSubtitle', 'Tomorrow at 10:00 • Virtual Room X')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    <div className="w-5 h-5 bg-indigo-600 rounded-full border border-slate-900 text-[6px] font-bold flex items-center justify-center">AM</div>
                    <div className="w-5 h-5 bg-pink-600 rounded-full border border-slate-900 text-[6px] font-bold flex items-center justify-center">K</div>
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full border border-white/5">{t.pending}</span>
                </div>
              </div>

            </div>

            {/* Micro details bar */}
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-2xl border border-white/5 text-[8px] font-bold text-slate-500">
              <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5 text-orange-400" /> {t('activeUsersTeamSpace', 'Active Users: 142 Team Space')}</span>
              <span>{t('systemsOperational', 'All systems fully operational 99.9% uptime')}</span>
            </div>
          </motion.div>
        </div>


        {/* ============== RIGHT SIDEBAR: Premium Form (Mobile Supported) ============== */}
        <div className="col-span-12 lg:col-span-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-8">
            
            {/* Logo and Brand Indicator */}
            <div className="text-center lg:text-left flex flex-col items-center lg:items-start space-y-3">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <div className="w-14 h-14 bg-gradient-to-tr from-orange-600 to-amber-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20 group-hover:scale-105 transition-transform">
                  <Video className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tighter uppercase font-display bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">{strJoinSynora}</h2>
                  <p className="text-[9px] font-black uppercase text-orange-500 tracking-[0.2em]">{t.register.toUpperCase()}</p>
                </div>
              </Link>
            </div>

            {/* Main Auth Form Container with Success or Shake State */}
            <motion.div
              initial={{ scale: 0.98, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ duration: 0.5, type: 'spring', stiffness: 80 }}
              className={`glass-panel rounded-[2.5rem] p-8 md:p-10 border border-white/[0.08] shadow-2xl relative overflow-hidden group/container transition-all hover:border-slate-700/60 duration-300 ${shake ? 'animate-shake' : ''}`}
            >
              {/* Internal glow line effect */}
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-orange-500/40 to-transparent"></div>

              {/* Host Community Joining Banner */}
              {hostCommunityName && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 flex items-center gap-3 shadow-inner shadow-orange-500/5"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-600/20 flex items-center justify-center text-orange-400 shrink-0">
                    <Sparkles className="w-4.5 h-4.5 text-orange-400 animate-pulse" />
                  </div>
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-orange-500 leading-none mb-1">{t('exclusiveCommunityInvite', 'EXCLUSIVE COMMUNITY INVITE')}</p>
                    <h4 className="text-xs font-bold text-slate-100 tracking-tight">
                      {t('joiningLabel', 'Joining')} <span className="text-orange-400 font-extrabold">{hostCommunityName}</span>{t('communitySuffix', "'s Community")}
                    </h4>
                  </div>
                </motion.div>
              )}

              {/* Dynamic Switching sliding toggle at local bar */}
              <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-white/5 mb-8">
                <Link 
                  to="/login" 
                  className="flex-1 py-2.5 text-center rounded-xl font-bold transition-all text-xs uppercase tracking-wider text-slate-500 hover:text-slate-300"
                >
                  <span className="relative z-10">{strSignIn}</span>
                </Link>
                <button 
                  className="flex-1 py-2.5 text-center rounded-xl font-bold transition-all text-xs uppercase tracking-wider relative text-white animate-fade-in"
                  style={{ cursor: 'default' }}
                >
                  <span className="relative z-10">{strCreateAccount.split(' ')[0]}</span>
                  <motion.div 
                    layoutId="authTabIndicator"
                    className="absolute inset-0 bg-orange-600 rounded-lg shadow-md shadow-orange-600/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                </button>
              </div>

              <AnimatePresence mode="wait">
                {isSuccess ? (
                  <motion.div 
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="py-12 flex flex-col items-center justify-center text-center space-y-4"
                  >
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                      className="w-16 h-16 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <CheckCircle2 className="w-8 h-8 animate-pulse" />
                    </motion.div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-black uppercase tracking-tight text-white font-display">{strAuthSuccess}</h4>
                      <p className="text-xs text-slate-400 font-medium">{strSecureAirspace}</p>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {/* DISPLAY NAME INPUT FIELD */}
                    <div className="space-y-1.5 relative">
                      <label 
                        className={`text-[10px] font-black uppercase tracking-widest px-1 transition-all duration-300 block ${
                          focusedInput === 'name' ? 'text-orange-400' : 'text-slate-500'
                        }`}
                      >
                        {strDisplayName}
                      </label>
                      <div className="relative group/input">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-linear transition-colors duration-300 ${
                          focusedInput === 'name' ? 'text-orange-400' : 'text-slate-500'
                        }`}>
                          <User className="w-5 h-5" />
                        </div>
                        <input
                          type="text"
                          placeholder="Alex Marshall"
                          required
                          value={name}
                          onFocus={() => setFocusedInput('name')}
                          onBlur={() => setFocusedInput(null)}
                          onChange={(e) => setName(e.target.value)}
                          className={`w-full bg-[#0a0f1d]/60 border rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none transition-all duration-300 font-medium placeholder:text-slate-700/60 ${
                            focusedInput === 'name' 
                              ? 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.15)] bg-[#0f1423]/80' 
                              : 'border-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* EMAIL INPUT FIELD */}
                    <div className="space-y-1.5 relative">
                      <label 
                        className={`text-[10px] font-black uppercase tracking-widest px-1 transition-all duration-300 block ${
                          focusedInput === 'email' ? 'text-orange-400' : 'text-slate-500'
                        }`}
                      >
                        {strEmailAddress}
                      </label>
                      <div className="relative group/input">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-linear transition-colors duration-300 ${
                          focusedInput === 'email' ? 'text-orange-400' : 'text-slate-500'
                        }`}>
                          <Mail className="w-5 h-5" />
                        </div>
                        <input
                          type="email"
                          placeholder="name@company.com"
                          required
                          value={email}
                          onFocus={() => setFocusedInput('email')}
                          onBlur={() => setFocusedInput(null)}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full bg-[#0a0f1d]/60 border rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none transition-all duration-300 font-medium placeholder:text-slate-700/60 ${
                            focusedInput === 'email' 
                              ? 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.15)] bg-[#0f1423]/80' 
                              : 'border-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* PASSWORD INPUT FIELD */}
                    <div className="space-y-1.5 relative">
                      <label 
                        className={`text-[10px] font-black uppercase tracking-widest px-1 transition-all duration-300 block ${
                          focusedInput === 'password' ? 'text-orange-400' : 'text-slate-500'
                        }`}
                      >
                        {strPassword}
                      </label>
                      <div className="relative group/input">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-linear transition-colors duration-300 ${
                          focusedInput === 'password' ? 'text-orange-400' : 'text-slate-500'
                        }`}>
                          <Lock className="w-5 h-5" />
                        </div>
                        <input
                          type="password"
                          placeholder="••••••••"
                          required
                          value={password}
                          onFocus={() => setFocusedInput('password')}
                          onBlur={() => setFocusedInput(null)}
                          onChange={(e) => setPassword(e.target.value)}
                          className={`w-full bg-[#0a0f1d]/60 border rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none transition-all duration-300 font-medium placeholder:text-slate-700/60 ${
                            focusedInput === 'password' 
                              ? 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.15)] bg-[#0f1423]/80' 
                              : 'border-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* REFERRAL CODE (OPTIONAL) */}
                    <div className="space-y-1.5 relative">
                      <label 
                        className={`text-[10px] font-black uppercase tracking-widest px-1 transition-all duration-300 block ${
                          focusedInput === 'referral' ? 'text-orange-400' : 'text-slate-500'
                        }`}
                      >
                        {t('referralCodeOptional', 'Referral Code (Optional)')}
                      </label>
                      <div className="relative group/input">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-linear transition-colors duration-300 ${
                          focusedInput === 'referral' ? 'text-orange-400' : 'text-slate-500'
                        }`}>
                          <Tag className="w-5 h-5" />
                        </div>
                        <input
                          type="text"
                          placeholder="e.g. MAYANK123"
                          value={referralCode}
                          onFocus={() => setFocusedInput('referral')}
                          onBlur={() => setFocusedInput(null)}
                          onChange={(e) => setReferralCode(e.target.value)}
                          className={`w-full bg-[#0a0f1d]/60 border rounded-2xl py-3.5 pl-12 pr-4 text-white text-sm focus:outline-none transition-all duration-300 font-mono uppercase tracking-wider placeholder:text-slate-700/60 ${
                            focusedInput === 'referral' 
                              ? 'border-orange-500/80 shadow-[0_0_20px_rgba(249,115,22,0.15)] bg-[#0f1423]/80' 
                              : 'border-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* SUBMIT BUTTON WITH GLOW & ANIMATION */}
                    <motion.button
                      whileHover={{ y: -2, scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="w-full relative group/btn overflow-hidden rounded-2xl font-bold py-4 text-sm uppercase tracking-wider text-white bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 shadow-xl shadow-orange-600/10 cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {/* Button overlay shine effect */}
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[item-shine_1s_ease_infinite]" style={{ transform: 'none' }} />
                      
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span>{strCreateAccount}</span>
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </motion.button>
                  </form>
                )}
              </AnimatePresence>
            </motion.div>

            {/* Bottom Form Switcher info for mobile */}
            <p className="text-center text-slate-500 text-sm font-medium">
              {strAlreadyHaveAccount}{' '}
              <Link to="/login" className="text-orange-500 hover:text-orange-400 font-extrabold hover:underline transition-all">
                {strSignIn}
              </Link>
            </p>

            {/* Subtle premium security certification info badge */}
            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest select-none bg-slate-950/20 p-2.5 rounded-2xl border border-white/[0.03]">
              <ShieldCheck className="w-4 h-4 text-orange-500/60" />
              <span>{strEncrypted}</span>
            </div>

            {/* Developer Credits */}
            <div className="text-center opacity-30 select-none">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-[0.2em]">{strDevCredits}</p>
            </div>
            
          </div>
        </div>

      </div>
    </div>
    </>
  );
};

