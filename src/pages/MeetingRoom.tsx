import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { 
  Mic, MicOff, Video as VideoIcon, VideoOff, 
  PhoneOff, MessageSquare, Users, ScreenShare, 
  Hand, Settings, Shield, MoreVertical, Send,
  Trash2, Search, Smile, Share2, MoreHorizontal, Monitor,
  X, Loader2, Sparkles, XCircle, Maximize2, Info,
  Volume2, VolumeX, Camera, CameraOff, Crown,
  LayoutGrid, UserCircle, Signal, Wifi,
  ArrowRight, Mic2, MonitorUp, ChevronDown, AlertCircle, LogOut,
  Captions, BarChart3, PenTool, Bell, Copy, Check, ExternalLink,
  Eraser, RotateCcw, Plus, Zap, Clock, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';
import api from '../services/api';

import MediaTester from '../components/MediaTester';
import { 
  getOptimizedConstraints, 
  optimizeSDP, 
  WebAudioPipeline, 
  hotSwapTrackOnPeers, 
  DEFAULT_MEDIA_SETTINGS, 
  AdvancedAudioSettings 
} from '../lib/mediaService';

interface Meeting {
  _id: string;
  title: string;
  host: any;
  participants: any[];
}

export const MeetingRoomComponent = () => {
  const { code } = useParams();
  const { user, login: updateAuthUser } = useAuth();
  const { t, localeCode } = useTranslation();
  const navigate = useNavigate();
  
  const socketRef = useRef<any>(null);
  const [peers, setPeers] = useState<any[]>([]);
  const [micActive, setMicActive] = useState(true);
  const [videoActive, setVideoActive] = useState(true);
  const [isJoined, setIsJoined] = useState(false);
  const [inWaitingRoom, setInWaitingRoom] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenSharers, setScreenSharers] = useState<string[]>([]);
  const [raisedHands, setRaisedHands] = useState<string[]>([]);
  const [reactions, setReactions] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [globalSettings, setGlobalSettings] = useState<any>({
    chatEnabled: true,
    screenShareEnabled: true,
    waitingRoomEnabled: false,
    reactionsEnabled: true,
    mediaEnabled: true
  });
  
  // New Google Meet-like features states
  const [showCaptions, setShowCaptions] = useState(false);
  const [captionText, setCaptionText] = useState("");
  const [polls, setPolls] = useState<any[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Visual Effects & Audio states
  const [visualEffect, setVisualEffect] = useState<'none' | 'blur' | 'glow' | 'bw' | 'beauty' | 'soft'>('none');
  const [isEffectLoading, setIsEffectLoading] = useState(false);
  const [noiseCancellation, setNoiseCancellation] = useState<'off' | 'low' | 'medium' | 'high' | 'auto'>('auto');
  
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        streamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
        });
        screenStreamRef.current = null;
      }
    };
  }, []);
  const [layout, setLayout] = useState<'grid' | 'spotlight'>('grid');
  const [activePresenterId, setActivePresenterId] = useState<string | null>(null);

  // Live Meeting Duration Timer
  const [meetingDuration, setMeetingDuration] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMeetingDuration(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // XP System: Join & Attendance triggers
  useEffect(() => {
    if (!isJoined || !code || !user) return;

    // 1. Join Meeting (+10 XP)
    api.post('/auth/xp/add', { action: 'join_meeting', meetingCode: code })
      .then(res => {
        if (res.data?.xpAdded) {
          toast.success(`+10 XP: Joined meeting "${code}"!`, { icon: '✨' });
        }
      })
      .catch(err => console.error("Error awarding join_meeting XP:", err));

    // 2. 30 Minutes Timer (+20 XP)
    const timer30 = setTimeout(() => {
      api.post('/auth/xp/add', { action: 'attend_30m', meetingCode: code })
        .then(res => {
          if (res.data?.xpAdded) {
            toast.success(`+20 XP: Attended 30 minutes!`, { icon: '✨' });
          }
        })
        .catch(err => console.error("Error awarding 30m attendance XP:", err));
    }, 30 * 60 * 1000);

    // 3. 60 Minutes Timer (+40 XP)
    const timer60 = setTimeout(() => {
      api.post('/auth/xp/add', { action: 'attend_1h', meetingCode: code })
        .then(res => {
          if (res.data?.xpAdded) {
            toast.success(`+40 XP: Attended 1 hour!`, { icon: '✨' });
          }
        })
        .catch(err => console.error("Error awarding 1h attendance XP:", err));
    }, 60 * 60 * 1000);

    return () => {
      clearTimeout(timer30);
      clearTimeout(timer60);
    };
  }, [isJoined, code, user]);

  const formatDuration = (sec: number) => {
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const secs = sec % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Fullscreen Presentation Mode State
  const [isMeetingFullscreen, setIsMeetingFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChangeGlobal = () => {
      setIsMeetingFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChangeGlobal);
    document.addEventListener("webkitfullscreenchange", handleFsChangeGlobal);
    return () => {
      document.removeEventListener("fullscreenchange", handleFsChangeGlobal);
      document.removeEventListener("webkitfullscreenchange", handleFsChangeGlobal);
    };
  }, []);

  // System Notification Sounds Utility via Web Audio API 
  const playSystemSound = (type: 'join' | 'leave' | 'hand' | 'admit') => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const audioCtx = new AudioCtxClass();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      if (type === 'join') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(554.37, audioCtx.currentTime + 0.1); 
        osc.frequency.exponentialRampToValueAtTime(659.25, audioCtx.currentTime + 0.22); 
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'leave') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15); 
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.06, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.28);
      } else if (type === 'hand') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); 
        osc.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); 
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.05, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
      } else if (type === 'admit') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(554.37, audioCtx.currentTime); 
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.12); 
        gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.28);
      }
    } catch (err) {
      console.warn("Audio Context blocked or failed:", err);
    }
  };

  // Inactivity Auto-Hide controls state and functions
  const [showMeetingControls, setShowMeetingControls] = useState(true);
  const meetingControlsTimeoutRef = useRef<any>(null);

  const resetMeetingControlsTimer = () => {
    setShowMeetingControls(true);
    if (meetingControlsTimeoutRef.current) {
      clearTimeout(meetingControlsTimeoutRef.current);
    }
    meetingControlsTimeoutRef.current = setTimeout(() => {
      // ONLY auto-hide on inactivity if we are in spotlight presentation mode
      if (layout === 'spotlight' && screenSharers.length > 0) {
        setShowMeetingControls(false);
      }
    }, 2800); // 2.8 seconds of inactivity before fading out controls
  };

  // Clean up inactivity controlstimer on unmount
  useEffect(() => {
    if (layout === 'spotlight' && screenSharers.length > 0) {
      resetMeetingControlsTimer();
    } else {
      setShowMeetingControls(true);
    }
    return () => {
      if (meetingControlsTimeoutRef.current) clearTimeout(meetingControlsTimeoutRef.current);
    };
  }, [layout, screenSharers.length]);

  // Mobile optimization for presentation mode
  const [showMobileParticipants, setShowMobileParticipants] = useState(true);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);

  const handleTouchStartGlobal = (e: React.TouchEvent) => {
    if (layout !== 'spotlight' || !screenSharers.length) return;
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMoveGlobal = (e: React.TouchEvent) => {
    if (touchStartY === null) return;
    const currentY = e.touches[0].clientY;
    const diffY = touchStartY - currentY;

    if (Math.abs(diffY) > 50) {
      if (diffY > 50) {
        setShowMobileParticipants(true);
      } else if (diffY < -50) {
        setShowMobileParticipants(false);
      }
      setTouchStartY(null);
    }
  };

  const handleTouchEndGlobal = () => {
    setTouchStartY(null);
  };

  // Automatically switch to Spotlight/Presentation Mode when someone shares screen, and restore to Grid when stopped
  useEffect(() => {
    if (screenSharers.length > 0) {
      setLayout('spotlight');
      setActivePresenterId(prev => {
        if (prev && screenSharers.includes(prev)) {
          return prev;
        }
        return screenSharers[screenSharers.length - 1];
      });
    } else {
      setLayout('grid');
      setActivePresenterId(null);
    }
  }, [screenSharers]);

  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [message, setMessage] = useState('');
  const [pendingAudienceRequest, setPendingAudienceRequest] = useState<{
    requesterName: string;
    requesterId: string;
    targetUserId: string;
    roomID: string;
    hostSocketId: string;
  } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [searchMember, setSearchMember] = useState('');
  const [hasPermissions, setHasPermissions] = useState(false);
  const [waitingUsers, setWaitingUsers] = useState<any[]>([]);
  const [participantsList, setParticipantsList] = useState<any[]>([]);
  const [meetingDetails, setMeetingDetails] = useState<Meeting | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'people' | 'ai' | 'settings' | 'activities' | 'info' | null>(null);
  const toggleSidebar = (tab: 'chat' | 'people' | 'ai' | 'settings' | 'activities' | 'info') => {
    setSidebarTab(prev => prev === tab ? null : tab);
    if (tab === 'chat') setUnreadChatCount(0);
  };
  const [currentTime, setCurrentTime] = useState(new Date());
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  const [activeTab, setActiveTab] = useState<'polls' | 'whiteboard'>('polls');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'host' | 'participant'>('participant');
  const [meetingRole, setMeetingRole] = useState<'admin' | 'host' | 'participant'>('participant');
  
  // Broadcast & Security states
  const [showScreenSourceModal, setShowScreenSourceModal] = useState(false);
  const [micLocked, setMicLocked] = useState(false);
  const [cameraLocked, setCameraLocked] = useState(false);
  const [isScreenShareBlocked, setIsScreenShareBlocked] = useState(false);
  const [globalPermissions, setGlobalPermissions] = useState({
    allowMicrophone: true,
    allowCamera: true,
    allowChat: true,
    allowReactions: true,
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  useEffect(() => {
    let interval: any;
    if (showCaptions) {
      const phrases = [
        "Welcome everyone to the synchronization meeting.",
        "Can everyone hear me clearly?",
        "I'm currently sharing my screen to discuss the roadmap.",
        "The project deadline is approaching next week.",
        "We need to focus on performance optimization.",
        "Does anyone have any questions about the last sprint?",
        "Great progress on the UI design everyone.",
        "Let's wrap up this discussion in 10 minutes."
      ];
      let i = 0;
      interval = setInterval(() => {
        setCaptionText(phrases[i % phrases.length]);
        i++;
      }, 4000);
    } else {
      setCaptionText("");
    }
    return () => clearInterval(interval);
  }, [showCaptions]);

  useEffect(() => {
    const updateQuality = () => {
      if ('connection' in navigator) {
        const conn = (navigator as any).connection;
        if (conn.saveData) setConnectionQuality('poor');
        else if (conn.downlink < 1) setConnectionQuality('poor');
        else if (conn.downlink < 2) setConnectionQuality('good');
        else setConnectionQuality('excellent');
      }
    };
    updateQuality();
    const interval = setInterval(updateQuality, 5000);
    return () => clearInterval(interval);
  }, []);
  
  // Chat feature states
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  
  const joinMeeting = async () => {
    if (!socketRef.current || !socketRef.current.connected) {
      console.warn("Socket not connected, attempting to reconnect...");
      socketRef.current = io();
      toast.error("Connecting to server... Please try again in a moment.");
      return;
    }

    try {
      console.log("Attempting to join meeting with code:", code);
      const { data } = await api.post('/meetings/join', { code });
      
      if (data.inWaitingRoom) {
        setInWaitingRoom(true);
        socketRef.current.emit("join-waiting-room", { 
          roomID: code, 
          userId: user?._id || (user as any)?.id, 
          name: user?.name 
        });
        toast.success("Joined waiting room. Waiting for host admission.");
      } else {
        setIsJoined(true);
        socketRef.current.emit("join-room", { 
          roomID: code, 
          userId: user?._id || (user as any)?.id, 
          name: user?.name,
          isMuted: !micActive,
          cameraEnabled: videoActive
        });
        toast.success("Joined meeting successfully!");
      }
    } catch (error: any) {
      console.error("Join meeting error:", error);
      const message = error.response?.data?.message || "Failed to join meeting. Please try again.";
      toast.error(message);
    }
  };
  
  const exitMeeting = () => {
    exitedRef.current = true;
    
    // Release active WebAudio pipeline
    if (pipelineRef.current) {
      pipelineRef.current.cleanup();
      pipelineRef.current = null;
    }

    // Release all media resources instantly
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      streamRef.current = null;
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
        track.enabled = false;
      });
      screenStreamRef.current = null;
    }
    
    // Reset permissions and active states
    setHasPermissions(false);
    setVideoActive(false);
    setMicActive(false);
    
    // Destroy all peer connections
    peersRef.current.forEach(p => {
      if (p.peer) {
        try {
          p.peer.destroy();
        } catch (e) {}
      }
    });
    peersRef.current = [];
    setPeers([]);

    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Clean up video element source and stop all its tracks
    if (userVideo.current) {
      const srcStream = userVideo.current.srcObject as MediaStream;
      if (srcStream && typeof srcStream.getTracks === 'function') {
        srcStream.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
      }
      userVideo.current.srcObject = null;
    }

    navigate('/dashboard');
  };

  useEffect(() => {
    isMountedRef.current = true;
    exitedRef.current = false;
    const handleBeforeUnload = () => {
      exitMeeting();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      isMountedRef.current = false;
      exitedRef.current = true;
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Cleanup WebAudio pipeline
      if (pipelineRef.current) {
        pipelineRef.current.cleanup();
        pipelineRef.current = null;
      }
      
      // Force stop all tracks globally on unmount to release camera immediately
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        screenStreamRef.current = null;
      }
      if (userVideo.current) {
        const srcStream = userVideo.current.srcObject as MediaStream;
        if (srcStream && typeof srcStream.getTracks === 'function') {
          srcStream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
        }
        userVideo.current.srcObject = null;
      }
    };
  }, []);
  
  // AI Assistant logic removed
  const isMountedRef = useRef(true);
  const exitedRef = useRef(false);
  const userVideo = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<any[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  
  const pipelineRef = useRef<WebAudioPipeline | null>(null);
  const processedStreamRef = useRef<MediaStream | null>(null);
  const [activeMicId, setActiveMicId] = useState('');
  const [activeCameraId, setActiveCameraId] = useState('');
  const [activeSpeakerId, setActiveSpeakerId] = useState('');

  // Safe variables for finding exact issues as requested
  const participants = participantsList;
  const localStream = streamRef.current;

  // Update or build processed Web Audio stream to send over WebRTC
  const updateProcessedStream = (rawStream: MediaStream) => {
    if (!rawStream) {
      processedStreamRef.current = null;
      return null;
    }
    
    const savedSettings = localStorage.getItem('synora_media_settings');
    const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
    
    if (pipelineRef.current) {
      pipelineRef.current.cleanup();
    }
    
    // Instantiate pipeline on the raw mic tracks
    pipelineRef.current = new WebAudioPipeline(rawStream, mediaSettings);
    
    pipelineRef.current.onFeedbackDetected = () => {
      toast.error("Feedback loop detected! Muting live loopback or lowering gain.", { id: 'meeting-feedback' });
    };
    
    const sendingStream = new MediaStream();
    // Add raw video tracks
    rawStream.getVideoTracks().forEach(t => sendingStream.addTrack(t));
    
    // Add processed audio track
    const processedTrack = pipelineRef.current.getProcessedTrack();
    if (processedTrack) {
      sendingStream.addTrack(processedTrack);
    } else if (rawStream.getAudioTracks().length > 0) {
      sendingStream.addTrack(rawStream.getAudioTracks()[0]);
    }
    
    processedStreamRef.current = sendingStream;
    return sendingStream;
  };

  const switchMicrophone = async (newMicId: string) => {
    if (!streamRef.current) return;
    try {
      setActiveMicId(newMicId);
      
      // Stop existing audio tracks
      streamRef.current.getAudioTracks().forEach(t => t.stop());
      
      const savedSettings = localStorage.getItem('synora_media_settings');
      const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
      const activeSettings = { ...mediaSettings, selectedMic: newMicId };
      localStorage.setItem('synora_media_settings', JSON.stringify(activeSettings));

      const constraints = getOptimizedConstraints(newMicId, undefined, activeSettings);
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: constraints.audio });
      const newRawTrack = tempStream.getAudioTracks()[0];
      
      streamRef.current.getAudioTracks().forEach(t => streamRef.current?.removeTrack(t));
      streamRef.current.addTrack(newRawTrack);
      
      // Update pipeline
      if (pipelineRef.current) {
        pipelineRef.current.cleanup();
      }
      pipelineRef.current = new WebAudioPipeline(streamRef.current, activeSettings);
      
      const processedTrack = pipelineRef.current.getProcessedTrack();
      if (processedTrack) {
        // Hot-swap on active peer senders!
        await hotSwapTrackOnPeers(peersRef.current, 'audio', processedTrack);
      }
      
      toast.success("Microphone switched smoothly");
    } catch (err) {
      console.error("Microphone switch failed:", err);
      toast.error("Failed to switch microphone");
    }
  };

  const switchCamera = async (newCamId: string) => {
    if (!streamRef.current) return;
    try {
      setActiveCameraId(newCamId);
      
      streamRef.current.getVideoTracks().forEach(t => t.stop());
      
      const savedSettings = localStorage.getItem('synora_media_settings');
      const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
      const activeSettings = { ...mediaSettings, selectedCamera: newCamId };
      localStorage.setItem('synora_media_settings', JSON.stringify(activeSettings));

      const constraints = getOptimizedConstraints(undefined, newCamId, activeSettings);
      const tempStream = await navigator.mediaDevices.getUserMedia({ video: constraints.video });
      const newVideoTrack = tempStream.getVideoTracks()[0];
      
      streamRef.current.getVideoTracks().forEach(t => streamRef.current?.removeTrack(t));
      streamRef.current.addTrack(newVideoTrack);
      
      if (userVideo.current) {
        userVideo.current.srcObject = streamRef.current;
      }
      
      // Hot-swap on active peer senders!
      await hotSwapTrackOnPeers(peersRef.current, 'video', newVideoTrack);
      toast.success("Camera switched smoothly");
    } catch (err) {
      console.error("Camera switch failed:", err);
      toast.error("Failed to switch camera");
    }
  };

  const switchSpeaker = async (newSpeakerId: string) => {
    setActiveSpeakerId(newSpeakerId);
    
    const savedSettings = localStorage.getItem('synora_media_settings');
    const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
    localStorage.setItem('synora_media_settings', JSON.stringify({ ...mediaSettings, selectedSpeaker: newSpeakerId }));

    const mediaElements = document.querySelectorAll('video, audio');
    mediaElements.forEach((el: any) => {
      if (el.setSinkId) {
        el.setSinkId(newSpeakerId).catch((err: any) => {
          console.error("Failed to set sink ID on element:", err);
        });
      }
    });
    toast.success("Speaker output routed cleanly");
  };

  const handleDevicesChanged = (micId: string, camId: string, speakerId: string) => {
    if (micId && micId !== activeMicId) {
      switchMicrophone(micId);
    }
    if (camId && camId !== activeCameraId) {
      switchCamera(camId);
    }
    if (speakerId && speakerId !== activeSpeakerId) {
      switchSpeaker(speakerId);
    }
  };

  // Safe participants List setter to prevent Duplicate / Undefined users
  const setParticipants = (updater: any) => {
    setParticipantsList(prev => {
      let nextList = prev;
      if (typeof updater === 'function') {
        nextList = updater(prev);
      } else {
        nextList = updater;
      }
      if (!Array.isArray(nextList)) return prev;
      const seen = new Set();
      return nextList.filter(u => {
        if (!u) return false;
        const id = u.userId || u.socketId || u._id || u.id;
        if (!id) return false;
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      });
    });
  };

  // Safe logs for finding exact issues as requested
  useEffect(() => {
    console.log("participants:", participants);
    console.log("localStream:", localStream);
  }, [participants, localStream]);
  
  useEffect(() => {
    let previewStream: MediaStream | null = null;
    const setupPreview = async () => {
      if (!isJoined) {
        if (!meetingDetails) return; // Wait until meeting details are fetched to avoid premature prompt or race condition

        const isSpectator = meetingDetails?.isBroadcast && meetingRole === 'participant';
        if (isSpectator) {
          setHasPermissions(true);
          if (userVideo.current) userVideo.current.srcObject = null;
          return;
        }

        try {
          // If both are deactivated, stop the tracks to release the hardware, but keep streamRef as null
          if (!videoActive && !micActive) {
            if (userVideo.current) userVideo.current.srcObject = null;
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => {
                track.stop();
                track.enabled = false;
              });
              streamRef.current = null;
            }
            return;
          }
          
          let stream = streamRef.current;
          
          if (!stream) {
            const savedSettings = localStorage.getItem('synora_media_settings');
            const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
            
            try {
              const constraints = getOptimizedConstraints(mediaSettings.selectedMic, mediaSettings.selectedCamera, mediaSettings);
              stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
              console.warn("Lobby optimized getUserMedia failed, trying fallbacks", err);
              try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              } catch (err2) {
                try {
                  stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                } catch (err3) {
                  try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                  } catch (err4) {
                    throw new Error("No camera or microphone access granted");
                  }
                }
              }
            }
            if (!isMountedRef.current || exitedRef.current) {
              if (stream) {
                stream.getTracks().forEach(track => {
                  track.stop();
                  track.enabled = false;
                });
              }
              return;
            }
            streamRef.current = stream;
          }

          // Apply current active states to the stream tracks
          if (stream) {
            const videoTracks = stream.getVideoTracks();
            const audioTracks = stream.getAudioTracks();
            
            if (videoTracks.length > 0) {
              videoTracks[0].enabled = videoActive;
            } else if (videoActive) {
              // On-demand add video track if it isn't in current stream list
              try {
                const addStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                const track = addStream.getVideoTracks()[0];
                if (track) {
                  stream.addTrack(track);
                  track.enabled = videoActive;
                }
              } catch (e) {
                console.error("Could not add video track on-demand", e);
              }
            }

            if (audioTracks.length > 0) {
              audioTracks[0].enabled = micActive;
            } else if (micActive) {
              // On-demand add audio track if it isn't in current stream list
              try {
                const addStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                const track = addStream.getAudioTracks()[0];
                if (track) {
                  stream.addTrack(track);
                  track.enabled = micActive;
                }
              } catch (e) {
                console.error("Could not add audio track on-demand", e);
              }
            }
          }

          previewStream = stream;
          
          if (userVideo.current) {
            userVideo.current.srcObject = previewStream;
          }
          setHasPermissions(true);
        } catch (err) {
          console.error("Lobby preview failed", err);
          setHasPermissions(false);
        }
      } else if (isJoined && streamRef.current && userVideo.current) {
        userVideo.current.srcObject = streamRef.current;
      }
    };
    setupPreview();
    return () => {
      // Do not stop tracks here as we want to reuse them seamlessly when we join the meeting.
    };
  }, [videoActive, isJoined, micActive, meetingDetails, meetingRole]);

  const EMOJIS = ['❤️', '👏', '🔥', '😂', '😮', '🎉', '👍', '🙏'];

  useEffect(() => {
    socketRef.current = io();
    const socket = socketRef.current;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
    });

    socket.on("join-success", (data: any) => {
      console.log("[MeetingRoom] join-success socket event received:", data);
      if (data && data.meetingRole) {
        setMeetingRole(data.meetingRole);
        setUserRole(data.meetingRole === 'host' ? 'host' : (data.meetingRole === 'admin' ? 'admin' : 'participant'));
        console.log("User ID:", user?._id || (user as any)?.id);
        console.log("Audience ID:", (data.meeting?.audienceId || data.meeting?.host?._id || data.meeting?.host || "None"));
        console.log("Meeting Role:", data.meetingRole);
      }
      if (data && data.screenSharers) {
        setScreenSharers(data.screenSharers);
      }
    });

    socket.on("global-settings-update", (settings: any) => {
      console.log("Global settings updated dynamically from admin:", settings);
      setGlobalSettings(settings);
    });

    socket.on("connect_error", (err: any) => {
      console.error("Socket connection error:", err);
      setError("Connection failed. Please check your internet.");
    });

    console.log(`[MeetingRoom] Initializing fetch for code: ${code}`);
    // Fetch meeting details
    api.get(`/meetings/join?code=${code}`).then(res => {
      const meeting = res.data;
      console.log(`[MeetingRoom] Successfully loaded meeting:`, meeting.title);
      setMeetingDetails(meeting);
      
      // Role Determination logic: Admin > Host > Participant
      let computedRole: 'admin' | 'host' | 'participant' = 'participant';
      const myIdStr = (user?._id || (user as any)?.id || '').toString();
      const hostIdStr = (meeting.host && typeof meeting.host === 'object') 
        ? (meeting.host as any)._id?.toString() 
        : (meeting.host || '').toString();
      const audienceIdStr = (meeting.audienceId || '').toString();

      if (user?.role === 'developer' || user?.role === 'admin' || user?.role === 'co-admin') {
        computedRole = 'admin';
      } else if ((myIdStr && hostIdStr && myIdStr === hostIdStr) || (myIdStr && audienceIdStr && myIdStr === audienceIdStr)) {
        computedRole = 'host';
      } else {
        computedRole = 'participant';
      }
      
      console.log("User ID:", user?._id || (user as any)?.id);
      console.log("Audience ID:", meeting.audienceId || (meeting.host && typeof meeting.host === 'object' ? (meeting.host as any)._id : meeting.host));
      console.log("Meeting Role:", computedRole);
      
      setUserRole(computedRole);
      setMeetingRole(computedRole);

      if (meeting.isBroadcast && computedRole === 'participant') {
        setVideoActive(false);
        setMicActive(false);
      }
      
      setIsLoading(false);
      getMedia(meeting, computedRole);
    }).catch(err => {
      console.error("Failed to load meeting details", err);
      const msg = err.response?.data?.message || "Meeting not found or unavailable. Check your connection or the code.";
      setError(msg);
      setIsLoading(false);
    });

    // Global keydown handler to close widgets on ESC key
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSidebarTab(null);
        setShowMicMenu(false);
        setShowCameraMenu(false);
        setShowMoreMenu(false);
        setShowEmojiPicker(false);
        setShowScreenSourceModal(false);
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);

    // Fetch existing messages
    api.get(`/meetings/${code}/messages`).then(res => {
      if (Array.isArray(res.data)) {
        const formattedMessages = res.data.map((m: any) => ({
          _id: m._id,
          roomID: code,
          text: m.text,
          senderName: m.sender?.name || 'Unknown',
          userId: m.sender?._id || m.sender,
          senderId: m.sender?._id,
          timestamp: m.createdAt,
          reactions: m.reactions || []
        }));
        setMessages(formattedMessages);
      }
    }).catch(err => {
      console.error("Failed to load messages", err);
    });

    socket.on("participants-update", (list: any[]) => {
      const seen = new Set();
      const unique: any[] = [];
      list.forEach((p) => {
        const id = p.userId || p.socketId;
        if (!seen.has(id)) {
          seen.add(id);
          unique.push(p);
        }
      });
      setParticipantsList(unique);

      // Dynamically sync my own locked states from server list details
      const myId = user?._id || (user as any)?.id;
      const me = unique.find(p => p.socketId === socket.id || (myId && p.userId === myId));
      if (me) {
        if (me.micLocked !== undefined) setMicLocked(me.micLocked);
        if (me.cameraLocked !== undefined) setCameraLocked(me.cameraLocked);
      }
    });

    socket.on("waiting-list-update", (list: any[]) => {
      setWaitingUsers(list);
    });

    socket.on("admitted", () => {
      playSystemSound('admit');
      setInWaitingRoom(false);
      setIsJoined(true);
      toast.success("Host admitted you! Joining meeting...");
      socket.emit("join-room", { 
        roomID: code, 
        userId: user?._id || (user as any)?.id, 
        name: user?.name,
        isMuted: !micActive,
        cameraEnabled: videoActive
      });
    });

    socket.on("rejected", () => {
      toast.error("The host rejected your join request.");
      setInWaitingRoom(false);
      exitMeeting();
    });

    socket.on("receive-message", (msg: any) => {
      setMessages(prev => [...prev, { ...msg, _id: msg._id || Math.random().toString() }]);
      if (sidebarTab !== 'chat') {
        setUnreadChatCount(prev => prev + 1);
      }
    });

    socket.on("message-updated", (updatedMsg: any) => {
      setMessages(prev => prev.map(m => m._id === updatedMsg._id ? { ...m, text: updatedMsg.text } : m));
    });

    socket.on("message-deleted", (messageId: string) => {
      setMessages(prev => prev.filter(m => m._id !== messageId));
    });

    socket.on("message-reacted", (updatedMsg: any) => {
      setMessages(prev => prev.map(m => m._id === updatedMsg._id ? { ...m, reactions: updatedMsg.reactions } : m));
    });

    socket.on("user-raised-hand", (payload: any) => {
      const isMyHand = payload.userID === (user?._id || (user as any)?.id) || payload.socketId === socket.id;
      const userName = payload.name || "A participant";
      if (payload.raised) {
        if (!isMyHand) {
          playSystemSound('hand');
        }
        
        // Secure unique hand raise state by using only a single key per user (userID or socketId)
        setRaisedHands(prev => {
          const key = payload.userID || payload.socketId;
          if (!key) return prev;
          if (prev.includes(key)) return prev;
          return [...prev, key];
        });
        
        const isUserPrivileged = 
          isHost || 
          meetingRole === 'admin' || 
          meetingRole === 'developer' || 
          meetingRole === 'host' || 
          user?.role === 'admin' || 
          user?.role === 'developer' || 
          user?.role === 'host' || 
          user?.role === 'co-admin';

        if (!isMyHand && isUserPrivileged) {
          toast(`${userName} raised their hand`, { icon: "✋" });
        }
      } else {
        setRaisedHands(prev => {
          const key = payload.userID || payload.socketId;
          return prev.filter(id => id !== key);
        });
      }
    });

    socket.on("receive-reaction", (payload: any) => {
      const id = Math.random().toString(36).substring(7);
      setReactions(prev => [...prev, { ...payload, id }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== id));
      }, 4000);
    });

    socket.on("poll-updated", (updatedPolls: any[]) => {
      setPolls(updatedPolls);
    });

    const handleForceMute = () => {
      setMicLocked(true);
      setMicActive(false);

      // 1. Mute RAW tracks
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      // 2. Mute PROCESSED tracks sent to peers
      if (processedStreamRef.current) {
        processedStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = false;
        });
      }
      // 3. Set Web Audio Pipeline gain to zero
      if (pipelineRef.current) {
        pipelineRef.current.updateSettings({ ...DEFAULT_MEDIA_SETTINGS, micBoost: 0, inputVolume: 0 });
      }

      if (socketRef.current) {
        socketRef.current.emit("user-muted", {
          roomID: code,
          userId: user?._id || (user as any)?.id
        });
        socketRef.current.emit("media-state-updated", {
          roomID: code,
          userId: user?._id || (user as any)?.id,
          isMuted: true,
          cameraEnabled: videoActive,
          handRaised: handRaised
        });
      }
      toast.error("You have been muted by the host", { icon: "🔇" });
    };

    const handleForceUnmute = () => {
      setMicLocked(false);
      setMicActive(true);

      // 1. Unmute RAW tracks
      if (streamRef.current) {
        streamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      // 2. Unmute PROCESSED tracks sent to peers
      if (processedStreamRef.current) {
        processedStreamRef.current.getAudioTracks().forEach(track => {
          track.enabled = true;
        });
      }
      // 3. Restore Web Audio Pipeline gain
      if (pipelineRef.current) {
        const savedSettings = localStorage.getItem('synora_media_settings');
        const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
        const boost = mediaSettings.micBoost ?? 1.0;
        const vol = mediaSettings.inputVolume ?? 1.0;
        pipelineRef.current.updateSettings({ ...mediaSettings, micBoost: boost, inputVolume: vol });
      }

      if (socketRef.current) {
        socketRef.current.emit("user-unmuted", {
          roomID: code,
          userId: user?._id || (user as any)?.id
        });
        socketRef.current.emit("media-state-updated", {
          roomID: code,
          userId: user?._id || (user as any)?.id,
          isMuted: false,
          cameraEnabled: videoActive,
          handRaised: handRaised
        });
      }
      toast.success("You have been unmuted by the host", { icon: "🎤" });
    };

    const handleForceCameraOff = () => {
      setCameraLocked(true);
      if (streamRef.current) {
        const videoTrack = streamRef.current.getVideoTracks()[0];
        if (videoTrack) videoTrack.enabled = false;
      }
      setVideoActive(false);
      if (socketRef.current) {
        socketRef.current.emit("camera-disabled", {
          roomID: code,
          userId: user?._id || (user as any)?.id
        });
        socketRef.current.emit("media-state-updated", {
          roomID: code,
          userId: user?._id || (user as any)?.id,
          isMuted: !micActive,
          cameraEnabled: false,
          handRaised: handRaised
        });
      }
      toast.error("Your camera has been disabled by the host", { icon: "🎥" });
    };

    const handleForceCameraOn = async () => {
      setCameraLocked(false);
      let videoTrack = streamRef.current?.getVideoTracks?.()[0];
      if (!videoTrack || videoTrack.readyState === "ended") {
        try {
          const freshStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoTrack = freshStream.getVideoTracks()[0];

          peersRef.current.forEach(p => {
            if (p.peer && p.peer._pc) {
              try {
                const senders = p.peer._pc.getSenders();
                const sender = senders.find((s: any) => s.track && s.track.kind === 'video');
                if (sender) sender.replaceTrack(videoTrack).catch(console.error);
              } catch (pcErr) {
                console.error("Failed to replaceTrack on peer:", pcErr);
              }
            }
          });

          const audioTrack = streamRef.current?.getAudioTracks()[0];
          if (audioTrack) {
            freshStream.addTrack(audioTrack);
          }
          streamRef.current = freshStream;

          if (userVideo.current) {
            userVideo.current.srcObject = freshStream;
          }
        } catch (err) {
          console.error("Failed to re-initialize camera track:", err);
        }
      }

      if (videoTrack) {
        videoTrack.enabled = true;
      }
      setVideoActive(true);

      if (socketRef.current) {
        socketRef.current.emit("camera-enabled", {
          roomID: code,
          userId: user?._id || (user as any)?.id
        });
        socketRef.current.emit("media-state-updated", {
          roomID: code,
          userId: user?._id || (user as any)?.id,
          isMuted: !micActive,
          cameraEnabled: true,
          handRaised: handRaised
        });
      }
      toast.success("Your camera has been enabled by the host", { icon: "📷" });
    };

    socket.on("force-mute", handleForceMute);
    socket.on("force-unmute", handleForceUnmute);
    socket.on("force-camera-off", handleForceCameraOff);
    socket.on("force-camera-on", handleForceCameraOn);

    socket.on("force-remove", () => {
      toast.error("You have been removed from the meeting");
      exitMeeting();
    });

    socket.on("force-exit", () => {
      toast.error("The meeting was deleted by the host");
      navigate("/dashboard");
    });

    socket.on("screen-share-start", (payload: any) => {
      console.log("[MeetingRoom] received screen-share-start", payload);
      if (payload && payload.screenSharers) {
        setScreenSharers(payload.screenSharers);
      }
      if (payload && payload.userId) {
        setActivePresenterId(payload.userId);
        
        // Find matching name in participants list or fallback
        const myIdStr = (user?._id || (user as any)?.id || '').toString();
        let name = "Someone";
        if (payload.userId === myIdStr) {
          name = "You";
        } else {
          const matched = participantsList.find(p => p.userId === payload.userId);
          if (matched && matched.name) {
            name = matched.name;
          } else {
            const tPeer = peers.find(p => {
              const part = participantsList.find(pl => pl.socketId === p.peerID);
              return part && part.userId === payload.userId;
            });
            if (tPeer) {
              const pUser = participantsList.find(pl => pl.socketId === tPeer.peerID);
              if (pUser && pUser.name) name = pUser.name;
            }
          }
        }
        toast.success(`${name} is now presenting`);
      }
    });

    socket.on("screen-share-stop", (payload: any) => {
      console.log("[MeetingRoom] received screen-share-stop", payload);
      if (payload && payload.screenSharers) {
        setScreenSharers(payload.screenSharers);
        const remaining = payload.screenSharers;
        if (remaining.length > 0) {
          if (payload.userId === activePresenterId) {
            setActivePresenterId(remaining[remaining.length - 1]);
          }
        } else {
          setActivePresenterId(null);
        }
      } else {
        setActivePresenterId(null);
      }
    });

    socket.on("permissions-updated", (payload: any) => {
      const isHost = (user?.role === 'admin') || user?.role === 'developer' || user?.role === 'co-admin' || user?._id === meetingDetails?.host || user?._id === (meetingDetails?.host as any)?._id || (user as any)?.id === meetingDetails?.host || (user as any)?.id === (meetingDetails?.host as any)?._id;

      if (payload.blockScreenShare !== undefined) {
        setIsScreenShareBlocked(payload.blockScreenShare);
        if (payload.blockScreenShare && isScreenSharing) {
          stopScreenShare();
          toast.error("Screen sharing has been disabled by the host");
        }
      }

      const { type, value } = payload;
      if (!isHost && type) {
        if (type === "mic") {
          if (streamRef.current) {
            streamRef.current.getAudioTracks().forEach((t: any) => t.enabled = value);
          }
          setMicActive(value);
          if (!value) {
            toast.error("Your microphone has been globally disabled by the host", { icon: "🔇" });
          } else {
            toast.success("Your microphone has been enabled by the host", { icon: "🎙️" });
          }
        }
        if (type === "camera") {
          if (streamRef.current) {
            streamRef.current.getVideoTracks().forEach((t: any) => t.enabled = value);
          }
          setVideoActive(value);
          if (!value) {
            toast.error("Your camera has been globally disabled by the host", { icon: "❌🎥" });
          } else {
            toast.success("Your camera has been enabled by the host", { icon: "🎥" });
          }
        }
        if (type === "screen") {
          setIsScreenShareBlocked(!value);
          if (!value && isScreenSharing) {
            stopScreenShare();
            toast.error("Screen sharing has been disabled by the host");
          } else if (value) {
            toast.success("Screen sharing has been enabled by the host");
          }
        }
        if (type === "chat") {
          setGlobalPermissions((prev: any) => ({ ...prev, allowChat: value }));
          if (!value && sidebarTab === 'chat') {
            setSidebarTab(null);
            toast.error("Chat has been disabled by the host");
          } else if (value) {
            toast.success("Chat has been enabled by the host");
          }
        }
      }
    });

    socket.on("audience-request", (data: { requesterName: string, requesterId: string, targetUserId: string, roomID: string, hostSocketId: string }) => {
      console.log("Received audience request from host:", data);
      const myId = user?._id || (user as any)?.id;
      if (data.targetUserId === myId) {
        setPendingAudienceRequest(data);
        toast(`Host ${data.requesterName} invited you to become an Audience!`, {
          duration: 10000,
          id: "audience-notif",
          icon: "👑"
        });
      }
    });

    socket.on("audience-accepted", (data: { targetUserId: string, hostId: string }) => {
      console.log("Audience nomination accepted!", data);
      const myId = user?._id || (user as any)?.id;
      if (data.targetUserId === myId && user) {
        updateAuthUser({ ...user, role: 'audience', audienceId: data.hostId });
        toast.success("You have accepted the invite! You are now a verified Audience.", { icon: "👑" });
      } else {
        toast.success("A new Audience has been verified in the session!", { icon: "⭐" });
      }
    });

    socket.on("audience-declined", (data: { targetUserName: string }) => {
      toast.error(`${data.targetUserName} declined the Audience invitation.`, { icon: "❌" });
    });

    socket.on("global-permissions-updated", (permissions: any) => {
      setGlobalPermissions(permissions);
      
      const isHost = (user?.role === 'admin') || user?.role === 'developer' || user?.role === 'co-admin' || user?._id === meetingDetails?.host || user?._id === (meetingDetails?.host as any)?._id || (user as any)?.id === meetingDetails?.host || (user as any)?.id === (meetingDetails?.host as any)?._id;
      
      if (!isHost) {
        if (!permissions.allowMicrophone && micActive) {
          if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) audioTrack.enabled = false;
          }
          setMicActive(false);
          toast.error("Microphone has been globally disabled");
        }
        
        if (!permissions.allowCamera && videoActive) {
          if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) videoTrack.enabled = false;
          }
          setVideoActive(false);
          toast.error("Camera has been globally disabled");
        }
        
        if (!permissions.allowChat && sidebarTab === 'chat') {
          setSidebarTab(null);
          toast.error("Chat has been disabled by the host");
        }
      }
    });

    const getMedia = async (meeting: any, computedRole: string, requestPermissions = false) => {
      try {
        const isSpectator = meeting?.isBroadcast && computedRole === 'participant';

        let stream = streamRef.current;
        if (!isSpectator) {
          if (!stream) {
            const savedSettings = localStorage.getItem('synora_media_settings');
            const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
            
            // Apply initial states
            if (mediaSettings.selectedMic) setActiveMicId(mediaSettings.selectedMic);
            if (mediaSettings.selectedCamera) setActiveCameraId(mediaSettings.selectedCamera);
            if (mediaSettings.selectedSpeaker) {
              setActiveSpeakerId(mediaSettings.selectedSpeaker);
              // Set sink IDs after a short delay to ensure elements are rendered
              setTimeout(() => {
                const mediaElements = document.querySelectorAll('video, audio');
                mediaElements.forEach((el: any) => {
                  if (el.setSinkId) el.setSinkId(mediaSettings.selectedSpeaker).catch(() => {});
                });
              }, 1000);
            }

            try {
              const constraints = getOptimizedConstraints(mediaSettings.selectedMic, mediaSettings.selectedCamera, mediaSettings);
              stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (err) {
              console.warn("Room enter optimized getUserMedia failed, trying standard fallback", err);
              try {
                stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
              } catch (err2) {
                try {
                  stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
                } catch (err3) {
                  try {
                    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                  } catch (err4) {
                    throw new Error("No camera or microphone access granted");
                  }
                }
              }
            }
            if (!isMountedRef.current || exitedRef.current) {
              if (stream) {
                stream.getTracks().forEach(track => {
                  track.stop();
                  track.enabled = false;
                });
              }
              return;
            }
            streamRef.current = stream;
          }

          // Apply saved videoActive / micActive states from lobby selections
          if (stream) {
            const videoTracks = stream.getVideoTracks();
            if (videoTracks.length > 0) {
              videoTracks[0].enabled = videoActive;
            }
            const audioTracks = stream.getAudioTracks();
            if (audioTracks.length > 0) {
              audioTracks[0].enabled = micActive;
            }
          }
        } else {
          // Viewer mode inside a broadcast: do not grab mic or camera!
          stream = null;
        }

        setHasPermissions(true);
        if (userVideo.current && stream) {
          userVideo.current.srcObject = stream;
        }

        socket.on("all-users", (users: string[]) => {
          const peers: any[] = [];
          users.forEach(userID => {
            if (peersRef.current.some(p => p.peerID === userID)) return;
            const sendingStream = processedStreamRef.current || (stream ? updateProcessedStream(stream) : null) || new MediaStream();
            const peer = createPeer(userID, socket.id!, sendingStream);
            if (isScreenSharing && screenStreamRef.current) {
              try {
                peer.addStream(screenStreamRef.current);
              } catch (err) {
                console.error("Failed to add screenStream to new peer in all-users:", err);
              }
            }
            peersRef.current.push({
              peerID: userID,
              peer,
            });
            peers.push({
              peerID: userID,
              peer,
            });
          });
          setPeers(peers);
        });

        socket.on("user-joined", (payload: any) => {
          if (!payload) return;
          const callerID = payload.callerID || (payload.user && (payload.user.userId || payload.user._id || payload.user.id));
          if (!callerID) return;

          if (payload.user) {
            setParticipants(prev => {
              const uId = payload.user.userId || payload.user._id || payload.user.id;
              if (!uId) return prev;
              const exists = prev.find(p => p.userId === uId || p.socketId === payload.user.socketId);
              if (exists) return prev;
              return [...prev, payload.user];
            });
          }

          // RENEGOTIATION HANDLER: If peer already exists in our ref, do not return early! 
          // Instead, feed the new signal (renegotiation offer) to Simple-Peer
          const existingPeerObj = peersRef.current.find(p => p.peerID === callerID);
          if (existingPeerObj) {
            try {
              existingPeerObj.peer.signal(payload.signal);
            } catch (sigErr) {
              console.error("Failing to signal existing peer during renegotiation:", sigErr);
            }
            return;
          }

          // ONLY trigger join sound and notification if this is a brand new peer connection!
          playSystemSound('join');
          toast.success("Someone joined the meeting", {
            icon: <UserCircle className="w-5 h-5 text-blue-500" />,
            position: 'top-right',
            style: { background: '#151921', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
          });

          const sendingStream = processedStreamRef.current || (stream ? updateProcessedStream(stream) : null) || new MediaStream();
          const peer = addPeer(payload.signal, callerID, sendingStream);
          if (isScreenSharing && screenStreamRef.current) {
            try {
              peer.addStream(screenStreamRef.current);
            } catch (err) {
              console.error("Failed to add screenStream to new peer in user-joined:", err);
            }
          }
          peersRef.current.push({
            peerID: callerID,
            peer,
          });
          setPeers(prev => {
            if (prev.some(p => p.peerID === callerID)) return prev;
            return [...prev, { peerID: callerID, peer }];
          });
        });

        socket.on("receiving-returned-signal", (payload: any) => {
          const item = peersRef.current.find(p => p.peerID === payload.id);
          if (item) item.peer.signal(payload.signal);
        });

        socket.on("user-left", (id: string) => {
          playSystemSound('leave');
          toast.error("Participant left", {
            icon: <LogOut className="w-5 h-5 text-red-500" />,
            position: 'top-right',
            style: { background: '#151921', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }
          });
          const peerObj = peersRef.current.find(p => p.peerID === id);
          if (peerObj) peerObj.peer.destroy();
          const remainPeers = peersRef.current.filter(p => p.peerID !== id);
          peersRef.current = remainPeers;
          setPeers(remainPeers);
          setRaisedHands(prev => prev.filter(hid => hid !== id));
        });
      } catch (err) {
        console.error("Failed to get user media", err);
        if (requestPermissions) {
          toast.error("Permissions still denied. Please check your browser settings.");
        } else {
          toast.error("Camera/Mic access denied. You can still use chat and reactions.");
        }
        setMicActive(false);
        setVideoActive(false);
        setHasPermissions(false);
      }
    };

    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        streamRef.current = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          track.stop();
          track.enabled = false;
        });
        screenStreamRef.current = null;
      }
      socket.disconnect();
    };
  }, [code]);

  const requestPermissionsAgain = async () => {
    try {
      const isSpectator = meetingDetails?.isBroadcast && meetingRole === 'participant';
      if (isSpectator) {
        setHasPermissions(true);
        toast.success("Joined as viewer (silent mode)");
        return;
      }
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setMicActive(true);
        setVideoActive(true);
      } catch (err) {
        console.warn("requestPermissionsAgain dual acquisition failed, trying single device fallbacks", err);
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          setMicActive(true);
          setVideoActive(false);
        } catch (err2) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            setMicActive(false);
            setVideoActive(true);
          } catch (err3) {
            throw new Error("No media devices granted");
          }
        }
      }
      if (!isMountedRef.current || exitedRef.current) {
        if (stream) {
          stream.getTracks().forEach(track => {
            track.stop();
            track.enabled = false;
          });
        }
        return;
      }
      streamRef.current = stream;
      setHasPermissions(true);
      if (userVideo.current) {
        userVideo.current.srcObject = stream;
      }
      toast.success("Access granted!");
      // Re-initialize peers if they were missing or failed
      // For simplicity, joining after permission is better, but here we just update existing stream
      peersRef.current.forEach(p => {
        if (p.peer && stream) {
          p.peer.addStream(stream);
        }
      });
    } catch (err) {
      toast.error("Permission request failed.");
    }
  };

  function createPeer(userToSignal: string, callerID: string, stream: MediaStream) {
    const savedSettings = localStorage.getItem('synora_media_settings');
    const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream,
      sdpTransform: (sdp) => optimizeSDP(sdp, mediaSettings)
    });

    peer.on("signal", signal => {
      socketRef.current.emit("sending-signal", { userToSignal, callerID, signal });
    });

    return peer;
  }

  function addPeer(incomingSignal: any, callerID: string, stream: MediaStream) {
    const savedSettings = localStorage.getItem('synora_media_settings');
    const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;

    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream,
      sdpTransform: (sdp) => optimizeSDP(sdp, mediaSettings)
    });

    peer.on("signal", signal => {
      socketRef.current.emit("returning-signal", { signal, callerID });
    });

    peer.signal(incomingSignal);
    return peer;
  }

  const toggleMic = () => {
    if (!hasPermissions) {
      requestPermissionsAgain();
      return;
    }
    if (micLocked) {
      toast.error("The host has muted your microphone");
      return;
    }
    const nextMicActive = !micActive;
    setMicActive(nextMicActive);

    // 1. Mute the RAW audio tracks
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = nextMicActive;
      });
    }

    // 2. Mute the PROCESSED audio tracks sent to peers
    if (processedStreamRef.current) {
      processedStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = nextMicActive;
      });
    }

    // 3. Set Web Audio Pipeline gain to zero when muted
    if (pipelineRef.current) {
      if (nextMicActive) {
        const savedSettings = localStorage.getItem('synora_media_settings');
        const mediaSettings = savedSettings ? JSON.parse(savedSettings) : DEFAULT_MEDIA_SETTINGS;
        const boost = mediaSettings.micBoost ?? 1.0;
        const vol = mediaSettings.inputVolume ?? 1.0;
        pipelineRef.current.updateSettings({ ...mediaSettings, micBoost: boost, inputVolume: vol });
      } else {
        pipelineRef.current.updateSettings({ ...DEFAULT_MEDIA_SETTINGS, micBoost: 0, inputVolume: 0 });
      }
    }

    if (socketRef.current) {
      socketRef.current.emit("media-state-updated", {
        roomID: code,
        userId: user?._id || (user as any)?.id,
        isMuted: !nextMicActive,
        cameraEnabled: videoActive,
        handRaised: handRaised
      });
    }
  };

  const toggleVideo = () => {
    if (!hasPermissions) {
      requestPermissionsAgain();
      return;
    }
    if (cameraLocked) {
      toast.error("The host has disabled your camera");
      return;
    }
    const nextVideoActive = !videoActive;
    setVideoActive(nextVideoActive);
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = nextVideoActive;
      }
    }
    if (socketRef.current) {
      socketRef.current.emit("media-state-updated", {
        roomID: code,
        userId: user?._id || (user as any)?.id,
        isMuted: !micActive,
        cameraEnabled: nextVideoActive,
        handRaised: handRaised
      });
    }
  };

  const toggleHandRaise = () => {
    const newState = !handRaised;
    setHandRaised(newState);
    if (socketRef.current) {
      socketRef.current.emit("raise-hand", { 
        roomID: code, 
        raised: newState,
        userID: user?._id || (user as any)?.id,
        socketId: socketRef.current.id,
        name: user?.name
      });
    }
    toast.success(newState ? "Hand raised" : "Hand lowered");

    // Award Raise Hand XP (+2 XP)
    if (newState) {
      api.post('/auth/xp/add', { action: 'raise_hand' })
        .catch(err => console.error("Error adding raise hand XP:", err));
    }
  };

  const toggleScreenShare = async () => {
    if (globalSettings?.screenShareEnabled === false && meetingRole !== 'admin') {
      toast.error("Screen sharing has been disabled globally by administrator");
      return;
    }
    if (isScreenShareBlocked) {
      toast.error("Screen sharing is currently disabled by the host");
      return;
    }
    if (isScreenSharing) {
      setShowScreenSourceModal(true);
      return;
    }
    startNewScreenShare();
  };

  const startNewScreenShare = async () => {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getDisplayMedia !== 'function') {
      toast.error("Screen sharing not supported in this environment.", {
        style: {
          background: '#0f172a',
          color: '#f87171',
          border: '1px solid rgba(248, 113, 113, 0.2)',
        }
      });
      return;
    }

    try {
      const requestedStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true
        }
      });
      if (!isMountedRef.current || exitedRef.current) {
        requestedStream.getTracks().forEach(t => t.stop());
        return;
      }
      const stream = requestedStream;
      
      // Stop old screen share tracks if they exist
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
      }
      
      screenStreamRef.current = stream;
      setIsScreenSharing(true);
      setShowScreenSourceModal(false);
      
      // Emit socket event to notify other users
      socketRef.current.emit("screen-share-start", {
        roomID: code,
        userId: user?._id || (user as any)?.id
      });
      
      // Add separate screen share stream to all peers instead of replacing the camera stream
      peersRef.current.forEach(p => {
        if (p.peer) {
          try {
            p.peer.addStream(stream);
          } catch (pcErr) {
            console.error("Failed to add screen share stream to peer:", pcErr);
          }
        }
      });

      // Mix screen/system audio into active pipeline if present
      if (pipelineRef.current && stream.getAudioTracks().length > 0) {
        pipelineRef.current.attachScreenAudio(stream);
        toast.success("Presentation started with high-fidelity system audio sharing!");
      } else {
        toast.success("Presentation started");
      }

      const videoTrack = stream.getVideoTracks()[0];
      videoTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share failed", err);
      toast.error("Screen sharing failed or was canceled.", {
        style: {
          background: '#0f172a',
          color: '#f87171',
          border: '1px solid rgba(248, 113, 113, 0.2)',
        }
      });
    }
  };

  const stopScreenShare = async () => {
    try {
      if (pipelineRef.current) {
        pipelineRef.current.detachScreenAudio();
      }

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
        const oldScreenStream = screenStreamRef.current;
        screenStreamRef.current = null;
        
        peersRef.current.forEach(p => {
          if (p.peer) {
            try {
              p.peer.removeStream(oldScreenStream);
            } catch (err) {
              console.error("Failed to remove screen stream from peer:", err);
            }
          }
        });
      }
      setIsScreenSharing(false);
      setShowScreenSourceModal(false);
      
      // Emit socket event to notify other users
      if (socketRef.current) {
        socketRef.current.emit("screen-share-stop", {
          roomID: code,
          userId: user?._id || (user as any)?.id
        });
      }
      
      toast.success("Presentation stopped");
    } catch (err) {
      console.error("Stop screen share error:", err);
    }
  };

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    const msgPayload = {
      roomID: code,
      text: message,
      userId: user?._id,
      senderName: user?.name,
      timestamp: new Date().toISOString()
    };

    socketRef.current.emit("send-message", msgPayload);
    setMessage('');

    // Award Chat Participation XP (+1 XP)
    api.post('/auth/xp/add', { action: 'chat_participation' })
      .catch(err => console.error("Error adding chat XP:", err));
  };

  const sendReaction = (emoji: string) => {
    if (globalSettings?.reactionsEnabled === false && meetingRole !== 'admin') {
      toast.error("Reactions are globally disabled by administrator");
      return;
    }
    socketRef.current.emit("emit-reaction", {
      roomID: code,
      emoji,
      senderName: user?.name
    });
    setShowEmojiPicker(false);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const isHost = meetingRole === 'host' || meetingRole === 'admin';

  // Compute unified list of all video/placeholder tiles to render ALWAYS above any return statement
  const allTiles = useMemo(() => {
    const tiles: any[] = [];
    const myIdStr = (user?._id || (user as any)?.id || '').toString();

    // 1. Render all active Screenshare Tiles first (they will appear prominently)
    screenSharers.forEach(sharingUserId => {
      if (sharingUserId === myIdStr) {
        // It's local screenshare
        tiles.push({
          key: "screen-local",
          id: "screen-local",
          type: "screen",
          tileType: "screen-share",
          isLocal: true,
          label: `${user?.name || 'You'} (Screen)`,
          stream: screenStreamRef.current,
          peer: null,
          isSharingScreen: true
        });
      } else {
        // Find matching remote peer
        const matchingPeer = peers.find(p => {
          const part = participantsList.find(pl => pl.socketId === p.peerID);
          return part && part.userId === sharingUserId;
        });
        if (matchingPeer) {
          const matchingPeerUser = participantsList.find(pl => pl.socketId === matchingPeer.peerID);
          tiles.push({
            key: `screen-remote-${sharingUserId}`,
            id: sharingUserId,
            type: "screen",
            tileType: "screen-share",
            isLocal: false,
            label: `${matchingPeerUser?.name || 'Participant'}'s Screen`,
            stream: null,
            peer: matchingPeer.peer,
            isSharingScreen: true
          });
        }
      }
    });

    // 2. Render normal camera Tiles for All participants (Local & Remote)
    
    // 2a. User view Tile (You)
    tiles.push({
      key: "camera-local",
      id: "camera-local",
      type: "camera",
      isLocal: true,
      label: `${user?.name || 'You'} (You)`,
      stream: streamRef.current,
      peer: null,
      isSharingScreen: isScreenSharing,
      isMuted: !micActive,
      cameraEnabled: videoActive,
      isCameraActive: videoActive,
      handRaised: handRaised,
      role: meetingRole
    });

    // 2b. Remote camera tiles
    peers.forEach((peer, idx) => {
      const part = participantsList.find(p => p.socketId === peer.peerID);
      const isPeerSharingScreen = part ? screenSharers.includes(part.userId) : false;
      tiles.push({
        key: `camera-remote-${peer.peerID}`,
        id: peer.peerID,
        type: "camera",
        isLocal: false,
        label: part?.name || `Participant ${idx + 1}`,
        stream: null,
        peer: peer.peer,
        isSharingScreen: isPeerSharingScreen,
        isMuted: part?.isMuted,
        cameraEnabled: part?.cameraEnabled !== false,
        role: part?.role,
        handRaised: raisedHands.includes(peer.peerID) || part?.handRaised === true,
        isSpotlight: layout === 'spotlight',
        isActive: activeSpeaker === peer.peerID
      });
    });

    return tiles;
  }, [peers, screenSharers, isScreenSharing, videoActive, micActive, participantsList, raisedHands, layout, activeSpeaker, user]);

  const spotlightTile = useMemo(() => {
    // 1. Prioritize screen share tiles with activePresenterId
    const screenTiles = allTiles.filter(t => t.type === 'screen');
    if (screenTiles.length > 0) {
      if (activePresenterId) {
        const matching = screenTiles.find(t => {
          if (t.isLocal) {
            const myIdStr = (user?._id || (user as any)?.id || '').toString();
            return myIdStr === activePresenterId;
          } else {
            return t.id === activePresenterId;
          }
        });
        if (matching) return matching;
      }
      // Fallback to first screen tile
      return screenTiles[0];
    }

    // 2. Prioritize active speaker (if remote and exists)
    const activeRemoteTile = allTiles.find(t => !t.isLocal && t.isActive);
    if (activeRemoteTile) return activeRemoteTile;

    // 3. Fallback to first remote peer camera
    const remoteCamTile = allTiles.find(t => !t.isLocal && t.type === 'camera');
    if (remoteCamTile) return remoteCamTile;

    // 4. Default to local camera
    return allTiles.find(t => t.isLocal && t.type === 'camera');
  }, [allTiles, activePresenterId, user]);

  const sideTiles = useMemo(() => {
    if (!spotlightTile) return allTiles;
    // Render everything else except the spotlight tile
    return allTiles.filter(t => t.key !== spotlightTile.key);
  }, [allTiles, spotlightTile]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center z-[200]">
        <div className="relative">
          <div className="w-24 h-24 rounded-full border-4 border-blue-600/20 border-t-blue-600 animate-spin" />
          <Loader2 className="w-8 h-8 text-blue-600 absolute inset-0 m-auto animate-pulse" />
        </div>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.3em] text-blue-500 animate-pulse">Initializing Secure Tunnel...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center z-[200] p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8 animate-in zoom-in duration-500">
          <XCircle className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-2">Unavailable</h2>
        <p className="text-slate-400 max-w-sm mb-12 text-sm leading-relaxed">{error}</p>
        <button 
          onClick={exitMeeting}
          className="px-10 py-4 bg-white hover:bg-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-[#0B0E14] shadow-xl shadow-white/10 transition-all active:scale-95"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center text-slate-200 z-[100] overflow-hidden">
        {/* Background Decorative elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-purple-600/10 blur-[120px] rounded-full animate-pulse delay-1000" />
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-5xl px-6 flex flex-col md:grid md:grid-cols-2 gap-12 items-center z-10"
        >
          {/* Preview Section */}
          <div className="w-full space-y-8">
              <div className="relative aspect-video bg-[#151921] rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl shadow-black/50 group">
                {videoActive ? (
                   hasPermissions ? (
                      <video muted ref={userVideo} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
                   ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-3xl px-6 text-center">
                         <AlertCircle className="w-12 h-12 text-red-500 mb-4 animate-bounce" />
                         <p className="text-sm font-black uppercase tracking-widest text-white">Camera Access Required</p>
                         <p className="text-[10px] text-slate-500 mt-2">Please allow camera / microphone permissions in your browser.</p>
                         <button onClick={requestPermissionsAgain} className="mt-4 px-6 py-2 bg-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest">Retry Permissions</button>
                      </div>
                   )
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/50 backdrop-blur-3xl">
                    <div className="w-24 h-24 rounded-full bg-slate-800 flex items-center justify-center text-4xl font-black text-slate-600 border-4 border-slate-800 shadow-xl">
                      {user?.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <p className="mt-4 text-xs font-black uppercase tracking-widest text-slate-500">Camera is off</p>
                  </div>
                )}
                
                {/* Overlay Controls */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-slate-950/80 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/5 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                  <button 
                    onClick={toggleMic} 
                    disabled={micLocked}
                    className={cn(
                      "p-3 rounded-xl transition-all", 
                      micLocked ? "bg-red-500/10 text-red-500/40 cursor-not-allowed opacity-40" : (micActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/20 text-red-500")
                    )}
                  >
                    {micActive ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                  </button>
                  <button 
                    onClick={toggleVideo} 
                    disabled={cameraLocked}
                    className={cn(
                      "p-3 rounded-xl transition-all", 
                      cameraLocked ? "bg-red-500/10 text-red-500/40 cursor-not-allowed opacity-40" : (videoActive ? "bg-white/10 hover:bg-white/20 text-white" : "bg-red-500/20 text-red-500")
                    )}
                  >
                    {videoActive ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                  </button>
                  <div className="w-[1px] h-6 bg-slate-800 mx-2" />
                  <button onClick={() => setSidebarTab('settings')} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all">
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
             </div>
             
             <div className="flex items-center justify-center gap-8">
                <div className="flex flex-col items-center gap-1">
                  <div className="flex gap-1 h-1.5 w-12 bg-slate-800 rounded-full overflow-hidden">
                    {[1,2,3].map(i => <div key={i} className={cn("flex-1", micActive ? "bg-emerald-500" : "bg-slate-700")} />)}
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Mic Level</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                   <div className="flex items-center gap-1">
                      <Shield className="w-3.5 h-3.5 text-emerald-500" />
                      <span className="text-[10px] font-bold text-slate-300">End-to-end encrypted</span>
                   </div>
                </div>
             </div>
          </div>

          {/* Action Section */}
          <div className="w-full max-w-md space-y-8 text-center md:text-left">
            <div className="space-y-4">
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-tight">
                {inWaitingRoom ? (
                  <>Waiting Room <span className="text-blue-500">Active</span></>
                ) : (
                  <>Ready to <span className="text-blue-500">Join?</span></>
                )}
              </h1>
              <div className="space-y-1">
                <p className="text-slate-400 font-medium text-lg">
                  {inWaitingRoom ? "The host has been notified. Please wait to be admitted." : (meetingDetails?.title || 'Video Sync Session')}
                </p>
                {!inWaitingRoom && (
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">{peers.length + 1} Participants in call</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-6">
              {inWaitingRoom ? (
                <div className="p-8 bg-blue-600/5 border border-blue-500/20 rounded-[2rem] flex flex-col items-center gap-6 animate-pulse">
                   <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                   </div>
                   <div className="text-center">
                     <p className="text-white font-black uppercase tracking-tighter text-xl">Waiting for Host...</p>
                     <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2 px-6">You'll be able to join as soon as the host accepts your request.</p>
                   </div>
                </div>
              ) : (
                <button 
                  onClick={joinMeeting}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white py-6 rounded-[2rem] text-xl font-black uppercase tracking-widest transition-all shadow-2xl shadow-blue-600/30 hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-4"
                >
                  Join Meeting
                  <ArrowRight className="w-6 h-6 border-2 border-white/30 rounded-full p-1" />
                </button>
              )}
              
              {!inWaitingRoom && (
                <div className="p-4 bg-slate-900/40 rounded-2xl border border-slate-800 flex items-center gap-4">
                   <div className="bg-blue-500/10 p-2 rounded-lg">
                      <Info className="w-4 h-4 text-blue-500" />
                   </div>
                   <p className="text-xs font-semibold text-slate-500 leading-relaxed text-left">
                     Make sure your background is clean and your audio is clear before joining.
                   </p>
                </div>
              )}
            </div>
            
            <button 
              onClick={exitMeeting}
              className="text-sm font-bold text-slate-500 hover:text-white transition-colors"
            >
              Go back to dashboard
            </button>
          </div>
        </motion.div>
        
        <AnimatePresence>
          {sidebarTab === 'settings' && (
             <div className="fixed inset-0 z-[200] flex justify-end">
                <motion.div 
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  className="w-full max-w-md bg-slate-950 border-l border-slate-800 h-full p-8 flex flex-col shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="text-xl font-black uppercase tracking-tighter text-white">Hardware Settings</h3>
                    <button onClick={() => setSidebarTab(null)} className="p-2 hover:bg-slate-800 rounded-xl">
                      <X className="w-6 h-6" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    <MediaTester 
                      onDevicesChanged={handleDevicesChanged} 
                    />
                  </div>
                </motion.div>
             </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Main Safe checks as requested
  if (isJoined) {
    if (!localStream && (videoActive || micActive)) {
      return (
        <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center text-slate-200 z-[100] gap-4">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-xl animate-pulse" />
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin relative" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Setting up media devices...</p>
        </div>
      );
    }

    if (!participants || participants.length === 0) {
      return (
        <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center text-slate-200 z-[100] gap-4">
          <div className="relative border border-white/5 p-4 rounded-full bg-[#151921]">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-slate-400">Joining meeting...</p>
        </div>
      );
    }
  }

  return (
    <div className="fixed inset-0 bg-[#0B0E14] flex flex-col text-slate-200 z-50 overflow-hidden">
      {/* Header */}
      <div className={cn(
        "px-6 py-4 items-center justify-between bg-[#0B0E14]/80 backdrop-blur-xl border-b border-white/5 z-40",
        (layout === 'spotlight' && screenSharers.length > 0) ? (isMeetingFullscreen ? "hidden" : "hidden md:flex") : "flex"
      )}>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20 text-white font-black text-xl">
             M
          </div>
          <div className="h-4 w-[1px] bg-white/10" />
          <div className="flex flex-col">
            <span className="text-xs font-black text-white font-mono tracking-widest">{formatTime(currentTime)}</span>
            <span className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em]">Live • {meetingDetails?.title}</span>
          </div>
        </div>

        {/* Middle Stats Bar / Meeting Info Indicators */}
        <div className="hidden lg:flex items-center gap-3.5 bg-slate-950/40 backdrop-blur-md px-4 py-2 border border-white/5 rounded-2xl shadow-inner shadow-black/30">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
            <span className="font-mono text-xs">{formatDuration(meetingDuration)}</span>
          </div>
          <div className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            <Users className="w-4 h-4 text-purple-400" />
            <span>{(participantsList?.length || 0) + 1} In Call</span>
          </div>
          <div className="w-[1px] h-3 bg-white/10" />
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-300">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>{connectionQuality === 'excellent' ? 'Excellent (82ms)' : connectionQuality === 'good' ? 'Good (125ms)' : 'Poor (280ms)'}</span>
          </div>
          {raisedHands.length > 0 && (
            <>
              <div className="w-[1px] h-3 bg-white/10" />
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-400 animate-bounce">
                <Hand className="w-4 h-4 text-amber-400 fill-amber-400/20" />
                <span>{raisedHands.length} Raised</span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex flex-col items-end">
             <div className="flex items-center gap-2">
                <Wifi className={cn("w-3.5 h-3.5", connectionQuality === 'excellent' ? "text-emerald-500" : connectionQuality === 'good' ? "text-yellow-500" : "text-red-500")} />
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Connection {connectionQuality}</span>
             </div>
             <p className="text-[9px] font-black text-slate-700 uppercase mt-0.5">End-to-End Encrypted</p>
          </div>
          
          <div className="h-8 w-[1px] bg-slate-800 hidden sm:block" />
          
          <div className="relative group">
            <button 
              className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 border border-white/10 flex items-center justify-center shadow-lg transition-all group-hover:scale-105"
            >
              <span className="text-sm font-black text-white">{user?.name?.charAt(0).toUpperCase()}</span>
            </button>
            <div className="absolute top-full right-0 mt-2 w-56 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 p-2">
               <div className="px-4 py-3 border-b border-white/5 mb-2">
                  <p className="text-xs font-black text-white uppercase tracking-tight">{user?.name}</p>
                  <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
               </div>
               <button 
                 onClick={() => setSidebarTab('settings')}
                 className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-300 transition-colors"
               >
                 <Settings className="w-4 h-4" />
                 Settings
               </button>
               <button 
                 className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-slate-300 transition-colors"
               >
                 <Shield className="w-4 h-4" />
                 Privacy
               </button>
               <div className="h-[1px] bg-white/5 my-2" />
               <button 
                 onClick={exitMeeting}
                 className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[11px] font-black uppercase tracking-widest text-red-500 transition-colors"
               >
                 <LogOut className="w-4 h-4" />
                 Sign Out
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {/* Host Lock Warning Banners */}
          {(micLocked || cameraLocked) && (
            <div className="px-6 pt-4 flex flex-col gap-2 z-30">
              <AnimatePresence>
                {micLocked && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="flex items-center gap-3 bg-[#1A1115] border border-red-500/20 text-red-400 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-950/10"
                  >
                    <MicOff className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
                    <span>Host muted your microphone</span>
                  </motion.div>
                )}
                {cameraLocked && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -10, height: 0 }}
                    className="flex items-center gap-3 bg-[#1A1115] border border-red-500/20 text-red-400 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-red-950/10"
                  >
                    <VideoOff className="w-4 h-4 text-red-500 flex-shrink-0 animate-pulse" />
                    <span>Host disabled your camera</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          <div 
            onMouseMove={resetMeetingControlsTimer}
            onMouseDown={resetMeetingControlsTimer}
            onClick={resetMeetingControlsTimer}
            onTouchStart={(e) => {
              handleTouchStartGlobal(e);
              resetMeetingControlsTimer();
            }}
            onTouchMove={(e) => {
              handleTouchMoveGlobal(e);
              resetMeetingControlsTimer();
            }}
            onTouchEnd={(e) => {
              handleTouchEndGlobal();
              resetMeetingControlsTimer();
            }}
            className={cn(
              "flex-1 flex items-center justify-center relative overflow-hidden transition-all duration-500",
              (layout === 'spotlight' && screenSharers.length > 0)
                ? (isMeetingFullscreen ? "p-0 pb-0 bg-[#08070b]" : "p-0 md:p-6 pb-0 md:pb-32 bg-[#08070b]")
                : "p-4 md:p-6 pb-24 md:pb-32"
            )}
          >
            <div className={cn(
               "w-full h-full transition-all duration-700 ease-in-out gap-4 md:gap-6",
               (layout === 'spotlight' && screenSharers.length > 0) ? "max-w-full m-0" : "max-w-7xl mx-auto",
               layout === 'grid' ? (
                 allTiles.length <= 1 ? "grid place-items-center max-w-4xl" : 
                 allTiles.length === 2 ? "grid grid-cols-1 md:grid-cols-2" : 
                 allTiles.length <= 4 ? "grid grid-cols-2" : "grid grid-cols-2 md:grid-cols-3"
               ) : "flex flex-col md:landscape:flex-row lg:flex-row gap-6",
             )}>
              {layout === 'grid' ? (
                allTiles?.map(t => (
                  <VideoTile
                    key={t.key}
                    type={t.type}
                    tileType={t.tileType}
                    isLocal={t.isLocal}
                    peer={t.peer}
                    stream={t.stream}
                    label={t.label}
                    handRaised={t.handRaised}
                    isSpotlight={false}
                    isActive={t.isActive}
                    isSharingScreen={t.isSharingScreen}
                    isCameraActive={t.isCameraActive}
                    cameraEnabled={t.cameraEnabled}
                    isMuted={t.isMuted}
                    role={t.role}
                    userVideo={userVideo}
                    visualEffect={visualEffect}
                    isEffectLoading={isEffectLoading}
                    onToggleFullscreen={toggleFullscreen}
                    isMeetingFullscreen={isMeetingFullscreen}
                  />
                ))
              ) : (
                <>
                  {spotlightTile && (
                    <div className="flex-1 order-1 md:landscape:order-1 lg:order-1 h-full min-h-[300px] flex flex-col">
                      <VideoTile
                        key={spotlightTile.key}
                        type={spotlightTile.type}
                        tileType={spotlightTile.tileType}
                        isLocal={spotlightTile.isLocal}
                        peer={spotlightTile.peer}
                        stream={spotlightTile.stream}
                        label={spotlightTile.label}
                        handRaised={spotlightTile.handRaised}
                        isSpotlight={true}
                        isActive={spotlightTile.isActive}
                        isSharingScreen={spotlightTile.isSharingScreen}
                        isCameraActive={spotlightTile.isCameraActive}
                        cameraEnabled={spotlightTile.cameraEnabled}
                        isMuted={spotlightTile.isMuted}
                        role={spotlightTile.role}
                        userVideo={userVideo}
                        visualEffect={visualEffect}
                        isEffectLoading={isEffectLoading}
                        onToggleFullscreen={toggleFullscreen}
                        isMeetingFullscreen={isMeetingFullscreen}
                      />
                    </div>
                  )}

                  {sideTiles.length > 0 && (
                    <div className={cn(
                      "transition-all duration-500 ease-in-out order-2 shrink-0 py-2",
                      isMeetingFullscreen 
                        ? "hidden" 
                        : "md:landscape:w-80 lg:w-80 md:landscape:flex lg:flex md:landscape:flex-col lg:flex-col",
                      "w-full flex-row gap-4 overflow-x-auto no-scrollbar",
                      showMobileParticipants 
                        ? "flex h-36 opacity-100 translate-y-0" 
                        : "hidden md:landscape:flex lg:flex h-0 opacity-0 translate-y-8 overflow-hidden py-0"
                    )}>
                      {sideTiles?.map(t => (
                        <div key={t.key} className="w-48 md:landscape:w-full lg:w-full shrink-0 aspect-video">
                          <VideoTile
                            key={t.key}
                            type={t.type}
                            tileType={t.tileType}
                            isLocal={t.isLocal}
                            peer={t.peer}
                            stream={t.stream}
                            label={t.label}
                            handRaised={t.handRaised}
                            isSpotlight={false}
                            isActive={t.isActive}
                            isSharingScreen={t.isSharingScreen}
                            isCameraActive={t.isCameraActive}
                            cameraEnabled={t.cameraEnabled}
                            isMuted={t.isMuted}
                            role={t.role}
                            userVideo={userVideo}
                            visualEffect={visualEffect}
                            isEffectLoading={isEffectLoading}
                            onToggleFullscreen={toggleFullscreen}
                            isMeetingFullscreen={isMeetingFullscreen}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Mobile swipe or tap indicator to reveal participants */}
            {layout === 'spotlight' && screenSharers.length > 0 && (
              <div className="block md:landscape:hidden lg:hidden absolute bottom-20 left-1/2 -translate-x-1/2 z-30">
                <button
                  type="button"
                  onClick={() => setShowMobileParticipants(prev => !prev)}
                  className="bg-slate-900/80 backdrop-blur-md border border-white/10 text-white rounded-full px-4 py-1.5 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-xl transition-all active:scale-95"
                >
                  <Users className="w-3.5 h-3.5 text-blue-400" />
                  <span>{showMobileParticipants ? "Hide Participants" : "Show Participants"}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebars Integrated into Layout */}
        <AnimatePresence>
          {sidebarTab && (
            <>
              {/* Sidebar Background Click Overlay */}
              <div 
                className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[140] cursor-pointer"
                onClick={() => setSidebarTab(null)}
              />
              <motion.aside 
                initial={{ x: 400, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 400, opacity: 0 }}
                className="fixed md:relative inset-y-0 right-0 w-full md:w-[320px] lg:w-[400px] border-l border-white/5 bg-[#0B0E14] flex flex-col z-[150] shadow-[-20px_0_50px_rgba(0,0,0,0.4)]"
              >
                {sidebarTab === 'chat' && (
                   <ChatSidebar 
                     messages={messages} 
                     user={user} 
                     sendMessage={sendMessage} 
                     message={message} 
                     setMessage={setMessage}
                     close={() => setSidebarTab(null)}
                     globalSettings={globalSettings}
                     userRole={userRole}
                   />
                )}
                {sidebarTab === 'people' && (
                   <PeopleSidebar 
                     peers={peers} 
                     user={user} 
                     raisedHands={raisedHands} 
                     handRaised={handRaised}
                     close={() => setSidebarTab(null)}
                     isHost={isHost}
                     socket={socketRef.current}
                     roomID={code}
                     isScreenShareBlocked={isScreenShareBlocked}
                     globalPermissions={globalPermissions}
                     waitingUsers={waitingUsers}
                     participantsList={participantsList}
                   />
                )}
                {sidebarTab === 'settings' && (
                  <SettingsSidebar 
                    close={() => setSidebarTab(null)} 
                    code={code} 
                    visualEffect={visualEffect}
                    setVisualEffect={setVisualEffect}
                    setIsEffectLoading={setIsEffectLoading}
                    noiseCancellation={noiseCancellation}
                    setNoiseCancellation={setNoiseCancellation}
                    showCaptions={showCaptions}
                    setShowCaptions={setShowCaptions}
                  />
                )}
                {sidebarTab === 'activities' && (
                  <ActivitiesSidebar 
                    close={() => setSidebarTab(null)}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    polls={polls}
                    setPolls={setPolls}
                    socket={socketRef.current}
                    roomID={code}
                    isHost={isHost}
                  />
                )}
                {sidebarTab === 'info' && (
                  <InfoSidebar 
                     close={() => setSidebarTab(null)}
                     code={code || ''}
                     meetingTitle={meetingDetails?.title || 'Meeting Session'}
                  />
                )}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Floating Control Bar */}
      <div className={cn(
        "fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 md:gap-3 bg-[#0B0E14]/40 backdrop-blur-2xl px-1.5 md:px-4 py-1.5 md:py-3 rounded-[2rem] border border-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] transition-all duration-500 hover:bg-[#0B0E14]/70 w-auto max-w-[98%] shrink-0",
        (layout === 'spotlight' && screenSharers.length > 0) && (
          showMeetingControls 
            ? "translate-y-0 opacity-100 scale-100" 
            : "translate-y-24 opacity-0 scale-95 pointer-events-none"
        )
      )}>
        <div className="flex items-center gap-0.5 md:gap-2 pr-1.5 md:pr-4 border-r border-white/5">
           <ControlButton 
             onClick={toggleMic} 
             active={micActive} 
             icon={micActive ? Mic : MicOff} 
             variant={!micActive ? 'danger' : 'secondary'} 
             hasMenu
             onMenuClick={() => setShowMicMenu(!showMicMenu)}
             showMenu={showMicMenu}
             menuContent={<MediaTester filter="audio" onDevicesChanged={handleDevicesChanged} />}
             disabled={micLocked}
           />
           <ControlButton 
             onClick={toggleVideo} 
             active={videoActive} 
             icon={videoActive ? Camera : CameraOff} 
             variant={!videoActive ? 'danger' : 'secondary'} 
             hasMenu
             onMenuClick={() => setShowCameraMenu(!showCameraMenu)}
             showMenu={showCameraMenu}
             menuContent={<MediaTester filter="video" onDevicesChanged={handleDevicesChanged} />}
             disabled={cameraLocked}
           />
        </div>

        <div className="flex items-center justify-center gap-0.5 md:gap-2 px-0.5 md:px-1">
          <div className="relative">
            {!isScreenSharing ? (
               <ControlButton 
                 onClick={toggleScreenShare} 
                 icon={ScreenShare} 
                 variant="secondary" 
                 className={cn(
                   "hidden sm:flex", 
                   (globalSettings?.screenShareEnabled === false && meetingRole !== 'admin') && "opacity-45 cursor-not-allowed"
                 )} 
               />
            ) : (
               <ControlButton onClick={toggleScreenShare} icon={Monitor} variant="primary" active />
            )}
            
            <AnimatePresence>
              {showScreenSourceModal && (
                <>
                  <div className="fixed inset-0 z-[110]" onClick={() => setShowScreenSourceModal(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-72 bg-slate-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-[120]"
                  >
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest px-4 py-2 border-b border-white/5 mb-2">Presentation Options</p>
                    <button 
                      onClick={startNewScreenShare}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-xs font-black uppercase tracking-widest text-white"
                    >
                      <MonitorUp className="w-4 h-4 text-blue-400" />
                      Present Something Else
                    </button>
                    <button 
                      onClick={stopScreenShare}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 rounded-xl transition-colors text-xs font-black uppercase tracking-widest text-red-500"
                    >
                      <XCircle className="w-4 h-4" />
                      Stop Presenting
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>

          <ControlButton onClick={() => toggleSidebar('people')} icon={Users} variant="secondary" active={sidebarTab === 'people'} badge={peers.length + 1} />
          <ControlButton onClick={() => toggleSidebar('chat')} icon={MessageSquare} variant="secondary" active={sidebarTab === 'chat'} badge={unreadChatCount} />
          <ControlButton onClick={toggleHandRaise} icon={Hand} variant={handRaised ? 'warning' : 'secondary'} active={handRaised} className="hidden sm:flex" />
          <ControlButton 
            onClick={() => {
              if (globalSettings?.reactionsEnabled === false && meetingRole !== 'admin') {
                toast.error("Reactions have been disabled globally by administrator");
                return;
              }
              setShowEmojiPicker(!showEmojiPicker);
            }} 
            icon={Smile} 
            variant="secondary" 
            active={showEmojiPicker} 
            className={cn(
              (globalSettings?.reactionsEnabled === false && meetingRole !== 'admin') && "opacity-45 cursor-not-allowed"
            )}
          />
          
          <div className="relative">
            <ControlButton 
              onClick={() => setShowMoreMenu(!showMoreMenu)} 
              icon={MoreHorizontal} 
              variant="secondary" 
              active={showMoreMenu} 
            />
            
            <AnimatePresence>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-[110]" onClick={() => setShowMoreMenu(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-full right-0 mb-4 w-60 bg-slate-900/95 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl z-[120]"
                  >
                    <button 
                      onClick={() => { setLayout(layout === 'grid' ? 'spotlight' : 'grid'); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-slate-300"
                    >
                      <LayoutGrid className="w-4 h-4 text-blue-400" />
                      {layout === 'grid' ? 'Spotlight View' : 'Grid View'}
                    </button>
                    
                    <button 
                      onClick={() => { toggleHandRaise(); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-slate-300 sm:hidden"
                    >
                      <Hand className="w-4 h-4 text-orange-400" />
                      Raise Hand
                    </button>

                    <button 
                      onClick={() => { setShowEmojiPicker(true); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-slate-300 sm:hidden"
                    >
                      <Smile className="w-4 h-4 text-emerald-400" />
                      Reactions
                    </button>

                    <button 
                      onClick={() => { toggleSidebar('activities'); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-slate-300"
                    >
                      <Zap className="w-4 h-4 text-orange-400" />
                      Activities
                    </button>

                    <button 
                      onClick={() => { toggleSidebar('info'); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-slate-300"
                    >
                      <Info className="w-4 h-4 text-indigo-400" />
                      Meeting Info
                    </button>

                    <div className="h-[1px] bg-white/5 my-2" />

                    <button 
                      onClick={() => { toggleSidebar('settings'); setShowMoreMenu(false); }}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 rounded-xl transition-colors text-[10px] font-black uppercase tracking-widest text-slate-300"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-1 md:gap-2 pl-1.5 md:pl-4 border-l border-white/5 shrink-0">
           <button 
             onClick={exitMeeting}
             className="px-2.5 sm:px-6 py-2 md:py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[8px] sm:text-[10px] transition-all hover:scale-105 active:scale-95 shadow-lg shadow-red-500/20 flex items-center gap-1.5 sm:gap-2 whitespace-nowrap min-w-fit"
           >
             <PhoneOff className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
             <span className="hidden sm:inline">Leave</span>
           </button>
        </div>
        
        {/* Emoji Picker Popup */}
        <AnimatePresence>
          {showEmojiPicker && (
            <>
              <div className="fixed inset-0 z-[100]" onClick={() => setShowEmojiPicker(false)} />
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 p-3 bg-black/60 backdrop-blur-3xl border border-white/10 rounded-3xl shadow-2xl flex gap-1 z-[110]"
              >
                {EMOJIS.map(e => (
                  <button key={e} onClick={() => sendReaction(e)} className="text-xl p-1.5 hover:bg-white/5 rounded-xl transition-all transform hover:scale-125">
                    {e}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      <ReactionOverlay reactions={reactions} />
      
      {/* Captions Overlay */}
      <AnimatePresence>
        {showCaptions && captionText && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[45] w-full max-w-2xl px-6"
          >
            <div className="bg-black/80 backdrop-blur-3xl px-6 py-4 rounded-2xl border border-white/10 text-center shadow-2xl">
              <p className="text-lg font-medium text-white/90 leading-tight">
                <span className="text-blue-400 font-black uppercase text-[10px] tracking-widest mr-2">Live</span>
                {captionText}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Presenter Status Overlay */}
      {isScreenSharing && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-40 bg-blue-600/90 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 shadow-2xl flex items-center gap-3 animate-pulse"
        >
          <div className="w-2 h-2 bg-white rounded-full animate-bounce" />
          <span className="text-white text-[10px] font-black uppercase tracking-widest">You are presenting</span>
          <button 
            onClick={stopScreenShare}
            className="ml-2 px-3 py-1 bg-white/20 hover:bg-white/40 rounded-lg text-[9px] font-black uppercase text-white transition-all shadow-sm"
          >
            Stop
          </button>
        </motion.div>
      )}

      {/* Audience Invitation Dialog Overlay */}
      <AnimatePresence>
        {pendingAudienceRequest && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-[#0F131C] border border-white/10 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden text-slate-200"
            >
              {/* Background gradient flare */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

              <div className="text-center space-y-6">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-2xl mx-auto shadow-xl shadow-purple-500/20">
                  👑
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-black text-white uppercase tracking-tight">Audience Invitation</h3>
                  <p className="text-slate-400 text-xs font-semibold leading-relaxed">
                    Meeting host <span className="text-purple-400 font-extrabold">{pendingAudienceRequest.requesterName}</span> wants to make you an <span className="text-purple-400 font-black uppercase text-[10px] bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/10">Audience</span>!
                  </p>
                </div>

                <div className="p-4 bg-slate-950/50 border border-white/5 rounded-2xl text-left text-[10px] font-bold text-slate-500 leading-relaxed uppercase tracking-wider space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full" />
                    <span>Assigns Audience tag to your account</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-[#8b5cf6] rounded-full" />
                    <span>Real-time presence and identity visual indicators</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => {
                      if (socketRef.current) {
                        socketRef.current.emit("decline-audience-request", {
                          hostSocketId: pendingAudienceRequest.hostSocketId,
                          targetUserName: user?.name || "Someone"
                        });
                      }
                      setPendingAudienceRequest(null);
                      toast.error("You declined the Audience invitation.");
                    }}
                    className="flex-1 py-3.5 bg-slate-900 border border-white/5 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all outline-none"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => {
                      if (socketRef.current) {
                        socketRef.current.emit("accept-audience-request", {
                          hostId: pendingAudienceRequest.requesterId,
                          targetUserId: pendingAudienceRequest.targetUserId,
                          roomID: pendingAudienceRequest.roomID
                        });
                      }
                      setPendingAudienceRequest(null);
                    }}
                    className="flex-1 py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/25 transition-all outline-none"
                  >
                    Accept & Upgrade
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
    </div>
  );
};

const VideoTile = (props: any) => {
  const ref = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isScreenTile = props.type === "screen" || props.tileType === "screen-share";
  const hideVideo = (props.isLocal && props.type === "camera" && !props.isCameraActive) ||
                    (props.type === "camera" && props.cameraEnabled === false);

  const stream = props.stream;
  const videoRef = (props.isLocal && props.type === 'camera' && props.userVideo) ? props.userVideo : ref;

  // Zoom and Pan states for screen sharing
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomTranslate, setZoomTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Touch cache for pinch and double-tap zoom
  const touchStartRef = useRef<{ dist: number; scale: number; lastTap: number }>({ dist: 0, scale: 1, lastTap: 0 });

  // Auto-hide controls and Presenter Banner initial timer
  const [showControls, setShowControls] = useState(true);
  const [isInitialPresenterBanner, setIsInitialPresenterBanner] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isFullscreen = props.isMeetingFullscreen || false;

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2800); // 2.8 seconds of inactivity before fading out controls
  };

  useEffect(() => {
    if (isScreenTile) {
      resetControlsTimer();
      setIsInitialPresenterBanner(true);
      const bannerTimer = setTimeout(() => {
        setIsInitialPresenterBanner(false);
      }, 3000); // Show prominent banner for 3 seconds, then collapse
      return () => {
        clearTimeout(bannerTimer);
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      };
    }
  }, [isScreenTile, props.stream]);

  useEffect(() => {
    if (hideVideo) return;
    if (!stream || !videoRef.current) return;

    videoRef.current.srcObject = stream;
  }, [stream, hideVideo]);

  useEffect(() => {
    if (hideVideo || stream || !props.peer) return;

    const handleStream = (s: MediaStream) => {
      if (videoRef.current && s) {
        if (props.type === 'screen' || props.tileType === 'screen-share') {
          // Screen tile wants the second stream if available
          if (props.peer._remoteStreams && props.peer._remoteStreams.length >= 2) {
            videoRef.current.srcObject = props.peer._remoteStreams[1];
          } else if (props.peer._remoteStreams && props.peer._remoteStreams.length === 1 && !props.peer._remoteStreams[0].getAudioTracks().length) {
            videoRef.current.srcObject = s;
          } else {
            videoRef.current.srcObject = s;
          }
        } else {
          // Camera tile wants the first stream
          if (props.peer._remoteStreams && props.peer._remoteStreams[0]) {
            videoRef.current.srcObject = props.peer._remoteStreams[0];
          } else {
            videoRef.current.srcObject = s;
          }
        }
      }
    };
    props.peer.on("stream", handleStream);

    // Initial load check
    if (props.peer._remoteStreams) {
      if (props.type === 'screen' || props.tileType === 'screen-share') {
        if (props.peer._remoteStreams[1] && videoRef.current) {
          videoRef.current.srcObject = props.peer._remoteStreams[1];
        } else if (props.peer._remoteStreams[0] && videoRef.current) {
          videoRef.current.srcObject = props.peer._remoteStreams[0];
        }
      } else {
        if (props.peer._remoteStreams[0] && videoRef.current) {
          videoRef.current.srcObject = props.peer._remoteStreams[0];
        }
      }
    }

    return () => {
      props.peer.off("stream", handleStream);
    };
  }, [props.peer, hideVideo, stream, props.type, props.tileType]);

  // Handle Fullscreen mode for the screen sharing tile
  const handleTileFullscreen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch(err => {
          console.error(`Error entering fullscreen: ${err.message}`);
        });
      } else {
        document.exitFullscreen();
      }
    }
  };

  // Mouse Wheel zooming
  const handleWheel = (e: React.WheelEvent) => {
    if (!isScreenTile) return;
    e.preventDefault();
    const delta = -e.deltaY;
    setZoomScale(prev => {
      const next = prev + delta * 0.002;
      return Math.max(1, Math.min(next, 5)); // Bound between 100% and 500%
    });
  };

  // Mouse Drag / Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isScreenTile || zoomScale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - zoomTranslate.x, y: e.clientY - zoomTranslate.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    // Calculate boundaries to prevent dragging completely out
    const maxPanX = (zoomScale - 1) * 200;
    const maxPanY = (zoomScale - 1) * 200;
    setZoomTranslate({
      x: Math.max(-maxPanX, Math.min(newX, maxPanX)),
      y: Math.max(-maxPanY, Math.min(newY, maxPanY))
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Touch Gestures: Pinch to zoom, Double tap zoom, and One-finger panning
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!isScreenTile) return;
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      touchStartRef.current.dist = dist;
      touchStartRef.current.scale = zoomScale;
    } else if (e.touches.length === 1) {
      const now = Date.now();
      if (now - touchStartRef.current.lastTap < 300) {
        // Toggle Zoom (1x vs 2.5x)
        setZoomScale(prev => {
          if (prev > 1) {
            setZoomTranslate({ x: 0, y: 0 });
            return 1;
          }
          return 2.5;
        });
        touchStartRef.current.lastTap = 0;
      } else {
        touchStartRef.current.lastTap = now;
        setIsDragging(true);
        setDragStart({ x: e.touches[0].clientX - zoomTranslate.x, y: e.touches[0].clientY - zoomTranslate.y });
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isScreenTile) return;
    if (e.touches.length === 2 && touchStartRef.current.dist > 0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const factor = dist / touchStartRef.current.dist;
      setZoomScale(Math.max(1, Math.min(touchStartRef.current.scale * factor, 5)));
    } else if (e.touches.length === 1 && isDragging) {
      const newX = e.touches[0].clientX - dragStart.x;
      const newY = e.touches[0].clientY - dragStart.y;
      const maxPanX = (zoomScale - 1) * 200;
      const maxPanY = (zoomScale - 1) * 200;
      setZoomTranslate({
        x: Math.max(-maxPanX, Math.min(newX, maxPanX)),
        y: Math.max(-maxPanY, Math.min(newY, maxPanY))
      });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current.dist = 0;
    setIsDragging(false);
  };

  if (hideVideo) {
    return (
      <div className={cn(
        "relative group aspect-video bg-[#11141e] rounded-3xl overflow-hidden border transition-all duration-500 shadow-2xl flex flex-col items-center justify-center",
        props.isSpotlight ? "ring-4 ring-blue-500/50 scale-[1.02] z-10" : "border-slate-800/40 hover:border-blue-500/30",
        props.isActive && "shadow-[0_0_40px_rgba(59,130,246,0.2)]"
      )}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1),transparent_70%)] animate-pulse" />
        
        {props.handRaised && (
          <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
            <motion.div 
              initial={{ scale: 0, y: -10 }} 
              animate={{ scale: 1, y: 0 }} 
              className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-xl shadow-lg text-[9px] font-black uppercase tracking-widest border border-amber-400/20 shadow-orange-500/20"
            >
              <span>✋ Hand Raised</span>
            </motion.div>
          </div>
        )}

        <div className="relative w-16 h-16 rounded-[2rem] bg-gradient-to-tr from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center text-xl font-bold text-slate-400 shadow-2xl">
          {props.label?.charAt(0).toUpperCase()}
          {props.isSharingScreen && (
            <span className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1.5 border border-slate-950">
              <Monitor className="w-3 h-3 text-white" />
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-3">
          {props.isSharingScreen ? "Presenting Screen" : "Camera Off"}
        </p>

        <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 z-10">
          <div className="flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-100">{props.label}</span>
             
             {/* Live Status Badges */}
             <div className="flex items-center gap-1 ml-1.5 shrink-0">
               {props.role === 'admin' ? (
                 <span className="text-[8px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-0.5">
                   <Shield className="w-2.5 h-2.5" /> Admin
                 </span>
               ) : props.role === 'host' ? (
                 <span className="text-[8px] bg-amber-500/30 text-amber-300 border border-amber-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-0.5">
                   <Crown className="w-2.5 h-2.5" /> Host
                 </span>
               ) : props.role === 'audience' ? (
                 <span className="text-[8px] bg-purple-500/30 text-purple-300 border border-purple-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-0.5">
                   <Sparkles className="w-2.5 h-2.5" /> Audience
                 </span>
               ) : null}

               {props.isMuted && (
                 <span className="p-0.5 bg-red-500/20 border border-red-500/20 text-red-400 rounded">
                   <MicOff className="w-2.5 h-2.5" />
                 </span>
               )}

               <span className="p-0.5 bg-red-500/20 border border-red-500/20 text-red-400 rounded">
                 <CameraOff className="w-2.5 h-2.5" />
               </span>

               {props.handRaised && (
                 <span className="p-0.5 bg-amber-500/20 border border-amber-500/20 text-amber-400 rounded animate-bounce">
                   <Hand className="w-2.5 h-2.5 fill-current" />
                 </span>
               )}
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      onWheel={isScreenTile ? (e) => { handleWheel(e); resetControlsTimer(); } : undefined}
      onMouseDown={isScreenTile ? (e) => { handleMouseDown(e); resetControlsTimer(); } : undefined}
      onMouseMove={isScreenTile ? (e) => { handleMouseMove(e); resetControlsTimer(); } : undefined}
      onMouseUp={isScreenTile ? (e) => { handleMouseUpOrLeave(); resetControlsTimer(); } : undefined}
      onMouseLeave={isScreenTile ? (e) => { handleMouseUpOrLeave(); resetControlsTimer(); } : undefined}
      onTouchStart={isScreenTile ? (e) => { handleTouchStart(e); resetControlsTimer(); } : undefined}
      onTouchMove={isScreenTile ? (e) => { handleTouchMove(e); resetControlsTimer(); } : undefined}
      onTouchEnd={isScreenTile ? () => { handleTouchEnd(); resetControlsTimer(); } : undefined}
      onClick={isScreenTile ? resetControlsTimer : undefined}
      className={cn(
        "relative group bg-[#0c0e14] overflow-hidden border transition-all duration-500 shadow-2xl flex flex-col items-center justify-center",
        isScreenTile 
          ? (props.isSpotlight 
              ? "w-full h-full flex-1 rounded-none md:rounded-3xl border-0 md:border border-slate-800/20"
              : "aspect-video w-full rounded-2xl border border-slate-800/40"
            )
          : "aspect-video rounded-3xl border-slate-800/40 hover:border-blue-500/30",
        isScreenTile ? "ring-2 ring-emerald-500/50 scale-[1.01] z-10 border-emerald-500/30" : (props.isSpotlight ? "ring-4 ring-blue-500/50 scale-[1.02] z-10" : ""),
        props.isActive && "shadow-[0_0_40px_rgba(59,130,246,0.2)]"
      )}
    >
      {props.isLocal && props.type === 'camera' ? (
        <div className="w-full h-full relative">
          <video 
            muted 
            ref={props.userVideo || ref} 
            autoPlay 
            playsInline 
            className={cn(
              "w-full h-full object-cover scale-x-[-1] transition-all duration-700",
              props.visualEffect === 'soft' && "brightness-110 contrast-95 saturate-110",
              props.visualEffect === 'glow' && "brightness-110 contrast-110 saturate-125 blur-[0.5px]",
              props.visualEffect === 'bw' && "grayscale contrast-125",
              props.visualEffect === 'beauty' && "brightness-105 contrast-95 saturate-110 blur-[0.2px] sepia-[0.1]"
            )} 
          />
          {props.visualEffect === 'blur' && (
            <div className="absolute inset-0 transition-all duration-500">
              <div 
                className="absolute inset-0 backdrop-blur-2xl" 
                style={{ 
                  WebkitMaskImage: 'radial-gradient(circle at center, transparent 35%, black 80%)',
                  maskImage: 'radial-gradient(circle at center, transparent 35%, black 80%)'
                }} 
              />
            </div>
          )}
          {props.isEffectLoading && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-20">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          )}
        </div>
      ) : (
        <video 
          playsInline 
          autoPlay 
          ref={ref} 
          className={cn(
            "w-full h-full select-none origin-center transform-gpu", 
            isScreenTile ? "object-contain bg-black/95 duration-100 ease-out" : "object-cover"
          )} 
          style={isScreenTile ? {
            transform: `scale(${zoomScale}) translate(${zoomTranslate.x / zoomScale}px, ${zoomTranslate.y / zoomScale}px)`,
            cursor: zoomScale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
          } : undefined}
        />
      )}

      {isScreenTile && (
        isInitialPresenterBanner ? (
          /* Prominent initial presenter banner (first 3s) */
          <div className={cn(
            "absolute top-6 left-6 bg-gradient-to-r from-emerald-600/95 to-teal-600/95 backdrop-blur-xl px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/30 z-20 flex items-center gap-3 transition-all duration-500",
            showControls ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
          )}>
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400"></span>
            </span>
            <Monitor className="w-4 h-4 text-emerald-100 animate-pulse" />
            <span className="text-[11px] font-black uppercase tracking-widest text-white leading-none">
              {props.label?.replace('\'s Screen', '')?.replace(' (Screen)', '')} is presenting
            </span>
          </div>
        ) : (
          /* Sleek, tiny floating badge/pill (shown after 3 seconds) */
          <div className={cn(
            "absolute top-6 left-6 bg-slate-950/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl shadow-md border border-white/5 z-20 flex items-center gap-2 transition-all duration-500",
            showControls ? "opacity-[0.7] translate-y-0 hover:opacity-100" : "opacity-0 -translate-y-4 pointer-events-none"
          )}>
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping inline-flex absolute h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400"></span>
            </span>
            <span className="text-[8px] font-black uppercase tracking-widest text-slate-300 leading-none">
              {props.label?.replace('\'s Screen', '')?.replace(' (Screen)', '')} presenting
            </span>
          </div>
        )
      )}

      {props.isActive && (
        <div className="absolute inset-x-0 top-0 h-1 bg-blue-500 animate-pulse" />
      )}

      <div className="absolute top-6 right-6 flex flex-col gap-2 z-10">
        {props.handRaised && (
          <motion.div 
            initial={{ scale: 0, y: -10 }} 
            animate={{ scale: 1, y: 0 }} 
            className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white px-3 py-1.5 rounded-xl shadow-lg text-[9px] font-black uppercase tracking-widest border border-amber-400/20 shadow-orange-500/20"
          >
            <span>✋ Hand Raised</span>
          </motion.div>
        )}
      </div>

      <div className={cn(
        "absolute bottom-6 left-6 flex items-center gap-2 bg-slate-950/60 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/5 z-10 transition-all duration-500",
        isScreenTile && (showControls ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4 pointer-events-none")
      )}>
        <div className="flex items-center gap-2">
           {props.isActive ? (
             /* Mini blue dancing sound wave for active speaker */
             <div className="flex items-end gap-0.5 h-3 shrink-0">
               <div className="w-[1.5px] h-2 bg-blue-400 animate-pulse" />
               <div className="w-[1.5px] h-3 bg-blue-400 animate-pulse [animation-delay:0.15s]" />
               <div className="w-[1.5px] h-1.5 bg-blue-400 animate-pulse [animation-delay:0.3s]" />
             </div>
           ) : (
             <div className="w-1.5 h-1.5 rounded-full bg-slate-500 shrink-0" />
           )}
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-100">{props.label}</span>

           {/* Live Status Badges */}
           <div className="flex items-center gap-1 ml-1.5 shrink-0">
             {props.role === 'admin' ? (
               <span className="text-[8px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-0.5">
                 <Shield className="w-2.5 h-2.5" /> Admin
               </span>
             ) : props.role === 'host' ? (
               <span className="text-[8px] bg-amber-500/30 text-amber-300 border border-amber-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-0.5">
                 <Crown className="w-2.5 h-2.5" /> Host
               </span>
             ) : props.role === 'audience' ? (
               <span className="text-[8px] bg-purple-500/30 text-purple-300 border border-purple-500/20 rounded px-1.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-0.5">
                 <Sparkles className="w-2.5 h-2.5" /> Audience
               </span>
             ) : null}

             {props.isMuted && (
               <span className="p-0.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded">
                 <MicOff className="w-2.5 h-2.5" />
               </span>
             )}

             {props.cameraEnabled === false && (
               <span className="p-0.5 bg-red-500/10 border border-red-500/20 text-red-500 rounded">
                 <CameraOff className="w-2.5 h-2.5" />
               </span>
             )}

             {props.handRaised && (
               <span className="p-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded animate-bounce">
                 <Hand className="w-2.5 h-2.5 fill-current" />
               </span>
             )}
           </div>
        </div>
      </div>

      {isScreenTile && (
        <div className={cn(
          "absolute bottom-24 md:bottom-28 left-1/2 -translate-x-1/2 bg-slate-900/35 backdrop-blur-[12px] px-2.5 py-1.5 text-slate-100 border border-white/5 flex items-center gap-1.5 z-40 shadow-2xl rounded-2xl transition-all duration-500",
          showControls ? "opacity-75 md:opacity-85 scale-100 translate-y-0 hover:opacity-100" : "opacity-0 scale-95 translate-y-4 pointer-events-none"
        )}>
          {/* Zoom Out Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomScale(prev => Math.max(1, prev - 0.25));
              resetControlsTimer();
            }}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 text-white font-bold flex items-center justify-center text-sm transition-all active:scale-90"
            title="Zoom Out (-)"
          >
            -
          </button>
          
          {/* Numeric scale */}
          <span className="text-xs font-mono font-bold text-slate-200 min-w-[50px] text-center select-none bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5">
            {Math.round(zoomScale * 100)}%
          </span>
          
          {/* Zoom In Button */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomScale(prev => Math.min(5, prev + 0.25));
              resetControlsTimer();
            }}
            className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 text-white font-bold flex items-center justify-center text-sm transition-all active:scale-90"
            title="Zoom In (+)"
          >
            +
          </button>
          
          <div className="w-[1px] h-6 bg-white/10 mx-1" />
          
          {/* Fit Screen Reset */}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setZoomScale(1);
              setZoomTranslate({ x: 0, y: 0 });
              resetControlsTimer();
            }}
            className="px-3.5 h-10 rounded-xl bg-white/5 hover:bg-white/15 text-white text-[11px] uppercase font-black tracking-wider transition-all active:scale-95 flex items-center justify-center"
          >
            Fit Screen
          </button>
          
          <div className="w-[1px] h-6 bg-white/10 mx-1" />
          
          {/* Maximize / Fullscreen button */}
          <button 
            type="button"
            onClick={(e) => {
              handleTileFullscreen(e);
              resetControlsTimer();
            }}
            className="px-3.5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] uppercase font-black tracking-wider transition-all active:scale-95 flex items-center gap-1.5 justify-center"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Fullscreen</span>
          </button>
        </div>
      )}
    </div>
  );
};

const ControlButton = ({ icon: Icon, onClick, active, variant = 'secondary', label, badge, className, hasMenu, onMenuClick, showMenu, menuContent, disabled }: any) => (
  <div className="relative">
    <div className="flex items-center">
      <button 
        onClick={onClick}
        disabled={disabled}
        className={cn(
          "flex flex-col items-center justify-center gap-1 group relative transition-all duration-300",
          disabled && "opacity-35 cursor-not-allowed",
          className
        )}
      >
        <div className={cn(
          "relative p-1.5 md:p-3 rounded-xl md:rounded-2xl transition-all transform group-active:scale-90",
          variant === 'danger' && "bg-red-500 text-white shadow-lg shadow-red-500/20",
          variant === 'secondary' && (active ? "bg-blue-600 text-white" : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"),
          variant === 'primary' && "bg-blue-600 text-white shadow-lg shadow-blue-600/20",
          variant === 'warning' && "bg-orange-500 text-white shadow-lg shadow-orange-500/20"
        )}>
          <Icon className="w-3.5 h-3.5 md:w-5 h-5" />
          {badge > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black min-w-4 h-4 px-1 rounded-full flex items-center justify-center border-2 border-black shadow-lg">
              {badge}
            </span>
          )}
        </div>
        {label && (
          <span className={cn(
            "hidden lg:block text-[8px] font-black uppercase tracking-widest transition-colors",
            active ? "text-blue-500" : "text-slate-500 group-hover:text-slate-400"
          )}>
            {label}
          </span>
        )}
      </button>
      
      {hasMenu && (
        <button 
          onClick={onMenuClick}
          className="ml-0.5 px-1 h-6 md:h-12 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-md transition-all self-center"
        >
          <ChevronDown className={cn("w-3 h-3 md:w-4 md:h-4 text-slate-500 transition-transform", showMenu && "rotate-180")} />
        </button>
      )}
    </div>

    <AnimatePresence>
      {showMenu && (
        <>
          <div className="fixed inset-0 z-[110]" onClick={onMenuClick} />
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 mb-3 w-64 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-2xl z-[120]"
          >
            {menuContent}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  </div>
);

const ChatSidebar = ({ messages, user, sendMessage, message, setMessage, close, globalSettings, userRole }: any) => {
  const isDisabled = globalSettings?.chatEnabled === false && userRole !== 'admin';
  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] border-l border-white/5">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Meeting Chat</h3>
        </div>
        <button onClick={close} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5"/></button>
      </div>
      
      <div className="flex-1 overflow-hidden flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scrollbar-hide">
          {messages.map((msg: any, i: number) => {
            const isOwn = msg.userId === user?._id;
            return (
              <div key={i} className={cn("flex flex-col", isOwn ? "items-end" : "items-start")}>
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1 px-1">{msg.senderName}</span>
                <div className={cn(
                  "px-5 py-3 rounded-2xl text-sm leading-relaxed max-w-[90%] font-medium",
                  isOwn ? "bg-blue-600 text-white rounded-tr-none shadow-xl shadow-blue-600/10" : "bg-slate-800 text-slate-200 rounded-tl-none"
                )}>
                  {msg.text}
                </div>
              </div>
            );
          })}
        </div>
        
        <div className="p-4 md:p-8 bg-[#0B0E14] border-t border-white/5">
          <form onSubmit={sendMessage} className="flex gap-2">
             <input 
               value={message}
               onChange={(e) => setMessage(e.target.value)}
               disabled={isDisabled}
               placeholder={isDisabled ? "Chat disabled by administrator" : "Type your message..."}
               className={cn(
                 "flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30",
                 isDisabled && "opacity-50 cursor-not-allowed"
               )}
             />
             <button 
               type="submit" 
               disabled={isDisabled}
               className={cn(
                 "p-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl shadow-lg shadow-blue-600/20 transition-all active:scale-95",
                 isDisabled && "opacity-50 cursor-not-allowed bg-slate-700 hover:bg-slate-700"
               )}
             >
               <Send className="w-5 h-5" />
             </button>
          </form>
          <div className="mt-6 flex flex-col items-center gap-1 opacity-40">
             <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Developed by Mayank Sharma</p>
             <div className="w-8 h-[1px] bg-white/10" />
          </div>
        </div>
      </div>
    </div>
  );
};

const PermissionToggle = ({ label, active, onClick, icon: Icon }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex items-center justify-between p-4 rounded-2xl border transition-all active:scale-[0.98]",
      active 
        ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-400" 
        : "bg-red-500/5 border-red-500/20 text-red-400"
    )}
  >
    <div className="flex items-center gap-3">
      <div className={cn(
        "p-2 rounded-xl",
        active ? "bg-emerald-500/10" : "bg-red-500/10"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[10px] font-black uppercase tracking-widest">{label}</span>
    </div>
    <div className={cn(
      "text-[8px] font-black uppercase px-2 py-1 rounded-md",
      active ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
    )}>
      {active ? 'Allowed' : 'Blocked'}
    </div>
  </button>
);

const PeopleSidebar = ({ 
  user, 
  raisedHands, 
  handRaised, 
  close, 
  isHost, 
  socket, 
  roomID, 
  isScreenShareBlocked, 
  globalPermissions,
  waitingUsers = [],
  participantsList = []
}: any) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'waiting'>('members');

  const handleModeration = (action: string, participantID: string) => {
    if (!socket || !user) return;
    const userId = user._id || user.id;
    const targetPat = participantsList.find((p: any) => p.socketId === participantID);
    const targetUserId = targetPat?.userId;

    if (action === 'mute') {
      socket.emit("force-mute", { participantID, targetUserId, roomID, userId });
    } else if (action === 'unmute') {
      socket.emit("force-unmute", { participantID, targetUserId, roomID, userId });
    } else if (action === 'video') {
      socket.emit("force-camera-off", { participantID, targetUserId, roomID, userId });
    } else if (action === 'video-enable') {
      socket.emit("force-camera-on", { participantID, targetUserId, roomID, userId });
    } else if (action === 'remove') {
      socket.emit("remove-participant", { participantID, roomID, userId });
    }
    setActiveMenuId(null);
  };

  const handleWaiting = (action: 'admit' | 'reject', w: any) => {
    if (!socket || !user) return;
    const userId = w.userId;
    const requesterId = user._id || user.id;
    if (action === 'admit') socket.emit("admit-user", { roomID, userId, requesterId });
    if (action === 'reject') socket.emit("reject-user", { roomID, userId, requesterId });
  };

  const toggleGlobalShare = () => {
    if (!socket || !user) return;
    const userId = user._id || user.id;
    socket.emit("block-screen-share", { roomID, block: !isScreenShareBlocked, userId });
  };

  const toggleGlobalPermission = (perm: string) => {
    if (!socket || !user) return;
    const userId = user._id || user.id;
    const updatedPermissions = {
      ...globalPermissions,
      [perm]: !globalPermissions[perm]
    };
    socket.emit("update-global-permissions", { roomID, permissions: updatedPermissions, userId });
  };

  const otherParticipants = [...participantsList]
    .filter(p => p.socketId !== socket?.id)
    .sort((a, b) => {
      const aRaised = raisedHands.includes(a.socketId) || raisedHands.includes(a.userId) || a.handRaised === true;
      const bRaised = raisedHands.includes(b.socketId) || raisedHands.includes(b.userId) || b.handRaised === true;
      if (aRaised && !bRaised) return -1;
      if (!aRaised && bRaised) return 1;
      return 0;
    });

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] border-l border-white/5">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">People</h3>
        <button onClick={close} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5"/></button>
      </div>

      {isHost && waitingUsers.length > 0 && (
        <div className="flex p-2 bg-slate-950 border-b border-white/5">
          <button 
            onClick={() => setActiveSubTab('members')}
            className={cn(
              "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeSubTab === 'members' ? "bg-white/5 text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Members ({participantsList.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('waiting')}
            className={cn(
              "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative",
              activeSubTab === 'waiting' ? "bg-white/5 text-white" : "text-slate-500 hover:text-slate-300"
            )}
          >
            Waiting ({waitingUsers.length})
            <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full animate-ping" />
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-4 scrollbar-hide">
        {activeSubTab === 'members' ? (
          <>
            {isHost && (
              <div className="space-y-4 mb-6">
                <div className="p-5 bg-blue-600/5 border border-blue-500/10 rounded-2xl flex flex-col gap-4">
                  <div className="flex items-center gap-3 border-b border-white/5 pb-3">
                    <Shield className="w-5 h-5 text-blue-500" />
                    <span className="text-[10px] font-black uppercase text-white tracking-widest">Meeting Security</span>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <PermissionToggle label="Screen Share" active={!isScreenShareBlocked} onClick={toggleGlobalShare} icon={Monitor} />
                    <PermissionToggle label="Microphone" active={globalPermissions.allowMicrophone} onClick={() => toggleGlobalPermission('allowMicrophone')} icon={Mic} />
                    <PermissionToggle label="Camera" active={globalPermissions.allowCamera} onClick={() => toggleGlobalPermission('allowCamera')} icon={Camera} />
                    <PermissionToggle label="Chat Access" active={globalPermissions.allowChat} onClick={() => toggleGlobalPermission('allowChat')} icon={MessageSquare} />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between p-5 bg-slate-900/40 rounded-[2rem] border border-white/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-[1.25rem] bg-blue-600 flex items-center justify-center text-sm font-black text-white">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-black uppercase tracking-tight">
                      {handRaised && <span className="text-amber-500 mr-1">✋</span>}
                      {user?.name} (You)
                    </p>
                    {user?.role && user.role !== 'user' && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border",
                        user.role === 'developer' && "bg-red-500/10 border-red-500/20 text-red-400",
                        user.role === 'admin' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                        user.role === 'co-admin' && "bg-teal-500/10 border-teal-500/20 text-teal-400",
                        user.role === 'audience' && "bg-purple-500/10 border-purple-500/20 text-purple-400",
                        user.role === 'host' && "bg-amber-500/10 border-amber-500/20 text-amber-400"
                      )}>
                        {user.role}
                      </span>
                    )}
                  </div>
                  <p className={cn("text-[10px] font-black uppercase tracking-widest", isHost ? "text-blue-500" : "text-slate-500")}>
                    {isHost ? 'Host' : 'Participant'}
                  </p>
                </div>
              </div>
              {handRaised && <Hand className="w-5 h-5 text-orange-500 fill-current" />}
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 px-1">Meeting Members</h4>
              {otherParticipants.length === 0 && (
                <div className="py-8 text-center text-slate-600 text-[10px] font-black uppercase tracking-widest opacity-40">
                  No other members yet
                </div>
              )}
              {otherParticipants?.map((p: any, i: number) => (
                <div key={p.socketId} className="flex items-center justify-between p-5 bg-slate-800/10 rounded-[2rem] border border-white/[0.02] relative">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-[1.25rem] bg-slate-900 border border-white/5 flex items-center justify-center text-sm font-black text-slate-500 uppercase">
                      {p.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-slate-300 font-bold">
                          {(raisedHands.includes(p.socketId) || raisedHands.includes(p.userId) || p.handRaised === true) && <span className="text-amber-500 mr-1">✋</span>}
                          {p.name || 'Anonymous'}
                        </p>
                        {p.role && p.role !== 'user' && (
                          <span className={cn(
                            "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border",
                            p.role === 'developer' && "bg-red-500/10 border-red-500/20 text-red-400",
                            p.role === 'admin' && "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
                            p.role === 'co-admin' && "bg-teal-500/10 border-teal-500/20 text-teal-400",
                            p.role === 'audience' && "bg-purple-500/10 border-purple-500/20 text-purple-400",
                            p.role === 'host' && "bg-amber-500/10 border-amber-500/20 text-amber-400"
                          )}>
                            {p.role}
                          </span>
                        )}
                      </div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-600">ID: {p.socketId.slice(0, 6)}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {raisedHands.includes(p.socketId) && <Hand className="w-5 h-5 text-orange-500 fill-current" />}
                    
                    {isHost && (
                      <div className="relative">
                        <button 
                          onClick={() => setActiveMenuId(activeMenuId === p.socketId ? null : p.socketId)}
                          className="p-2 hover:bg-white/5 rounded-xl text-slate-500"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        
                        <AnimatePresence>
                          {activeMenuId === p.socketId && (
                            <>
                              <div className="fixed inset-0 z-10" onClick={() => setActiveMenuId(null)} />
                              <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute right-full top-0 mr-2 w-48 bg-slate-900 border border-white/10 rounded-2xl p-2 shadow-2xl z-20"
                              >
                                {p.isMuted ? (
                                  <button onClick={() => handleModeration('unmute', p.socketId)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-300">
                                    <Mic className="w-4 h-4 text-emerald-500" /> Unmute Participant
                                  </button>
                                ) : (
                                  <button onClick={() => handleModeration('mute', p.socketId)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-300">
                                    <MicOff className="w-4 h-4 text-red-500" /> Mute Participant
                                  </button>
                                )}

                                {p.cameraEnabled === false ? (
                                  <button onClick={() => handleModeration('video-enable', p.socketId)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-300">
                                    <Camera className="w-4 h-4 text-emerald-500" /> Enable Camera
                                  </button>
                                ) : (
                                  <button onClick={() => handleModeration('video', p.socketId)} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-300">
                                    <CameraOff className="w-4 h-4 text-red-500" /> Stop Camera
                                  </button>
                                )}

                                {p.role !== 'audience' && (
                                  <button 
                                    onClick={() => {
                                      if (socket) {
                                        socket.emit("send-audience-request", {
                                          targetSocketId: p.socketId,
                                          targetUserId: p.userId,
                                          requesterName: user?.name,
                                          requesterId: user?._id || (user as any)?.id,
                                          roomID: roomID
                                        });
                                        toast.success(`Sent Audience nomination to ${p.name}!`, { icon: "✉️" });
                                      }
                                      setActiveMenuId(null);
                                    }} 
                                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 rounded-xl text-[10px] font-black uppercase text-slate-300"
                                  >
                                    <Sparkles className="w-4 h-4 text-purple-400" /> Make Audience
                                  </button>
                                )}
                                <div className="h-[1px] bg-white/5 my-1" />
                                <button onClick={() => { handleModeration('remove', p.socketId); socket.emit('reject-user', { roomID, userId: p.userId, requesterId: user._id || user.id }); }} className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase">
                                  <Trash2 className="w-4 h-4" /> Remove User
                                </button>
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-4">
             <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-blue-500" />
                <p className="text-[10px] font-bold text-slate-300">Users here are waiting for your approval to join the meeting.</p>
             </div>

             {waitingUsers.map((w: any) => (
                <div key={w.socketId} className="flex flex-col p-6 bg-slate-900 border border-white/5 rounded-[2rem] gap-6">
                   <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center text-xl font-black text-slate-400">
                        {w.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-white font-black text-lg tracking-tight leading-none">{w.name}</p>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Join Request Sent</p>
                      </div>
                   </div>

                   <div className="flex gap-2">
                      <button 
                        onClick={() => handleWaiting('reject', w)}
                        className="flex-1 py-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Reject
                      </button>
                      <button 
                        onClick={() => handleWaiting('admit', w)}
                        className="flex-3 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all font-mono"
                      >
                        ADMIT USER
                      </button>
                   </div>
                </div>
             ))}

             {waitingUsers.length === 0 && (
                <div className="py-20 text-center opacity-40">
                   <Users className="w-16 h-16 mx-auto mb-4 text-slate-700" />
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Waiting room is empty</p>
                </div>
             )}
          </div>
        )}
        
        <div className="mt-auto pt-8 flex flex-col items-center gap-1 opacity-40">
           <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Developed by Mayank Sharma</p>
           <div className="w-8 h-[1px] bg-white/10" />
        </div>
      </div>
    </div>
  );
};

const SettingsSidebar = ({ close, code, visualEffect, setVisualEffect, setIsEffectLoading, noiseCancellation, setNoiseCancellation, showCaptions, setShowCaptions }: any) => (
  <div className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] border-l border-white/5">
    <div className="p-8 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center">
          <Settings className="w-5 h-5 text-slate-400" />
        </div>
        <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Settings</h3>
      </div>
      <button onClick={close} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5"/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8 scrollbar-hide">
       <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Captions className="w-4 h-4 text-blue-500" />
            Accessibility
          </h4>
          <button 
            onClick={() => setShowCaptions(!showCaptions)}
            className={cn(
              "w-full flex items-center justify-between p-5 rounded-[2rem] border transition-all",
              showCaptions ? "bg-blue-600/10 border-blue-500/50 text-blue-400" : "bg-slate-900/40 border-white/5 text-slate-500 hover:bg-white/5"
            )}
          >
            <div className="flex flex-col items-start gap-1">
              <span className="text-[10px] font-black uppercase tracking-widest">Live Captions</span>
              <p className="text-[8px] opacity-60">Visual transcription of audio</p>
            </div>
            <div className={cn("w-10 h-5 rounded-full relative transition-colors duration-300", showCaptions ? "bg-blue-500" : "bg-slate-700")}>
              <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all duration-300", showCaptions ? "left-6" : "left-1")} />
            </div>
          </button>
       </div>

       <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            Video Filters
          </h4>
          <div className="grid grid-cols-2 gap-3">
             {[
               { id: 'none', label: 'None', icon: XCircle },
               { id: 'blur', label: 'Blur', icon: Sparkles },
               { id: 'glow', label: 'Glow', icon: Sparkles },
               { id: 'bw', label: 'B&W', icon: LayoutGrid },
               { id: 'beauty', label: 'Beauty', icon: Sparkles },
               { id: 'soft', label: 'Soft', icon: Sparkles },
             ].map((fx) => (
               <button
                 key={fx.id}
                 onClick={() => {
                    setIsEffectLoading(true);
                    setVisualEffect(fx.id as any);
                    setTimeout(() => setIsEffectLoading(false), 800);
                 }}
                 className={cn(
                   "p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all group",
                   visualEffect === fx.id 
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-400" 
                    : "bg-slate-900/40 border-white/5 text-slate-500 hover:bg-white/5"
                 )}
               >
                 <fx.icon className="w-5 h-5" />
                 <span className="text-[9px] font-black uppercase tracking-widest">{fx.label}</span>
               </button>
             ))}
          </div>
       </div>

       <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-emerald-500" />
            Noise Cancellation
          </h4>
          <div className="p-4 bg-slate-900/40 rounded-[2rem] border border-white/5 flex flex-col gap-1">
             {[
               { id: 'off', label: 'Off' },
               { id: 'low', label: 'Low' },
               { id: 'medium', label: 'Medium' },
               { id: 'high', label: 'High' },
               { id: 'auto', label: 'Auto Smart' },
             ].map((mode) => (
               <button
                 key={mode.id}
                 onClick={() => setNoiseCancellation(mode.id as any)}
                 className={cn(
                   "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all",
                   noiseCancellation === mode.id 
                    ? "bg-emerald-600/20 text-emerald-400" 
                    : "text-slate-500 hover:bg-white/5"
                 )}
               >
                 <span className="text-[10px] font-black uppercase tracking-widest">{mode.label}</span>
                 {noiseCancellation === mode.id && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />}
               </button>
             ))}
          </div>
       </div>

       <div className="mt-auto pt-8 flex flex-col items-center gap-1 opacity-40">
         <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Developed by Mayank Sharma</p>
         <div className="w-8 h-[1px] bg-white/10" />
      </div>
    </div>
  </div>
);

const ActivitiesSidebar = ({ close, activeTab, setActiveTab, polls, setPolls, isHost, socket, roomID }: any) => {
  const [votedPolls, setVotedPolls] = useState<Record<string, number[]>>({});
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);

  const handleVote = (pollId: string, optionIdx: number) => {
    const poll = polls.find((p: any) => p.id === pollId);
    if (!poll || !poll.active) return;
    
    const currentVotes = votedPolls[pollId] || [];
    let updatedPolls = [...polls];
    
    if (currentVotes.includes(optionIdx)) {
      // Unvote
      setVotedPolls(prev => ({ 
        ...prev, 
        [pollId]: prev[pollId].filter(id => id !== optionIdx) 
      }));
      updatedPolls = updatedPolls.map((p: any) => {
        if (p.id === pollId) {
          const newVotes = [...p.votes];
          newVotes[optionIdx] = Math.max(0, newVotes[optionIdx] - 1);
          return { ...p, votes: newVotes };
        }
        return p;
      });
    } else {
      // Vote
      if (!poll.isMultipleChoice && currentVotes.length > 0) {
        // Switch vote for single choice
        const oldIdx = currentVotes[0];
        setVotedPolls(prev => ({ ...prev, [pollId]: [optionIdx] }));
        updatedPolls = updatedPolls.map((p: any) => {
          if (p.id === pollId) {
            const newVotes = [...p.votes];
            newVotes[oldIdx] = Math.max(0, newVotes[oldIdx] - 1);
            newVotes[optionIdx] += 1;
            return { ...p, votes: newVotes };
          }
          return p;
        });
      } else {
        // Add vote
        setVotedPolls(prev => ({ ...prev, [pollId]: [...(prev[pollId] || []), optionIdx] }));
        updatedPolls = updatedPolls.map((p: any) => {
          if (p.id === pollId) {
            const newVotes = [...p.votes];
            newVotes[optionIdx] += 1;
            return { ...p, votes: newVotes };
          }
          return p;
        });
      }
    }
    
    setPolls(updatedPolls);
    if (socket) socket.emit("update-polls", { roomID, polls: updatedPolls });
    toast.success("Vote recorded!");
  };

  const createPoll = () => {
    const filteredOptions = newPollOptions.filter(opt => opt.trim() !== '');
    if (!newPollQuestion.trim() || filteredOptions.length < 2) {
      toast.error("Please provide a question and at least 2 options");
      return;
    }
    const newPoll = {
      id: Math.random().toString(36).substr(2, 9),
      question: newPollQuestion,
      options: filteredOptions,
      votes: filteredOptions.map(() => 0),
      active: true,
      isMultipleChoice,
      timestamp: Date.now()
    };
    
    const updatedPolls = [newPoll, ...polls];
    setPolls(updatedPolls);
    if (socket) socket.emit("update-polls", { roomID, polls: updatedPolls });
    
    setShowCreatePoll(false);
    setNewPollQuestion('');
    setNewPollOptions(['', '']);
    setIsMultipleChoice(false);
    toast.success("Poll launched live!");
  };

  const deletePoll = (pollId: string) => {
    const updatedPolls = polls.filter((p: any) => p.id !== pollId);
    setPolls(updatedPolls);
    if (socket) socket.emit("update-polls", { roomID, polls: updatedPolls });
    toast.success("Poll removed");
  };

  const endPoll = (pollId: string) => {
    const updatedPolls = polls.map((p: any) => 
      p.id === pollId ? { ...p, active: false } : p
    );
    setPolls(updatedPolls);
    if (socket) socket.emit("update-polls", { roomID, polls: updatedPolls });
    toast.success("Poll ended");
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0B0E14] border-l border-white/5">
      <div className="p-8 border-b border-white/5 flex items-center justify-between">
        <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Activities</h3>
        <button onClick={close} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5 text-slate-400"/></button>
      </div>
      
      <div className="flex gap-1 p-4 bg-slate-950">
        <button 
          onClick={() => setActiveTab('polls')}
          className={cn(
            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1",
            activeTab === 'polls' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-900/40 text-slate-500 hover:bg-white/5"
          )}
        >
          <BarChart3 className={cn("w-4 h-4", activeTab === 'polls' ? "text-white" : "text-blue-500")} />
          Polls
        </button>
        <button 
          onClick={() => setActiveTab('whiteboard')}
          className={cn(
            "flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1",
            activeTab === 'whiteboard' ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-slate-900/40 text-slate-500 hover:bg-white/5"
          )}
        >
          <PenTool className={cn("w-4 h-4", activeTab === 'whiteboard' ? "text-white" : "text-emerald-500")} />
          Board
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 space-y-6 scrollbar-hide">
        {activeTab === 'polls' ? (
          <div className="space-y-6">
            {showCreatePoll ? (
               <motion.div 
                 initial={{ opacity: 0, y: 10 }}
                 animate={{ opacity: 1, y: 0 }}
                 className="bg-slate-900/40 rounded-[2rem] border border-blue-500/30 p-6 space-y-4"
               >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-blue-400">New Poll</h4>
                    <button onClick={() => setShowCreatePoll(false)} className="text-slate-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <input 
                    placeholder="Ask something..."
                    value={newPollQuestion}
                    onChange={e => setNewPollQuestion(e.target.value)}
                    className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-white transition-all"
                  />
                  <div className="space-y-2">
                    {newPollOptions.map((opt, i) => (
                      <div key={i} className="relative group">
                        <input 
                          placeholder={`Option ${i+1}`}
                          value={opt}
                          onChange={e => {
                            const next = [...newPollOptions];
                            next[i] = e.target.value;
                            setNewPollOptions(next);
                          }}
                          className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3 pr-10 text-xs focus:ring-1 focus:ring-blue-500 outline-none text-white"
                        />
                        {newPollOptions.length > 2 && (
                          <button 
                            onClick={() => setNewPollOptions(newPollOptions.filter((_, idx) => idx !== i))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-red-500/10 rounded-lg text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {newPollOptions.length < 6 && (
                      <button 
                        onClick={() => setNewPollOptions([...newPollOptions, ''])}
                        className="w-full py-3 border border-dashed border-white/5 rounded-xl text-[8px] font-black uppercase text-slate-500 tracking-widest hover:border-blue-500/50 hover:text-blue-400 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" />
                        Add Option
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-950 border border-white/5 rounded-xl">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Allow multiple Selection</span>
                    <button 
                      onClick={() => setIsMultipleChoice(!isMultipleChoice)}
                      className={cn(
                        "w-10 h-5 rounded-full transition-colors relative",
                        isMultipleChoice ? "bg-blue-600" : "bg-slate-800"
                      )}
                    >
                      <motion.div 
                        animate={{ x: isMultipleChoice ? 20 : 4 }}
                        className="w-3 h-3 bg-white rounded-full absolute top-1"
                      />
                    </button>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button onClick={() => setShowCreatePoll(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-white transition-all">Cancel</button>
                    <button onClick={createPoll} className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-blue-500/20 transition-all active:scale-95">Create Poll</button>
                  </div>
               </motion.div>
            ) : (
              isHost && (
                <button 
                  onClick={() => setShowCreatePoll(true)}
                  className="w-full py-4 bg-blue-600/10 hover:bg-blue-600/20 rounded-2xl border border-blue-500/20 text-[10px] font-black uppercase tracking-widest text-blue-400 flex items-center justify-center gap-2 transition-all group"
                >
                  <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  Create poll
                </button>
              )
            )}

            {polls.length === 0 && !showCreatePoll && (
              <div className="py-20 text-center opacity-40">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 text-slate-600" />
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No active polls</p>
              </div>
            )}

            {polls.map((poll: any) => {
              const totalVotes = poll.votes.reduce((a: number, b: number) => a + b, 0);
              const userVotes = votedPolls[poll.id] || [];
              const hasVoted = userVotes.length > 0;

              return (
                <motion.div 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  key={poll.id} 
                  className={cn(
                    "rounded-[2rem] border p-6 space-y-4 relative group transition-opacity",
                    poll.active ? "bg-slate-900/40 border-white/5" : "bg-slate-950/20 border-white/[0.02] opacity-75"
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <BarChart3 className={cn("w-4 h-4", poll.active ? "text-blue-500" : "text-slate-500")} />
                        <h4 className="text-xs font-black uppercase tracking-tight text-white">{poll.question}</h4>
                      </div>
                      <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 ml-6">
                        {poll.active ? "Active" : "Closed"} • {poll.isMultipleChoice ? "Multiple Select" : "Single Select"}
                      </p>
                    </div>
                    {isHost && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {poll.active && (
                          <button 
                            onClick={() => endPoll(poll.id)}
                            className="p-2 hover:bg-orange-500/10 rounded-xl text-orange-500 transition-all"
                            title="End Poll"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => deletePoll(poll.id)}
                          className="p-2 hover:bg-red-500/10 rounded-xl text-red-500 transition-all"
                          title="Delete Poll"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {poll.options.map((option: string, idx: number) => {
                      const count = poll.votes[idx];
                      const percentage = totalVotes === 0 ? 0 : Math.round((count / totalVotes) * 100);
                      const isSelected = userVotes.includes(idx);

                      return (
                        <button 
                          key={idx} 
                          disabled={!poll.active}
                          onClick={() => handleVote(poll.id, idx)}
                          className="w-full group/option text-left disabled:cursor-default"
                        >
                          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-widest mb-1 px-1">
                            <span className={cn(isSelected ? "text-blue-400" : "text-slate-400")}>
                              {option} 
                              {isSelected && <Check className="w-2.5 h-2.5 inline ml-1.5" />}
                            </span>
                            <span className="text-slate-500">{percentage}% ({count})</span>
                          </div>
                          <div className={cn(
                            "h-3 w-full bg-slate-950 rounded-full overflow-hidden border transition-all",
                            isSelected ? "border-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.1)]" : "border-white/5"
                          )}>
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${percentage}%` }}
                              className={cn(
                                "h-full transition-colors",
                                isSelected ? "bg-blue-600" : "bg-slate-700"
                              )}
                            />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-white/5">
                    <p className="text-[8px] font-black uppercase text-slate-600 tracking-widest">{totalVotes} participants voted</p>
                    {hasVoted && (
                      <span className="text-[8px] font-black uppercase text-blue-500 tracking-widest">You Voted</span>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <Whiteboard />
        )}
      </div>
      <div className="mt-auto py-8 flex flex-col items-center gap-1 opacity-40">
         <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Developed by Mayank Sharma</p>
         <div className="w-8 h-[1px] bg-white/10" />
      </div>
    </div>
  );
};

const Whiteboard = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#3b82f6');
  const [isEraser, setIsEraser] = useState(false);
  const [lineWidth, setLineWidth] = useState(3);
  const [history, setHistory] = useState<string[]>([]);

  const saveToHistory = () => {
    if (canvasRef.current) {
      setHistory(prev => [...prev, canvasRef.current!.toDataURL()]);
    }
  };

  const undo = () => {
    if (history.length === 0 || !canvasRef.current) return;
    
    const newHistory = [...history];
    newHistory.pop(); // Remove current state
    setHistory(newHistory);

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    if (newHistory.length > 0) {
      const img = new Image();
      img.src = newHistory[newHistory.length - 1];
      img.onload = () => {
        ctx.drawImage(img, 0, 0);
      };
    }
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    saveToHistory();
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      canvasRef.current.getContext('2d')?.beginPath();
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    let x, y;
    
    if ('clientX' in e) {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    } else {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    }

    ctx.lineWidth = isEraser ? lineWidth * 4 : lineWidth;
    ctx.lineCap = 'round';
    ctx.strokeStyle = isEraser ? '#ffffff' : color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#000000'];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 p-3 bg-slate-900/60 rounded-2xl border border-white/5">
        <div className="flex gap-1.5 pr-3 border-r border-white/10">
          {COLORS.map(c => (
            <button 
              key={c}
              onClick={() => { setColor(c); setIsEraser(false); }}
              className={cn(
                "w-6 h-6 rounded-full border-2 transition-all hover:scale-110",
                color === c && !isEraser ? "border-white scale-110" : "border-transparent"
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button 
            onClick={() => setIsEraser(true)}
            className={cn(
              "p-2 rounded-lg transition-all",
              isEraser ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-white/5"
            )}
            title="Eraser"
          >
            <Eraser className="w-4 h-4" />
          </button>
          <button 
            onClick={undo}
            disabled={history.length === 0}
            className={cn(
              "p-2 transition-all",
              history.length > 0 ? "text-slate-400 hover:text-blue-400" : "text-slate-700 cursor-not-allowed"
            )}
            title="Undo"
          >
            <RotateCcw className="w-4 h-4 scale-x-[-1]" />
          </button>
          <button 
            onClick={() => {
              saveToHistory();
              const canvas = canvasRef.current;
              const ctx = canvas?.getContext('2d');
              if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
              toast.success("Board cleared");
            }}
            className="p-2 text-slate-400 hover:text-red-500 transition-all"
            title="Clear All"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-slate-900/40 rounded-[2rem] border border-white/5 p-4 overflow-hidden relative">
        <canvas 
          ref={canvasRef}
          width={400}
          height={550}
          onMouseDown={startDrawing}
          onMouseUp={stopDrawing}
          onMouseMove={draw}
          onTouchStart={startDrawing}
          onTouchEnd={stopDrawing}
          onTouchMove={draw}
          className="bg-white rounded-2xl cursor-crosshair w-full aspect-[4/5.5]"
        />
        {isEraser && (
          <div className="absolute top-8 right-8 bg-blue-500 text-white text-[8px] font-black uppercase px-2 py-1 rounded-full animate-bounce">
            Eraser Active
          </div>
        )}
      </div>
      
      <div className="px-4 py-2 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-between">
        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Brush Size</span>
        <input 
          type="range" 
          min="1" 
          max="20" 
          value={lineWidth} 
          onChange={(e) => setLineWidth(parseInt(e.target.value))}
          className="w-32 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
};

const InfoSidebar = ({ close, code, meetingTitle }: any) => (
  <div className="flex-1 flex flex-col overflow-hidden">
    <div className="p-8 border-b border-white/5 flex items-center justify-between">
      <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Meeting Details</h3>
      <button onClick={close} className="p-2 hover:bg-white/5 rounded-xl"><X className="w-5 h-5"/></button>
    </div>
    <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide">
       <div className="space-y-2">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Joining Info</h4>
          <p className="text-xl font-black text-white tracking-tight">{meetingTitle}</p>
       </div>
       
       <div className="p-6 bg-slate-900/40 rounded-[2rem] border border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[8px] font-black text-blue-400 uppercase tracking-[0.2em]">Verified Host</p>
            <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest">Mayank Sharma</p>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Passcode</p>
            <p className="text-xl font-black text-white font-mono tracking-tighter">{code}</p>
          </div>
          <button 
            onClick={() => { navigator.clipboard.writeText(code); toast.success("Passcode copied!"); }}
            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
          >
            <Copy className="w-3.5 h-3.5" />
            Copy Code
          </button>
          <button 
            onClick={() => { 
              navigator.clipboard.writeText(window.location.href); 
              toast.success("Link copied!"); 
            }}
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            Copy Invite Link
          </button>
       </div>

       <div className="space-y-4">
          <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Security</h4>
          <div className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
             <Shield className="w-5 h-5 text-emerald-500" />
             <p className="text-[10px] font-bold text-slate-300">This meeting is end-to-end encrypted for your privacy.</p>
          </div>
       </div>

       <div className="mt-auto pt-8 flex flex-col items-center gap-1 opacity-40">
         <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Developed by Mayank Sharma</p>
         <div className="w-8 h-[1px] bg-white/10" />
      </div>
    </div>
  </div>
);

const ReactionOverlay = ({ reactions }: { reactions: any[] }) => (
  <div className="fixed inset-0 pointer-events-none z-[1000] overflow-hidden">
    <AnimatePresence>
      {reactions.map((r) => {
        // Simple deterministic x position based on ID
        const hash = r.id.split('').reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0);
        const initialX = 10 + (hash % 80);
        return (
          <motion.div
            key={r.id}
            initial={{ y: '100vh', opacity: 0, x: `${initialX}%` }}
            animate={{ 
              y: '-20vh', 
              opacity: [0, 1, 1, 0], 
              x: [`${initialX}%`, `${Math.max(0, Math.min(100, initialX + (Math.sin(hash) * 15)))}%`] 
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 4, ease: "easeOut" }}
            className="absolute pointer-events-none will-change-transform flex flex-col items-center"
            style={{ zIndex: 9999 }}
          >
            <span className="text-8xl md:text-[10rem] filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)] select-none leading-none">
              {r.emoji}
            </span>
            <div className="mt-4 px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 shadow-2xl">
              <span className="text-[10px] md:text-sm font-black text-white uppercase tracking-widest whitespace-nowrap">
                {r.senderName}
              </span>
            </div>
          </motion.div>
        );
      })}
    </AnimatePresence>
  </div>
);

// ErrorBoundary class definition to prevent white screen UI crashes perfectly
class ErrorBoundary extends React.Component<any, any> {
  state: any;
  props: any;

  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error during active session:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-[#0B0E14] flex flex-col items-center justify-center text-slate-200 z-[200] p-6 text-center">
          <div className="w-16 h-16 rounded-[2rem] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-6">
            <XCircle className="w-8 h-8 animate-bounce" />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tighter text-white mb-2">Something went wrong</h1>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest max-w-sm leading-relaxed mb-6">
            Something went wrong. Reload to rejoin the meeting safely.
          </p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-8 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-blue-500/20"
          >
            Reload Meeting
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export const MeetingRoom = () => (
  <ErrorBoundary>
    <MeetingRoomComponent />
  </ErrorBoundary>
);

export default MeetingRoom;
