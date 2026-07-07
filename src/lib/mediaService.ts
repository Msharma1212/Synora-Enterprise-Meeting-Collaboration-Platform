import { toast } from 'react-hot-toast';

export interface AdvancedAudioSettings {
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
  hdAudio: boolean;
  stereoAudio: boolean;
  voiceIsolation: boolean;
  originalSound: boolean;
  audioEnhancement: boolean;
  musicMode: boolean;
  lowLatency: boolean;
  micBoost: number; // 0.5 to 2.5 (multiplier)
  inputVolume: number; // 0.0 to 1.0 (multiplier)
  outputVolume: number; // 0.0 to 1.0 (multiplier)
  selectedMic: string;
  selectedSpeaker: string;
  selectedCamera: string;
  resolution: '360p' | '720p' | '1080p';
  frameRate: 15 | 30 | 60;
  bitrate: number; // kbps
  mirrorCamera: boolean;
  backgroundBlur: boolean;
  virtualBackground: string;
}

export const DEFAULT_MEDIA_SETTINGS: AdvancedAudioSettings = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  hdAudio: true,
  stereoAudio: false,
  voiceIsolation: true,
  originalSound: false,
  audioEnhancement: true,
  musicMode: false,
  lowLatency: true,
  micBoost: 1.0,
  inputVolume: 1.0,
  outputVolume: 1.0,
  selectedMic: '',
  selectedSpeaker: '',
  selectedCamera: '',
  resolution: '720p',
  frameRate: 30,
  bitrate: 2000,
  mirrorCamera: true,
  backgroundBlur: false,
  virtualBackground: 'none'
};

// Returns optimized WebRTC constraints based on current settings
export function getOptimizedConstraints(
  selectedMic?: string,
  selectedCamera?: string,
  settings: AdvancedAudioSettings = DEFAULT_MEDIA_SETTINGS
): MediaStreamConstraints {
  const audioConstraints: any = {
    deviceId: selectedMic ? { exact: selectedMic } : undefined,
    echoCancellation: settings.originalSound ? false : settings.echoCancellation,
    noiseSuppression: settings.originalSound ? false : settings.noiseSuppression,
    autoGainControl: settings.originalSound ? false : settings.autoGainControl,
    sampleRate: settings.hdAudio ? 48000 : 44100,
    sampleSize: 16,
    channelCount: settings.stereoAudio || settings.musicMode ? 2 : 1,
    latency: settings.lowLatency ? 0 : 0.02
  };

  // Modern browser-specific options
  if (settings.voiceIsolation && !settings.originalSound) {
    audioConstraints.voiceIsolation = true;
  }
  audioConstraints.suppressLocalAudioPlayback = true;

  // Video settings mapping
  let width = 1280;
  let height = 720;
  if (settings.resolution === '360p') {
    width = 640; height = 360;
  } else if (settings.resolution === '1080p') {
    width = 1920; height = 1080;
  }

  const videoConstraints: any = {
    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
    width: { ideal: width },
    height: { ideal: height },
    frameRate: { ideal: settings.frameRate },
    aspectRatio: 1.777777778, // 16:9
    resizeMode: "crop-and-scale" // Adaptive resolution scaling
  };

  return {
    audio: audioConstraints,
    video: videoConstraints
  };
}

// Rewrites SDP to prefer high-quality Opus, enable Forward Error Correction (FEC) and Discontinuous Transmission (DTX)
export function optimizeSDP(sdp: string, settings: AdvancedAudioSettings = DEFAULT_MEDIA_SETTINGS): string {
  let lines = sdp.split('\r\n');
  
  let opusPayloadType = "";
  for (let line of lines) {
    if (line.includes("a=rtpmap:") && line.toLowerCase().includes("opus/48000")) {
      const match = line.match(/a=rtpmap:(\d+)\s+opus/i);
      if (match) {
        opusPayloadType = match[1];
      }
    }
  }

  if (opusPayloadType) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith(`a=fmtp:${opusPayloadType}`)) {
        let fmtp = lines[i];
        
        // Ensure useinbandfec=1 (Forward Error Correction)
        if (!fmtp.includes("useinbandfec=")) {
          fmtp += ";useinbandfec=1";
        } else {
          fmtp = fmtp.replace(/useinbandfec=\d/, "useinbandfec=1");
        }
        
        // Ensure usedtx=1 (Discontinuous Transmission)
        if (!fmtp.includes("usedtx=")) {
          fmtp += ";usedtx=1";
        } else {
          fmtp = fmtp.replace(/usedtx=\d/, "usedtx=1");
        }
        
        // Stereo settings
        const preferStereo = settings.stereoAudio || settings.musicMode;
        if (preferStereo) {
          if (!fmtp.includes("stereo=")) {
            fmtp += ";stereo=1;sprop-stereo=1";
          } else {
            fmtp = fmtp.replace(/stereo=\d/, "stereo=1").replace(/sprop-stereo=\d/, "sprop-stereo=1");
          }
        } else {
          if (!fmtp.includes("stereo=")) {
            fmtp += ";stereo=0";
          } else {
            fmtp = fmtp.replace(/stereo=\d/, "stereo=0");
          }
        }
        
        // Bitrate optimization
        const bitrate = settings.musicMode ? 128000 : (settings.hdAudio ? 64000 : 48000);
        if (!fmtp.includes("maxaveragebitrate=")) {
          fmtp += `;maxaveragebitrate=${bitrate}`;
        } else {
          fmtp = fmtp.replace(/maxaveragebitrate=\d+/, `maxaveragebitrate=${bitrate}`);
        }
        
        lines[i] = fmtp;
      }
    }
  }

  // Optimize maximum video bandwidth if present
  const videoBitrateBps = settings.bitrate * 1000;
  let videoMediaSectionIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith("m=video ")) {
      videoMediaSectionIndex = i;
      break;
    }
  }
  if (videoMediaSectionIndex !== -1) {
    let hasBandwidthLimit = false;
    for (let i = videoMediaSectionIndex + 1; i < lines.length; i++) {
      if (lines[i].startsWith("m=audio ") || lines[i].startsWith("m=application ")) break;
      if (lines[i].startsWith("b=AS:")) {
        lines[i] = `b=AS:${settings.bitrate}`;
        hasBandwidthLimit = true;
        break;
      }
    }
    if (!hasBandwidthLimit) {
      // Insert bandwidth line right after m=video
      lines.splice(videoMediaSectionIndex + 1, 0, `b=AS:${settings.bitrate}`);
    }
  }

  return lines.join('\r\n');
}

// Check if speakers or headphones are actively used based on device name
export function checkSpeakerVsHeadphone(label: string): 'speaker' | 'headphones' | 'unknown' {
  const lowercaseLabel = label.toLowerCase();
  if (
    lowercaseLabel.includes('headphone') ||
    lowercaseLabel.includes('headset') ||
    lowercaseLabel.includes('earphone') ||
    lowercaseLabel.includes('buds') ||
    lowercaseLabel.includes('airpods')
  ) {
    return 'headphones';
  }
  if (
    lowercaseLabel.includes('speaker') ||
    lowercaseLabel.includes('internal') ||
    lowercaseLabel.includes('audio') ||
    lowercaseLabel.includes('built-in')
  ) {
    return 'speaker';
  }
  return 'unknown';
}

// Media Audio Processing Pipeline using Web Audio API
export class WebAudioPipeline {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private highpassFilter: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;
  
  // Analyser node for level meters and feedback loop detection
  private analyser: AnalyserNode | null = null;
  private feedbackCount: number = 0;
  private feedbackInterval: any = null;
  
  // Screen audio mixing node
  private screenSourceNode: MediaStreamAudioSourceNode | null = null;

  public onFeedbackDetected: () => void = () => {};

  constructor(private rawStream: MediaStream, private settings: AdvancedAudioSettings) {
    this.initPipeline();
  }

  private initPipeline() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) {
        console.warn("Web Audio API is not supported in this browser");
        return;
      }

      this.audioContext = new AudioCtx({
        latencyHint: this.settings.lowLatency ? 'interactive' : 'balanced',
        sampleRate: this.settings.hdAudio ? 48000 : 44100
      });

      // 1. Create Source from raw mic stream
      const audioTracks = this.rawStream.getAudioTracks();
      if (audioTracks.length === 0) return;
      this.sourceNode = this.audioContext.createMediaStreamSource(this.rawStream);

      // 2. Highpass Filter (reduces hums like AC, keyboard, fan noise below 80Hz)
      this.highpassFilter = this.audioContext.createBiquadFilter();
      this.highpassFilter.type = 'highpass';
      this.highpassFilter.frequency.setValueAtTime(85, this.audioContext.currentTime);

      // 3. Gain Node for mic boost and volume scaling
      this.gainNode = this.audioContext.createGain();
      this.updateGain();

      // 4. Dynamics Compressor (Limiter) to prevent clipping and normalize speaker volume
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.setValueAtTime(-2, this.audioContext.currentTime); // near clipping threshold
      this.compressorNode.knee.setValueAtTime(0, this.audioContext.currentTime); // hard limiter
      this.compressorNode.ratio.setValueAtTime(20, this.audioContext.currentTime); // high ratio acts as a limiter
      this.compressorNode.attack.setValueAtTime(0.003, this.audioContext.currentTime); // fast 3ms attack
      this.compressorNode.release.setValueAtTime(0.12, this.audioContext.currentTime); // 120ms release

      // 5. Analyser Node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;

      // 6. Media Stream Destination (for WebRTC peer connections)
      this.destinationNode = this.audioContext.createMediaStreamDestination();

      // Connect nodes dynamically
      if (this.settings.originalSound) {
        this.sourceNode.connect(this.gainNode);
        this.gainNode.connect(this.analyser);
        this.analyser.connect(this.destinationNode);
      } else {
        this.sourceNode.connect(this.highpassFilter);
        this.highpassFilter.connect(this.gainNode);
        this.gainNode.connect(this.compressorNode);
        this.compressorNode.connect(this.analyser);
        this.analyser.connect(this.destinationNode);
      }

      this.startFeedbackDetection();
    } catch (err) {
      console.error("Failed to initialize Web Audio pipeline:", err);
    }
  }

  // Mix a secondary screen audio stream into the WebRTC pipeline
  public attachScreenAudio(screenAudioStream: MediaStream) {
    if (!this.audioContext || screenAudioStream.getAudioTracks().length === 0) return;
    try {
      this.detachScreenAudio();
      
      this.screenSourceNode = this.audioContext.createMediaStreamSource(screenAudioStream);
      
      // Connect screen audio directly to the compressor to mix with the microphone!
      if (this.compressorNode) {
        this.screenSourceNode.connect(this.compressorNode);
      } else if (this.destinationNode) {
        this.screenSourceNode.connect(this.destinationNode);
      }
      
      console.log("Successfully mixed screen/system audio into microphone pipeline");
    } catch (err) {
      console.error("Failed to attach screen share audio to pipeline:", err);
    }
  }

  public detachScreenAudio() {
    if (this.screenSourceNode) {
      try {
        this.screenSourceNode.disconnect();
      } catch (e) {}
      this.screenSourceNode = null;
    }
  }

  public updateSettings(newSettings: AdvancedAudioSettings) {
    const originalPrefChanged = this.settings.originalSound !== newSettings.originalSound;
    this.settings = newSettings;
    
    if (originalPrefChanged) {
      // Re-route nodes
      this.reconnectNodes();
    } else {
      this.updateGain();
    }
  }

  private updateGain() {
    if (!this.gainNode || !this.audioContext) return;
    const boost = this.settings.micBoost;
    const vol = this.settings.inputVolume;
    this.gainNode.gain.setValueAtTime(boost * vol, this.audioContext.currentTime);
  }

  private reconnectNodes() {
    if (!this.sourceNode || !this.highpassFilter || !this.gainNode || !this.compressorNode || !this.analyser || !this.destinationNode) return;
    
    try {
      this.sourceNode.disconnect();
      this.highpassFilter.disconnect();
      this.gainNode.disconnect();
      this.compressorNode.disconnect();
      this.analyser.disconnect();
    } catch (e) {}

    this.updateGain();

    if (this.settings.originalSound) {
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.destinationNode);
    } else {
      this.sourceNode.connect(this.highpassFilter);
      this.highpassFilter.connect(this.gainNode);
      this.gainNode.connect(this.compressorNode);
      this.compressorNode.connect(this.analyser);
      this.analyser.connect(this.destinationNode);
    }
  }

  // Get real-time audio analysis data
  public getAnalysisData() {
    if (!this.analyser) return { average: 0, peak: 0, clipping: false };

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
      if (dataArray[i] > peak) {
        peak = dataArray[i];
      }
    }

    const average = sum / bufferLength;
    const clipping = peak >= 253; // Standard 8-bit clipping threshold

    return {
      average: average / 128, // Normalize roughly (0 to 1)
      peak: peak / 255, // 0 to 1
      clipping
    };
  }

  // Continuous monitoring for acoustic feedback loops (typical speaker sound bleeding back into mic)
  private startFeedbackDetection() {
    if (!this.analyser) return;
    
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    this.feedbackInterval = setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getByteFrequencyData(dataArray);

      let maxVal = 0;
      let maxIndex = -1;
      for (let i = 0; i < bufferLength; i++) {
        if (dataArray[i] > maxVal) {
          maxVal = dataArray[i];
          maxIndex = i;
        }
      }

      // Feedback manifests as an extremely narrow, massive peak in the audio spectrum
      if (maxVal > 240) {
        let isSharpPeak = true;
        let surroundingEnergy = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          if (Math.abs(i - maxIndex) > 4) {
            surroundingEnergy += dataArray[i];
          }
        }
        
        const surroundingAverage = surroundingEnergy / (bufferLength - 9);
        
        // If the main peak is extremely strong, but overall surrounding levels are low, it's a feedback loop
        if (isSharpPeak && surroundingAverage < 60) {
          this.feedbackCount++;
          if (this.feedbackCount >= 3) { // Detected consistently 3 times
            this.onFeedbackDetected();
            this.feedbackCount = 0; // reset
          }
        } else {
          this.feedbackCount = Math.max(0, this.feedbackCount - 1);
        }
      } else {
        this.feedbackCount = Math.max(0, this.feedbackCount - 1);
      }
    }, 1000);
  }

  // Get the processed audio track to pipe into peer connections
  public getProcessedTrack(): MediaStreamTrack | null {
    if (!this.destinationNode) return null;
    return this.destinationNode.stream.getAudioTracks()[0] || null;
  }

  public getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  public cleanup() {
    clearInterval(this.feedbackInterval);
    this.detachScreenAudio();

    if (this.sourceNode) {
      try { this.sourceNode.disconnect(); } catch (e) {}
    }
    if (this.highpassFilter) {
      try { this.highpassFilter.disconnect(); } catch (e) {}
    }
    if (this.gainNode) {
      try { this.gainNode.disconnect(); } catch (e) {}
    }
    if (this.compressorNode) {
      try { this.compressorNode.disconnect(); } catch (e) {}
    }
    if (this.analyser) {
      try { this.analyser.disconnect(); } catch (e) {}
    }
    if (this.destinationNode) {
      try { this.destinationNode.disconnect(); } catch (e) {}
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(console.error);
    }
    this.audioContext = null;
  }
}

// Hot-swaps tracks on existing peer connections using RTCRtpSender.replaceTrack()
export async function hotSwapTrackOnPeers(
  peers: any[],
  kind: 'audio' | 'video',
  newTrack: MediaStreamTrack
): Promise<void> {
  console.log(`Hot-swapping remote track of type ${kind} with device: ${newTrack.label}`);
  
  const swapPromises = peers.map(async (p) => {
    if (p.peer && p.peer._pc) {
      const pc: RTCPeerConnection = p.peer._pc;
      const senders = pc.getSenders();
      const sender = senders.find((s) => s.track && s.track.kind === kind);
      
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (err) {
          console.error(`Failed to replaceTrack in peer ${p.peerID}:`, err);
        }
      } else {
        // If there's no sender of this kind, add it
        try {
          pc.addTrack(newTrack);
        } catch (err) {
          console.error(`Failed to addTrack on replacement in peer ${p.peerID}:`, err);
        }
      }
    }
  });

  await Promise.all(swapPromises);
}
