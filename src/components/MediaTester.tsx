import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Mic, 
  Speaker, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Square, 
  Sparkles, 
  AlertCircle, 
  Activity,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { 
  WebAudioPipeline, 
  getOptimizedConstraints, 
  checkSpeakerVsHeadphone, 
  DEFAULT_MEDIA_SETTINGS,
  AdvancedAudioSettings
} from '../lib/mediaService';
import { toast } from 'react-hot-toast';

interface MediaTesterProps {
  filter?: 'video' | 'audio';
  onDevicesChanged?: (mic: string, camera: string, speaker: string) => void;
}

const MediaTester: React.FC<MediaTesterProps> = ({ filter, onDevicesChanged }) => {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>('');
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedSpeaker, setSelectedSpeaker] = useState<string>('');
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);
  const [isClipping, setIsClipping] = useState(false);
  const [latency, setLatency] = useState(12); // ms estimate
  const [noiseLevel, setNoiseLevel] = useState(10); // dB estimate
  const [isLivePlayback, setIsLivePlayback] = useState(false);
  const [deviceWarning, setDeviceWarning] = useState('');
  const [feedbackDetected, setFeedbackDetected] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pipelineRef = useRef<WebAudioPipeline | null>(null);
  const localFeedbackAudioRef = useRef<AudioNode | null>(null); // For live playback node
  const animationFrameRef = useRef<number | null>(null);

  // Enumerate physical hardware devices
  const getDevices = async () => {
    try {
      let dev = await navigator.mediaDevices.enumerateDevices();
      const hasLabels = dev.some(d => !!d.label);

      // Force prompt permissions if labels are blank to fetch actual device names
      if (!hasLabels) {
        try {
          const promptStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
          promptStream.getTracks().forEach(t => t.stop());
          dev = await navigator.mediaDevices.enumerateDevices();
        } catch (e) {
          console.warn("Permission denied for listing devices:", e);
        }
      }

      setDevices(dev);
      
      const videoDev = dev.find(d => d.kind === 'videoinput');
      const audioDev = dev.find(d => d.kind === 'audioinput');
      const speakerDev = dev.find(d => d.kind === 'audiooutput');
      
      if (videoDev && !selectedVideo) setSelectedVideo(videoDev.deviceId);
      if (audioDev && !selectedAudio) setSelectedAudio(audioDev.deviceId);
      if (speakerDev && !selectedSpeaker) setSelectedSpeaker(speakerDev.deviceId);
    } catch (err) {
      console.error("Error listing devices:", err);
    }
  };

  useEffect(() => {
    getDevices();
    navigator.mediaDevices.ondevicechange = getDevices;
    return () => {
      navigator.mediaDevices.ondevicechange = null;
    };
  }, []);

  // Update warnings based on speaker device selection
  useEffect(() => {
    if (selectedSpeaker && devices.length > 0) {
      const activeSpk = devices.find(d => d.deviceId === selectedSpeaker);
      if (activeSpk) {
        const type = checkSpeakerVsHeadphone(activeSpk.label);
        if (type === 'speaker') {
          setDeviceWarning("For best experience please use headphones. Speakers can cause feedback loop.");
        } else {
          setDeviceWarning('');
        }
      }
    }
  }, [selectedSpeaker, devices]);

  // Handle stream creation and pipeline attachment
  useEffect(() => {
    const startPreview = async () => {
      // Cleanup previous stream/pipeline
      cleanupMedia();

      try {
        const savedSettings = localStorage.getItem('synora_media_settings');
        const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
        const activeSettings = { ...DEFAULT_MEDIA_SETTINGS, ...parsedSettings };
        const constraints = getOptimizedConstraints(selectedAudio, selectedVideo, activeSettings);
        
        // Remove video block if we filter for audio
        if (filter === 'audio') {
          constraints.video = false;
        }
        if (filter === 'video') {
          constraints.audio = false;
        }

        const newStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(newStream);

        if (videoRef.current && filter !== 'audio' && newStream.getVideoTracks().length > 0) {
          videoRef.current.srcObject = newStream;
        }

        // Initialize Web Audio Processing Pipeline
        if (filter !== 'video' && newStream.getAudioTracks().length > 0) {
          const settings: AdvancedAudioSettings = {
            ...DEFAULT_MEDIA_SETTINGS,
            ...parsedSettings,
            selectedMic: selectedAudio,
            selectedCamera: selectedVideo,
            selectedSpeaker: selectedSpeaker
          };

          const pipeline = new WebAudioPipeline(newStream, settings);
          pipelineRef.current = pipeline;

          pipeline.onFeedbackDetected = () => {
            setFeedbackDetected(true);
            toast.error("Acoustic feedback loop detected! Muting live preview.", { id: 'feedback-err' });
            setIsLivePlayback(false);
            setTimeout(() => setFeedbackDetected(false), 5000);
          };

          // Setup real-time waveform visualization
          const analyser = pipeline.getAnalyser();
          if (analyser) {
            visualizeWaveform(analyser);
            
            // Latency calculation based on context
            const ctx = analyser.context as AudioContext;
            const computedLatency = Math.round((ctx.baseLatency || 0.008) * 1000 + (ctx.outputLatency || 0.004) * 1000);
            setLatency(Math.max(5, computedLatency));
          }
        }

        // Notify parent settings page/modal of active device switch
        if (onDevicesChanged) {
          onDevicesChanged(selectedAudio, selectedVideo, selectedSpeaker);
        }
      } catch (err) {
        console.error("Error launching tester media preview:", err);
      }
    };

    if (selectedVideo || selectedAudio || selectedSpeaker) {
      startPreview();
    }

    return () => {
      cleanupMedia();
    };
  }, [selectedVideo, selectedAudio, selectedSpeaker, filter]);

  // Setup loopback audio (hear yourself test)
  useEffect(() => {
    if (!pipelineRef.current) return;
    const analyser = pipelineRef.current.getAnalyser();
    if (!analyser) return;

    if (isLivePlayback) {
      try {
        const ctx = analyser.context as AudioContext;
        // Connect the pipeline analyser output node to the physical speaker output destination
        const feedbackGain = ctx.createGain();
        feedbackGain.gain.setValueAtTime(0.5, ctx.currentTime); // moderate safe playback volume
        
        analyser.connect(feedbackGain);
        feedbackGain.connect(ctx.destination);
        localFeedbackAudioRef.current = feedbackGain;
        toast.success("Live microphone playback test started. Speak into mic.");
      } catch (e) {
        console.error("Live playback failed:", e);
      }
    } else {
      if (localFeedbackAudioRef.current) {
        try {
          localFeedbackAudioRef.current.disconnect();
        } catch (e) {}
        localFeedbackAudioRef.current = null;
      }
    }
  }, [isLivePlayback]);

  const cleanupMedia = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (localFeedbackAudioRef.current) {
      try { localFeedbackAudioRef.current.disconnect(); } catch (e) {}
      localFeedbackAudioRef.current = null;
    }
    if (pipelineRef.current) {
      pipelineRef.current.cleanup();
      pipelineRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsLivePlayback(false);
  };

  // Draw stunning neon Web Audio oscilloscope waveform on canvas
  const visualizeWaveform = (analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    let silentCount = 0;
    let computedNoise = 12;

    const draw = () => {
      if (!canvasRef.current || !analyser) return;
      animationFrameRef.current = requestAnimationFrame(draw);

      analyser.getByteTimeDomainData(dataArray);

      // Render dark tech background
      ctx.fillStyle = '#090d16';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render grid lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
      ctx.lineWidth = 1;
      
      // Horizontal divisions
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      
      // Vertical divisions
      for (let x = 0; x < canvas.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }

      // Draw Waveform curve
      ctx.lineWidth = 2.5;
      const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
      gradient.addColorStop(0, '#3b82f6'); // Blue
      gradient.addColorStop(0.5, '#10b981'); // Emerald
      gradient.addColorStop(1, '#6366f1'); // Indigo
      ctx.strokeStyle = gradient;
      ctx.beginPath();

      const sliceWidth = canvas.width * 1.0 / bufferLength;
      let x = 0;
      let sumSquares = 0;
      let maxAmp = 0;

      for (let i = 0; i < bufferLength; i++) {
        // time domain values are 0-255 centered around 128
        const v = dataArray[i] / 128.0;
        const y = v * canvas.height / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;

        // Peak / Noise calculations
        const centeredVal = Math.abs(dataArray[i] - 128);
        sumSquares += centeredVal * centeredVal;
        if (centeredVal > maxAmp) {
          maxAmp = centeredVal;
        }
      }

      ctx.lineTo(canvas.width, canvas.height / 2);
      ctx.stroke();

      // Compute RMS volume level (0 to 1)
      const rms = Math.sqrt(sumSquares / bufferLength);
      const normalizedLvl = rms / 64; // Scale to fits 0-1
      setAudioLevel(normalizedLvl);

      // Peak hold calculation
      const normPeak = maxAmp / 128;
      setPeakLevel(prev => Math.max(normPeak, prev * 0.96)); // Slow peak release decay

      // Clipping indicator
      setIsClipping(normPeak > 0.95);

      // Estimate ambient background noise floor in dB when quiet
      if (normPeak < 0.05) {
        silentCount++;
        if (silentCount > 60) { // Stable silence
          const estimatedNoiseFloor = Math.round(15 + normPeak * 150);
          computedNoise = Math.max(5, Math.min(30, estimatedNoiseFloor));
          setNoiseLevel(computedNoise);
        }
      } else {
        silentCount = 0;
      }
    };

    draw();
  };

  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  const audioDevices = devices.filter(d => d.kind === 'audioinput');
  const speakerDevices = devices.filter(d => d.kind === 'audiooutput');

  // Logic to compute overall mic health message
  const getMicStatusMessage = () => {
    if (audioLevel < 0.01) {
      return { msg: "Microphone is silent. Try speaking or check boost.", color: "text-slate-400" };
    }
    if (isClipping) {
      return { msg: "Microphone is clipping! Lower input volume.", color: "text-rose-500 font-bold animate-pulse" };
    }
    if (noiseLevel > 28) {
      return { msg: "High ambient noise detected. Turn on Noise Suppression.", color: "text-amber-500" };
    }
    return { msg: "Your microphone sounds good.", color: "text-emerald-400 font-bold" };
  };

  const status = getMicStatusMessage();

  return (
    <div className="space-y-6 font-sans">
      {/* 1. Device selectors */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {filter !== 'audio' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Camera className="w-3.5 h-3.5 text-blue-400" /> Camera Device
            </label>
            <div className="relative group">
              <select 
                value={selectedVideo}
                onChange={(e) => setSelectedVideo(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none pr-8 font-medium"
              >
                {videoDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
                ))}
                {videoDevices.length === 0 && <option value="">No Camera Found</option>}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none group-hover:text-blue-400" />
            </div>
          </div>
        )}

        {filter !== 'video' && (
          <>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Mic className="w-3.5 h-3.5 text-emerald-400" /> Microphone Device
              </label>
              <div className="relative group">
                <select 
                  value={selectedAudio}
                  onChange={(e) => setSelectedAudio(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none pr-8 font-medium"
                >
                  {audioDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                  {audioDevices.length === 0 && <option value="">No Mic Found</option>}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none group-hover:text-blue-400" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Speaker className="w-3.5 h-3.5 text-indigo-400" /> Speaker Device
              </label>
              <div className="relative group">
                <select 
                  value={selectedSpeaker}
                  onChange={(e) => setSelectedSpeaker(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700/60 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer appearance-none pr-8 font-medium"
                >
                  {speakerDevices.map(d => (
                    <option key={d.deviceId} value={d.deviceId}>{d.label || `Speaker ${d.deviceId.slice(0, 5)}`}</option>
                  ))}
                  {speakerDevices.length === 0 && <option value="">System Default</option>}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none group-hover:text-blue-400" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* 2. Audio Warning message if speaker is selected instead of headset */}
      {deviceWarning && filter !== 'video' && (
        <div className="flex gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-2xl items-start text-xs animate-in slide-in-from-top-2">
          <AlertTriangle className="w-4.5 h-4.5 shrink-0 mt-0.5 text-amber-500" />
          <p>{deviceWarning}</p>
        </div>
      )}

      {/* 3. Media Previews Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Camera Preview */}
        {filter !== 'audio' && selectedVideo && (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Camera Feed</span>
            <div className="aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 relative shadow-inner">
              <video muted ref={videoRef} autoPlay playsInline className="w-full h-full object-cover scale-x-[-1]" />
              <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-black/50 backdrop-blur-md rounded-lg border border-white/5">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                <span className="text-[8px] font-black text-white uppercase tracking-wider">LIVE</span>
              </div>
            </div>
          </div>
        )}

        {/* Real-time Web Audio Oscilloscope Waveform Canvas */}
        {filter !== 'video' && selectedAudio && (
          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-emerald-400" /> Waveform Oscilloscope
            </span>
            <div className="aspect-video bg-[#090d16] rounded-2xl overflow-hidden border border-slate-800 relative shadow-inner flex flex-col justify-between">
              <canvas ref={canvasRef} className="w-full h-[150px] bg-transparent flex-1" width={400} height={180} />
              
              {/* Audio Metrics Floating Panel */}
              <div className="p-3 bg-black/60 border-t border-white/5 backdrop-blur-md flex items-center justify-between text-[10px] tracking-wider uppercase font-black text-slate-400">
                <div className="flex gap-4">
                  <div>Latency: <span className="text-blue-400">{latency}ms</span></div>
                  <div>Noise Floor: <span className={cn(noiseLevel > 24 ? "text-amber-400" : "text-emerald-400")}>{noiseLevel} dB</span></div>
                </div>
                <div className="flex gap-1.5 items-center">
                  <div className={cn("w-1.5 h-1.5 rounded-full", isClipping ? "bg-red-500 animate-ping" : "bg-emerald-500")} />
                  <span>{isClipping ? "Clipping" : "Normal"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Controls & Mics health checks */}
      {filter !== 'video' && (
        <div className="bg-slate-950/40 border border-slate-800/60 p-4 rounded-3xl flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex gap-3 items-center">
            <div className="w-9 h-9 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-blue-400" />
            </div>
            <div className="text-left">
              <span className="text-[9px] text-slate-500 font-extrabold uppercase tracking-widest leading-none block">Status Diagnostic</span>
              <p className={cn("text-xs mt-1 leading-none", status.color)}>{status.msg}</p>
            </div>
          </div>

          <div className="flex gap-2.5 w-full sm:w-auto">
            {/* Playback loopback test button */}
            <button
              onClick={() => setIsLivePlayback(!isLivePlayback)}
              className={cn(
                "flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold border transition-all active:scale-95",
                isLivePlayback 
                  ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20" 
                  : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white"
              )}
            >
              {isLivePlayback ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              <span>{isLivePlayback ? "Stop Loopback" : "Live Playback Test"}</span>
            </button>
          </div>
        </div>
      )}

      {/* 5. Audio Level progress bar indicator */}
      {filter !== 'video' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Realtime Volume Level</span>
            <span className="text-[9px] font-black text-slate-500 tracking-wider">Peak: {Math.round(peakLevel * 100)}%</span>
          </div>
          <div className="h-2.5 bg-slate-900 border border-slate-800/80 rounded-full overflow-hidden p-0.5">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-75",
                isClipping ? "bg-red-500" : (audioLevel > 0.6 ? "bg-amber-500" : "bg-emerald-500")
              )}
              style={{ width: `${Math.min(100, audioLevel * 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MediaTester;
