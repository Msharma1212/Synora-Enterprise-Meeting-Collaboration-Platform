import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import api from '../services/api';
import { Video, Mail, Lock, Loader2, ArrowRight, ShieldCheck, Sparkles, MessageSquare, Hand, ScreenShare, Radio, CheckCircle2, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { PortalTransition } from '../components/PortalTransition';

export const Login = () => {
  const { t, language, setLanguage } = useTranslation();
  const [isLangOpen, setIsLangOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [shake, setShake] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showPortal, setShowPortal] = useState(false);
  const [authorizedUser, setAuthorizedUser] = useState<any>(null);
  const { login, user } = useAuth();
  const navigate = useNavigate();

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
      const { data } = await api.post('/auth/login', { email, password });
      setIsSuccess(true);
      setAuthorizedUser(data);
      toast.success(t.loginSuccess || 'Logged in successfully!', {
        icon: '✨',
        style: {
          background: '#0f172a',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.2)',
        }
      });
      // Delay executing login state transition slightly so the user can enjoy the success micro-animation
      setTimeout(() => {
        setShowPortal(true);
      }, 700);
    } catch (error: any) {
      setShake(true);
      // Automatically reset shake state after animation finishes
      setTimeout(() => setShake(false), 500);
      const errorMsg = error.response?.data?.message || t.loginFailed || 'Login failed';
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

  // Safe locale fallbacks
  const strEmail = t.emailAddress || 'Email Address';
  const strPassword = t.password || 'Password';
  const strSignIn = t.signIn || 'Sign In';
  const strCreateAccount = t.createAccount || 'Create Account';
  const strNewToZMeet = t.newToZMeet || 'New to Z-Meet?';
  const strStreamlinedVideo = t.streamlinedVideo || 'Next-generation video collaboration and real-time screen sharing platform';

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
            accentColor="blue"
            voiceEnabled={authorizedUser?.settings?.voiceEnabled ?? authorizedUser?.user?.settings?.voiceEnabled ?? true}
            isFirstLogin={false}
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
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[130px] animate-mesh-1"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-600/10 blur-[130px] animate-mesh-2"></div>
        <div className="absolute top-[40%] left-[30%] w-[35%] h-[35%] rounded-full bg-indigo-500/5 blur-[100px] animate-mesh-3"></div>
        
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
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-xs font-black uppercase tracking-widest"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
              Z-Meet Premium Enterprise v2.0
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl font-extrabold tracking-tight font-display bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-200 to-slate-400 leading-[1.1]"
            >
              {strConnectMeet}
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-slate-400 text-base font-medium max-w-md leading-relaxed"
            >
              {strStreamlinedVideo}
            </motion.p>
          </div>

          {/* Interactive Live-Conferencing Canvas Preview */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 50, delay: 0.3 }}
            className="w-full h-80 glass-panel rounded-3xl p-5 border border-white/5 shadow-2xl relative overflow-hidden flex flex-col justify-between"
          >
            {/* Top Bar of meeting */}
            <div className="flex justify-between items-center bg-slate-950/40 p-2.5 rounded-2xl border border-white/5">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-ping"></span>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{strLiveWebinar}</span>
              </div>
              <div className="flex gap-1.5">
                <span className="bg-slate-800 border border-white/5 text-[9px] font-bold text-slate-400 px-2 py-0.5 rounded">ID: 809-ZMT</span>
                <span className="bg-emerald-500/10 border border-emerald-500/20 text-[9px] font-black text-emerald-400 px-2 py-0.5 rounded flex items-center gap-1">
                  <Radio className="w-2.5 h-2.5" /> 1080P HD
                </span>
              </div>
            </div>

            {/* Virtual Video grid grid */}
            <div className="grid grid-cols-2 gap-3 my-4 flex-1">
              <div className="bg-slate-950/80 rounded-2xl border border-white/5 relative overflow-hidden flex items-center justify-center group hover:border-blue-500/30 transition-all duration-300">
                <div className="absolute top-3 left-3 flex gap-1 items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-[8px] font-black tracking-widest uppercase text-slate-400">Mayank Sharma (Host)</span>
                </div>
                {/* Simulated Waveform Visualizer */}
                <div className="flex gap-1 items-end h-8">
                  <div className="w-1.5 h-4 bg-blue-500 rounded-full animate-pulse"></div>
                  <div className="w-1.5 h-7 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-5 bg-indigo-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <div className="w-1.5 h-8 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                </div>
                <div className="absolute bottom-3 right-3 flex gap-1">
                  <div className="p-1 bg-slate-900 border border-white/5 rounded-lg"><Mail className="w-2.5 h-2.5 text-slate-400" /></div>
                </div>
              </div>

              <div className="bg-slate-950/80 rounded-2xl border border-white/5 relative overflow-hidden flex items-center justify-center group hover:border-purple-500/30 transition-all duration-300">
                <div className="absolute top-3 left-3 flex gap-1 items-center">
                  <span className="text-[8px] font-black tracking-widest uppercase text-slate-400">{strSarahConnor}</span>
                </div>
                <div className="w-12 h-12 rounded-full bg-[#1e293b] flex items-center justify-center border border-white/10 text-xs font-bold text-indigo-400 shadow-inner">
                  SC
                </div>
                {/* Hand raise floating indicator */}
                <motion.div 
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 2.5 }}
                  className="absolute top-3 right-3 p-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg flex items-center gap-1 px-1.5 text-[7px] font-black uppercase tracking-wider"
                >
                  <Hand className="w-2.5 h-2.5 fill-current" /> {strRaised}
                </motion.div>
                <div className="absolute bottom-3 left-3 text-[7px] bg-slate-900 px-1.5 py-0.5 rounded border border-white/5 text-slate-500 font-bold">{strMuted}</div>
              </div>
            </div>

            {/* Bottom Controls strip */}
            <div className="flex justify-between items-center bg-slate-950/60 p-2 rounded-2xl border border-white/5">
              <div className="flex gap-1">
                <div className="w-7 h-7 bg-indigo-600 rounded-xl flex items-center justify-center text-white"><Video className="w-3.5 h-3.5" /></div>
                <div className="w-7 h-7 bg-slate-800 border border-white/5 rounded-xl flex items-center justify-center text-slate-400"><Lock className="w-3.5 h-3.5" /></div>
                <div className="w-7 h-7 bg-slate-800 border border-white/5 rounded-xl flex items-center justify-center text-slate-400"><MessageSquare className="w-3.5 h-3.5" /></div>
              </div>
              
              {/* Dynamic message float note */}
              <div className="text-[9px] font-bold text-slate-300 flex items-center gap-1 bg-slate-900 px-2.5 py-1 rounded-xl border border-white/5">
                <ScreenShare className="w-3 h-3 text-indigo-400" />
                <span>{strAlexSharing}</span>
              </div>
            </div>
          </motion.div>
        </div>


        {/* ============== RIGHT SIDEBAR: Premium Form (Mobile Supported) ============== */}
        <div className="col-span-12 lg:col-span-6 flex flex-col items-center justify-center">
          <div className="w-full max-w-md space-y-8">
            
            {/* Logo and Brand Indicator */}
            <div className="text-center lg:text-left flex flex-col items-center lg:items-start space-y-3">
              <Link to="/" className="inline-flex items-center gap-3 group">
                <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                  <Video className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold tracking-tighter uppercase font-display bg-gradient-to-r from-white via-slate-100 to-slate-400 bg-clip-text text-transparent">Z-MEET</h2>
                  <p className="text-[9px] font-black uppercase text-blue-500 tracking-[0.2em]">{t.streamlinedVideo ? 'PRO' : 'Videoconferencing'}</p>
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
              <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-blue-500/40 to-transparent"></div>

              {/* Dynamic Switching sliding toggle at local bar */}
              <div className="flex bg-slate-950/60 p-1.5 rounded-2xl border border-white/5 mb-8">
                <button 
                  className="flex-1 py-2.5 text-center rounded-xl font-bold transition-all text-xs uppercase tracking-wider relative text-white"
                  style={{ cursor: 'default' }}
                >
                  <span className="relative z-10">{strSignIn}</span>
                  <motion.div 
                    layoutId="authTabIndicator"
                    className="absolute inset-0 bg-blue-600 rounded-lg shadow-md shadow-blue-600/20"
                    transition={{ type: 'spring', stiffness: 350, damping: 25 }}
                  />
                </button>
                <Link 
                  to="/register" 
                  className="flex-1 py-2.5 text-center rounded-xl font-bold transition-all text-xs uppercase tracking-wider text-slate-500 hover:text-slate-300"
                >
                  <span className="relative z-10">{strCreateAccount}</span>
                </Link>
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
                      className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <CheckCircle2 className="w-8 h-8 animate-pulse" />
                    </motion.div>
                    <div className="space-y-1">
                      <h4 className="text-xl font-black uppercase tracking-tight text-white font-display">{strAuthSuccess}</h4>
                      <p className="text-xs text-slate-400 font-medium">{strSecureAirspace}</p>
                    </div>
                  </motion.div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* EMAIL INPUT FIELD */}
                    <div className="space-y-2 relative">
                      <label 
                        className={`text-[10px] font-black uppercase tracking-widest px-1 transition-all duration-300 block ${
                          focusedInput === 'email' ? 'text-blue-400' : 'text-slate-500'
                        }`}
                      >
                        {strEmail}
                      </label>
                      <div className="relative group/input">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-linear transition-colors duration-300 ${
                          focusedInput === 'email' ? 'text-blue-400' : 'text-slate-500'
                        }`}>
                          <Mail className="w-5 h-5" />
                        </div>
                        <input
                          type="email"
                          placeholder="mayank@gmail.com"
                          required
                          value={email}
                          onFocus={() => setFocusedInput('email')}
                          onBlur={() => setFocusedInput(null)}
                          onChange={(e) => setEmail(e.target.value)}
                          className={`w-full bg-[#0a0f1d]/60 border rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none transition-all duration-300 font-medium placeholder:text-slate-700/60 ${
                            focusedInput === 'email' 
                              ? 'border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-[#0d1527]/80' 
                              : 'border-white/[0.06] hover:border-white/[0.12]'
                          }`}
                        />
                      </div>
                    </div>

                    {/* PASSWORD INPUT FIELD */}
                    <div className="space-y-2 relative">
                      <div className="flex justify-between items-center px-1">
                        <label 
                          className={`text-[10px] font-black uppercase tracking-widest transition-all duration-300 block ${
                            focusedInput === 'password' ? 'text-blue-400' : 'text-slate-500'
                          }`}
                        >
                          {strPassword}
                        </label>
                      </div>
                      <div className="relative group/input">
                        <div className={`absolute left-4 top-1/2 -translate-y-1/2 rounded-linear transition-colors duration-300 ${
                          focusedInput === 'password' ? 'text-blue-400' : 'text-slate-500'
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
                          className={`w-full bg-[#0a0f1d]/60 border rounded-2xl py-4 pl-12 pr-4 text-white text-sm focus:outline-none transition-all duration-300 font-medium placeholder:text-slate-700/60 ${
                            focusedInput === 'password' 
                              ? 'border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.15)] bg-[#0d1527]/80' 
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
                      className="w-full relative group/btn overflow-hidden rounded-2xl font-bold py-4 text-sm uppercase tracking-wider text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-xl shadow-blue-600/10 cursor-pointer transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {/* Button overlay shine effect */}
                      <span className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:animate-[item-shine_1s_ease_infinite]" style={{ transform: 'none' }} />
                      
                      {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span>{strSignIn}</span>
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
              {strNewToZMeet}{' '}
              <Link to="/register" className="text-blue-500 hover:text-blue-400 font-extrabold hover:underline transition-all">
                {strCreateAccount}
              </Link>
            </p>

            {/* Subtle premium security certification info badge */}
            <div className="flex items-center justify-center gap-2 text-[10px] font-black text-slate-600 uppercase tracking-widest select-none bg-slate-950/20 p-2.5 rounded-2xl border border-white/[0.03]">
              <ShieldCheck className="w-4 h-4 text-emerald-500/60" />
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
