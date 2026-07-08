import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  ArrowRight, 
  Trees, 
  Cloud, 
  Moon, 
  Wind, 
  Volume2, 
  VolumeX, 
  Sun, 
  Waves, 
  Compass, 
  Workflow, 
  Zap, 
  HelpCircle,
  Gem, 
  Focus
} from 'lucide-react';

interface PortalTransitionProps {
  userName: string;
  onComplete: () => void;
  accentColor?: 'blue' | 'orange' | 'purple';
  voiceEnabled?: boolean;
  isFirstLogin?: boolean;
}

// Exactly the 10 requested high-quality fantasy animations
type AnimationVariantType = 
  | 'fairyLand'
  | 'heavenGate'
  | 'floatingIsland'
  | 'portalForest'
  | 'stairwaySky'
  | 'underwaterDream'
  | 'sunriseValley'
  | 'galaxyGarden'
  | 'crystalCave'
  | 'spiritWorld';

export const PortalTransition: React.FC<PortalTransitionProps> = ({ 
  userName, 
  onComplete,
  accentColor = 'blue',
  voiceEnabled = true,
  isFirstLogin = false
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Sound configuration persisting to local storage. 
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      return localStorage.getItem('synora_cinematic_audio') !== 'false';
    } catch {
      return true;
    }
  });

  // Strict randomness & force re-render: randomize variant cleanly on mount
  const [selectedAnimation] = useState<AnimationVariantType>(() => {
    const list: AnimationVariantType[] = [
      'fairyLand',
      'heavenGate',
      'floatingIsland',
      'portalForest',
      'stairwaySky',
      'underwaterDream',
      'sunriseValley',
      'galaxyGarden',
      'crystalCave',
      'spiritWorld'
    ];
    // Return a random selection 
    return list[Math.floor(Math.random() * list.length)];
  });

  // Render initial character cleanly
  const initialChar = useMemo(() => {
    if (!userName) return 'E';
    return userName.trim().charAt(0).toUpperCase();
  }, [userName]);

  // Read previous travels to customize speeds and timing options
  const isRepeatExplorer = useMemo(() => {
    try {
      const recorded = localStorage.getItem('synora_has_traveled_before');
      if (recorded === 'true') return true;
      localStorage.setItem('synora_has_traveled_before', 'true');
      return false;
    } catch {
      return false;
    }
  }, []);

  // Cinematic flow timing sequence:
  // 1s -> environment appear
  // 2s -> movement (walk/fly/zoom)
  // 1s -> entry (portal/light)
  // 1s -> smooth transition (Total ~5s, repeat users enjoy 1.5x snappier pacing)
  const timings = useMemo(() => {
    const scale = isRepeatExplorer ? 0.7 : 1.0;
    return {
      init: Math.floor(1000 * scale),
      climax: Math.floor(3000 * scale),
      fadeStart: Math.floor(4000 * scale),
      complete: Math.floor(5200 * scale)
    };
  }, [isRepeatExplorer]);

  const [transitionProgress, setTransitionProgress] = useState<number>(0);
  const [hasCompleted, setHasCompleted] = useState(false);

  // Skip mechanism for instant dashboard entry
  const triggerSkip = () => {
    if (hasCompleted) return;
    setHasCompleted(true);
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
    }
    onComplete();
  };

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    try {
      localStorage.setItem('synora_cinematic_audio', String(newVal));
    } catch {}
    if (!newVal && audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
    }
  };

  // Cinematic trigger workflow timeouts
  useEffect(() => {
    const step1 = setTimeout(() => setTransitionProgress(1), timings.init);
    const step2 = setTimeout(() => setTransitionProgress(2), timings.climax);
    const step3 = setTimeout(() => setTransitionProgress(3), timings.fadeStart);
    const step4 = setTimeout(() => {
      if (!hasCompleted) {
        setHasCompleted(true);
        onComplete();
      }
    }, timings.complete);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === ' ' || e.code === 'Space') {
        triggerSkip();
      }
    };
    window.addEventListener('keydown', handleKey);

    return () => {
      clearTimeout(step1);
      clearTimeout(step2);
      clearTimeout(step3);
      clearTimeout(step4);
      window.removeEventListener('keydown', handleKey);
    };
  }, [timings, onComplete, hasCompleted]);

  // PROCEDURAL AUDIO SYNTHESIZER: High-Fidelity Magical Soundscapes per story theme!
  const playStorySound = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      audioContextRef.current = ctx;

      // Master output configuration
      const master = ctx.createGain();
      master.connect(ctx.destination);
      master.gain.setValueAtTime(0, ctx.currentTime);
      master.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.15);

      // Reverb/Delay nodes for space atmosphere
      const delayNode = ctx.createDelay();
      const feedbackNode = ctx.createGain();
      delayNode.delayTime.setValueAtTime(0.35, ctx.currentTime);
      feedbackNode.gain.setValueAtTime(0.42, ctx.currentTime);
      delayNode.connect(feedbackNode);
      feedbackNode.connect(delayNode);
      delayNode.connect(master);

      switch (selectedAnimation) {
        case 'fairyLand': {
          // Woodland breeze background
          const oscWind = ctx.createOscillator();
          oscWind.type = 'triangle';
          oscWind.frequency.setValueAtTime(140, ctx.currentTime);
          oscWind.frequency.linearRampToValueAtTime(110, ctx.currentTime + 4.0);
          const windG = ctx.createGain();
          windG.gain.setValueAtTime(0.06, ctx.currentTime);
          oscWind.connect(windG).connect(master);
          oscWind.start();
          oscWind.stop(ctx.currentTime + 5.0);

          // Magical sparkle bell chimes (Decaying fast oscillators)
          for (let b = 0; b < 10; b++) {
            const time = ctx.currentTime + b * 0.35;
            const bell = ctx.createOscillator();
            bell.type = 'sine';
            bell.frequency.setValueAtTime(650 + Math.random() * 950, time);
            const bg = ctx.createGain();
            bg.gain.setValueAtTime(0, ctx.currentTime);
            bg.gain.setValueAtTime(0.08, time);
            bg.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
            bell.connect(bg).connect(master);
            bell.start(time);
            bell.stop(time + 0.7);
          }

          // Birds chirping synthesizer (Rapid high sweep)
          for (let chirp = 0; chirp < 3; chirp++) {
            const time = ctx.currentTime + 1.2 + chirp * 1.5;
            const bird = ctx.createOscillator();
            bird.type = 'sine';
            bird.frequency.setValueAtTime(900, time);
            bird.frequency.exponentialRampToValueAtTime(1700, time + 0.12);
            const bg = ctx.createGain();
            bg.gain.setValueAtTime(0, ctx.currentTime);
            bg.gain.setValueAtTime(0.05, time);
            bg.gain.linearRampToValueAtTime(0.001, time + 0.2);
            bird.connect(bg).connect(master);
            bird.start(time);
            bird.stop(time + 0.25);
          }
          break;
        }

        case 'heavenGate': {
          // Deep choral celestial pad drone
          const pad1 = ctx.createOscillator();
          const pad2 = ctx.createOscillator();
          pad1.type = 'sine';
          pad2.type = 'triangle';
          pad1.frequency.setValueAtTime(196, ctx.currentTime); // G3
          pad2.frequency.setValueAtTime(293.66, ctx.currentTime); // D4
          const pg = ctx.createGain();
          pg.gain.setValueAtTime(0.12, ctx.currentTime);
          pad1.connect(pg).connect(master);
          pad2.connect(pg).connect(master);
          pad1.start(); pad2.start();
          pad1.stop(ctx.currentTime + 5.0); pad2.stop(ctx.currentTime + 5.0);

          // Swing squeaking gate noise (Simulated with a fast sweeping highpass filter and a sawtooth wave)
          const gateSqueak = ctx.createOscillator();
          gateSqueak.type = 'sawtooth';
          gateSqueak.frequency.setValueAtTime(220, ctx.currentTime + 1.0);
          gateSqueak.frequency.linearRampToValueAtTime(980, ctx.currentTime + 2.5);
          const filter = ctx.createBiquadFilter();
          filter.type = 'bandpass';
          filter.frequency.setValueAtTime(1500, ctx.currentTime);
          const gateG = ctx.createGain();
          gateG.gain.setValueAtTime(0, ctx.currentTime);
          gateG.gain.setValueAtTime(0.04, ctx.currentTime + 1.0);
          gateG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
          gateSqueak.connect(filter).connect(gateG).connect(master);
          gateSqueak.start(ctx.currentTime + 1.0);
          gateSqueak.stop(ctx.currentTime + 3.2);

          // Ethereal golden sun harp swoop
          [392, 493.88, 587.33, 783.99, 987.77].forEach((freq, i) => {
            const t = ctx.currentTime + 2.0 + i * 0.15;
            const strings = ctx.createOscillator();
            strings.type = 'sine';
            strings.frequency.setValueAtTime(freq, t);
            const sg = ctx.createGain();
            sg.gain.setValueAtTime(0, ctx.currentTime);
            sg.gain.setValueAtTime(0.14, t);
            sg.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
            strings.connect(sg).connect(master);
            strings.start(t);
            strings.stop(t + 1.5);
          });
          break;
        }

        case 'floatingIsland': {
          // Swooping mountaintop atmospheric wind sfx
          const wind = ctx.createOscillator();
          wind.type = 'sine';
          wind.frequency.setValueAtTime(110, ctx.currentTime);
          // Modulate with another oscillator to make it roar
          const mod = ctx.createOscillator();
          mod.type = 'sine';
          mod.frequency.setValueAtTime(5, ctx.currentTime);
          const modGain = ctx.createGain();
          modGain.gain.setValueAtTime(28, ctx.currentTime);
          mod.connect(modGain).connect(wind.frequency);

          const wg = ctx.createGain();
          wg.gain.setValueAtTime(0.18, ctx.currentTime);
          wg.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 2.5);
          wg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5.0);

          wind.connect(wg).connect(master);
          mod.start(); wind.start();
          mod.stop(ctx.currentTime + 5.0); wind.stop(ctx.currentTime + 5.0);

          // Ambient water splashes (Simulated noise burst)
          for (let splash = 0; splash < 4; splash++) {
            const sTime = ctx.currentTime + 0.8 + splash * 1.2;
            const spray = ctx.createOscillator();
            spray.type = 'triangle';
            spray.frequency.setValueAtTime(150 + Math.random() * 300, sTime);
            spray.frequency.exponentialRampToValueAtTime(50, sTime + 0.8);
            const sg = ctx.createGain();
            sg.gain.setValueAtTime(0, ctx.currentTime);
            sg.gain.setValueAtTime(0.08, sTime);
            sg.gain.exponentialRampToValueAtTime(0.001, sTime + 0.9);
            spray.connect(sg).connect(master);
            spray.start(sTime);
            spray.stop(sTime + 1.0);
          }
          break;
        }

        case 'portalForest': {
          // Spinning portal hum frequency sweep (whoosh sound)
          const roar = ctx.createOscillator();
          roar.type = 'sawtooth';
          roar.frequency.setValueAtTime(70, ctx.currentTime);
          roar.frequency.exponentialRampToValueAtTime(320, ctx.currentTime + 3.0);

          const lpf = ctx.createBiquadFilter();
          lpf.type = 'lowpass';
          lpf.Q.setValueAtTime(12, ctx.currentTime);
          lpf.frequency.setValueAtTime(100, ctx.currentTime);
          lpf.frequency.exponentialRampToValueAtTime(1800, ctx.currentTime + 2.5);

          const rg = ctx.createGain();
          rg.gain.setValueAtTime(0, ctx.currentTime);
          rg.gain.linearRampToValueAtTime(0.28, ctx.currentTime + 2.2);
          rg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.8);

          roar.connect(lpf).connect(rg).connect(master);
          roar.start();
          roar.stop(ctx.currentTime + 4.0);

          // Rustling tree leaves (White-noise bypass using high-frequency square wave pulse)
          for (let r = 0; r < 5; r++) {
            const time = ctx.currentTime + r * 1.0;
            const rustle = ctx.createOscillator();
            rustle.type = 'triangle';
            rustle.frequency.setValueAtTime(1800 + Math.random() * 800, time);
            const rf = ctx.createBiquadFilter();
            rf.type = 'highpass';
            rf.frequency.setValueAtTime(3000, time);
            const rg2 = ctx.createGain();
            rg2.gain.setValueAtTime(0, ctx.currentTime);
            rg2.gain.setValueAtTime(0.04, time);
            rg2.gain.exponentialRampToValueAtTime(0.001, time + 0.8);
            rustle.connect(rf).connect(rg2).connect(master);
            rustle.start(time);
            rustle.stop(time + 0.9);
          }
          break;
        }

        case 'stairwaySky': {
          // Twinkling stargaze sound arpeggio
          const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51];
          notes.forEach((freq, idx) => {
            const triggerTime = ctx.currentTime + idx * 0.38;
            const stairsOsc = ctx.createOscillator();
            stairsOsc.type = 'sine';
            stairsOsc.frequency.setValueAtTime(freq, triggerTime);
            
            const sg = ctx.createGain();
            sg.gain.setValueAtTime(0, ctx.currentTime);
            sg.gain.setValueAtTime(0.12, triggerTime);
            sg.gain.exponentialRampToValueAtTime(0.001, triggerTime + 1.2);
            
            stairsOsc.connect(sg).connect(master);
            stairsOsc.start(triggerTime);
            stairsOsc.stop(triggerTime + 1.5);
          });
          break;
        }

        case 'underwaterDream': {
          // Underwater sonar ping
          const ping = ctx.createOscillator();
          ping.type = 'sine';
          ping.frequency.setValueAtTime(1200, ctx.currentTime + 1.0);
          ping.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 2.8);
          const pg = ctx.createGain();
          pg.gain.setValueAtTime(0, ctx.currentTime);
          pg.gain.setValueAtTime(0.18, ctx.currentTime + 1.0);
          pg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3.0);
          ping.connect(pg).connect(master);
          ping.start(ctx.currentTime + 1.0);
          ping.stop(ctx.currentTime + 3.2);

          // Bubble popping chimes (very clean pitch sweeps)
          for (let bub = 0; bub < 12; bub++) {
            const bTime = ctx.currentTime + bub * 0.32;
            const bubble = ctx.createOscillator();
            bubble.type = 'sine';
            bubble.frequency.setValueAtTime(150 + Math.random() * 200, bTime);
            bubble.frequency.linearRampToValueAtTime(700, bTime + 0.08); // sweeps up rapidly
            const bg = ctx.createGain();
            bg.gain.setValueAtTime(0, ctx.currentTime);
            bg.gain.setValueAtTime(0.08, bTime);
            bg.gain.exponentialRampToValueAtTime(0.001, bTime + 0.1);
            bubble.connect(bg).connect(master);
            bubble.start(bTime);
            bubble.stop(bTime + 0.15);
          }
          break;
        }

        case 'sunriseValley': {
          // Morning breeze rising warm synthesizer filter sweep
          const sunOsc = ctx.createOscillator();
          sunOsc.type = 'triangle';
          sunOsc.frequency.setValueAtTime(110, ctx.currentTime);
          sunOsc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 4.5);

          const fS = ctx.createBiquadFilter();
          fS.type = 'lowpass';
          fS.frequency.setValueAtTime(50, ctx.currentTime);
          fS.frequency.exponentialRampToValueAtTime(2500, ctx.currentTime + 4.0);

          const sg = ctx.createGain();
          sg.gain.setValueAtTime(0, ctx.currentTime);
          sg.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 3.0);
          sg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5.0);

          sunOsc.connect(fS).connect(sg).connect(master);
          sunOsc.start();
          sunOsc.stop(ctx.currentTime + 5.0);

          // Dawn birds chirping sweet duets
          for (let b = 0; b < 4; b++) {
            const time = ctx.currentTime + 0.5 + b * 1.3;
            const chirp = ctx.createOscillator();
            chirp.type = 'sine';
            chirp.frequency.setValueAtTime(1200 + Math.random() * 300, time);
            chirp.frequency.exponentialRampToValueAtTime(2200, time + 0.1);
            const cg = ctx.createGain();
            cg.gain.setValueAtTime(0, ctx.currentTime);
            cg.gain.setValueAtTime(0.04, time);
            cg.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
            chirp.connect(cg).connect(master);
            chirp.start(time);
            chirp.stop(time + 0.2);
          }
          break;
        }

        case 'galaxyGarden': {
          // Mystical stellar organ
          const base1 = ctx.createOscillator();
          const base2 = ctx.createOscillator();
          base1.type = 'sine';
          base2.type = 'sine';
          base1.frequency.setValueAtTime(146.83, ctx.currentTime); // D3
          base2.frequency.setValueAtTime(220.00, ctx.currentTime); // A3
          
          const organG = ctx.createGain();
          organG.gain.setValueAtTime(0.18, ctx.currentTime);
          organG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 4.8);
          base1.connect(organG).connect(master);
          base2.connect(organG).connect(master);
          base1.start(); base2.start();
          base1.stop(ctx.currentTime + 5.0); base2.stop(ctx.currentTime + 5.0);

          // Deep cosmic bells chimes
          for (let bells = 0; bells < 8; bells++) {
            const bTime = ctx.currentTime + 0.4 + bells * 0.55;
            const chime = ctx.createOscillator();
            chime.type = 'sine';
            chime.frequency.setValueAtTime(880 + Math.random() * 400, bTime);
            const cg = ctx.createGain();
            cg.gain.setValueAtTime(0, ctx.currentTime);
            cg.gain.setValueAtTime(0.07, bTime);
            cg.gain.exponentialRampToValueAtTime(0.001, bTime + 1.2);
            chime.connect(cg).connect(master);
            chime.start(bTime);
            chime.stop(bTime + 1.4);
          }
          break;
        }

        case 'crystalCave': {
          // Dripping cave echoes (rapid decaying, heavily resonant)
          for (let drip = 0; drip < 14; drip++) {
            const dTime = ctx.currentTime + drip * 0.35 + Math.random() * 0.15;
            const osc = ctx.createOscillator();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(1400 + Math.random() * 1100, dTime);
            osc.frequency.exponentialRampToValueAtTime(300, dTime + 0.1);
            
            const dg = ctx.createGain();
            dg.gain.setValueAtTime(0, ctx.currentTime);
            dg.gain.setValueAtTime(0.08, dTime);
            dg.gain.exponentialRampToValueAtTime(0.001, dTime + 0.2);
            
            osc.connect(dg).connect(master);
            osc.start(dTime);
            osc.stop(dTime + 0.3);
          }

          // Hum resonance inside cave
          const caveHum = ctx.createOscillator();
          caveHum.type = 'triangle';
          caveHum.frequency.setValueAtTime(65, ctx.currentTime);
          const chG = ctx.createGain();
          chG.gain.setValueAtTime(0.12, ctx.currentTime);
          chG.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5.0);
          caveHum.connect(chG).connect(master);
          caveHum.start();
          caveHum.stop(ctx.currentTime + 5.0);
          break;
        }

        case 'spiritWorld': {
          // Dimensional ritual energy drone
          const drone1 = ctx.createOscillator();
          const drone2 = ctx.createOscillator();
          drone1.type = 'sawtooth';
          drone2.type = 'sine';
          drone1.frequency.setValueAtTime(55, ctx.currentTime); // A1
          drone2.frequency.setValueAtTime(110.5, ctx.currentTime); // DETUNED

          const lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.frequency.setValueAtTime(110, ctx.currentTime);
          lp.frequency.linearRampToValueAtTime(450, ctx.currentTime + 4.2);

          const dg = ctx.createGain();
          dg.gain.setValueAtTime(0, ctx.currentTime);
          dg.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 2.0);
          dg.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 5.0);

          drone1.connect(lp);
          drone2.connect(lp);
          lp.connect(dg).connect(master);

          drone1.start(); drone2.start();
          drone1.stop(ctx.currentTime + 5.0); drone2.stop(ctx.currentTime + 5.0);

          // Dissolving energy sparkle tracks
          for (let pIdx = 0; pIdx < 16; pIdx++) {
            const time = ctx.currentTime + pIdx * 0.28;
            const spark = ctx.createOscillator();
            spark.type = 'sine';
            spark.frequency.setValueAtTime(1800 - pIdx * 50, time);
            const sg = ctx.createGain();
            sg.gain.setValueAtTime(0, ctx.currentTime);
            sg.gain.setValueAtTime(0.07, time);
            sg.gain.exponentialRampToValueAtTime(0.001, time + 0.4);
            spark.connect(sg).connect(master);
            spark.start(time);
            spark.stop(time + 0.5);
          }
          break;
        }
      }

      // Smooth envelope decay to silence at the end of transition
      master.gain.setValueAtTime(0.25, ctx.currentTime + timings.fadeStart / 1000);
      master.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + timings.complete / 1000);
    } catch (e) {
      console.warn("Procedural Web Audio skipped: Interaction requirement.", e);
    }
  };

  useEffect(() => {
    const sDelay = setTimeout(() => {
      playStorySound();
    }, 120);
    return () => {
      clearTimeout(sDelay);
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
      }
    };
  }, [selectedAnimation, soundEnabled]);


  // HIGH-QUALITY ADAPTIVE CANVAS RENDERING FOR THE 10 FULL ENVIRONMENT SCENES
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Mobile screen performance check - simplify particle simulation density
    const maxParticles = width < 768 ? 45 : 175;

    // Standard high-performance particle layout pool
    interface VisualEntity {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      color: string;
      alpha: number;
      decay: number;
      angle?: number;
      radius?: number;
      speed?: number;
      waveOffset?: number;
      type?: 'particle' | 'bird' | 'reflection' | 'bubble' | 'fish';
      customSymbol?: string;
    }

    const entities: VisualEntity[] = [];

    const constructEntity = (isInit = false): VisualEntity => {
      const cx = width / 2;
      const cy = height / 2;

      switch (selectedAnimation) {
        case 'fairyLand': {
          const type = Math.random() > 0.88 ? 'bird' : 'particle';
          return {
            type,
            x: Math.random() * width,
            y: isInit ? Math.random() * height : height + 15,
            vx: Math.random() * 0.9 - 0.45,
            vy: -(0.5 + Math.random() * 1.5),
            size: type === 'bird' ? 3 + Math.random() * 3 : 1.5 + Math.random() * 3.5,
            color: Math.random() > 0.5 ? '134, 239, 172' : '244, 114, 182', // Mint green & soft cherry pink
            alpha: Math.random() * 0.8 + 0.1,
            decay: 0.002,
            angle: Math.random() * Math.PI * 2,
            speed: 0.015 + Math.random() * 0.02
          };
        }

        case 'heavenGate': {
          return {
            type: 'particle',
            x: Math.random() * width,
            y: isInit ? Math.random() * height : height + 20,
            vx: Math.random() * 0.3 - 0.15,
            vy: -(0.4 + Math.random() * 1.1),
            size: 1.5 + Math.random() * 3,
            color: Math.random() > 0.45 ? '254, 240, 138' : '255, 255, 255', // golden & pristine white
            alpha: Math.random() * 0.8,
            decay: 0.003,
            waveOffset: Math.random() * 10
          };
        }

        case 'floatingIsland': {
          // Floating waterfall drops & mountain peaks drift
          const type = Math.random() > 0.7 ? 'bubble' : 'particle';
          return {
            type,
            x: Math.random() * width,
            y: type === 'bubble' ? (isInit ? Math.random() * height : height + 10) : (isInit ? Math.random() * height * 0.4 : -10),
            vx: Math.random() * 0.4 - 0.2,
            vy: type === 'bubble' ? -(0.3 + Math.random() * 0.8) : (2.5 + Math.random() * 3.5), // fast falling waterfall droplets
            size: type === 'bubble' ? 2 + Math.random() * 3 : 1.2 + Math.random() * 1.8,
            color: type === 'bubble' ? '186, 230, 253' : '14, 165, 233', // sky sky blue
            alpha: Math.random() * 0.7,
            decay: 0.004
          };
        }

        case 'portalForest': {
          // Swirling energy singularity lines moving towards center
          const angle = Math.random() * Math.PI * 2;
          const radius = isInit ? Math.random() * (width * 0.45) : width * 0.6;
          return {
            type: 'particle',
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            size: 1.0 + Math.random() * 2.5,
            color: Math.random() > 0.4 ? '52, 211, 153' : '34, 197, 94', // emerald/green portal lines
            alpha: isInit ? Math.random() * 0.7 : 0,
            decay: 0.008,
            angle,
            radius,
            speed: 2.2 + Math.random() * 4.8
          };
        }

        case 'stairwaySky': {
          // Twinkling star map particles
          return {
            type: 'particle',
            x: Math.random() * width,
            y: Math.random() * height,
            vx: Math.random() * 0.2 - 0.1,
            vy: -(0.1 + Math.random() * 0.3),
            size: 1.2 + Math.random() * 2.8,
            color: Math.random() > 0.65 ? '192, 132, 252' : '255, 255, 255', // Lilac and white stars
            alpha: Math.random() * 0.9,
            decay: 0.002,
            angle: Math.random() * Math.PI,
            speed: 0.01 + Math.random() * 0.02
          };
        }

        case 'underwaterDream': {
          // Water bubbles and tiny fish paths
          const type = Math.random() > 0.92 ? 'fish' : 'bubble';
          return {
            type,
            x: Math.random() * width,
            y: isInit ? Math.random() * height : height + 15,
            vx: type === 'fish' ? (Math.random() > 0.5 ? 1.5 : -1.5) : (Math.random() * 0.6 - 0.3),
            vy: type === 'fish' ? (Math.random() * 0.4 - 0.2) : -(0.6 + Math.random() * 1.4),
            size: type === 'fish' ? 4 + Math.random() * 4 : 1.5 + Math.random() * 4.5,
            color: type === 'fish' ? '251, 146, 60' : '14, 165, 233', // gold fish in cyan ocean
            alpha: Math.random() * 0.75 + 0.1,
            decay: 0.001,
            waveOffset: Math.random() * Math.PI * 2
          };
        }

        case 'sunriseValley': {
          // Morning pollen rays and fly birds
          const type = Math.random() > 0.92 ? 'bird' : 'particle';
          return {
            type,
            x: Math.random() * width,
            y: isInit ? Math.random() * height : height * 0.8 + Math.random() * height * 0.2,
            vx: type === 'bird' ? (1.2 + Math.random() * 1.5) : (Math.random() * 0.8 - 0.4),
            vy: type === 'bird' ? -(0.2 + Math.random() * 0.4) : -(0.4 + Math.random() * 0.9),
            size: type === 'bird' ? 3.5 + Math.random() * 2.5 : 1.2 + Math.random() * 3.0,
            color: '251, 191, 36', // morning amber gold
            alpha: Math.random() * 0.7 + 0.1,
            decay: 0.003
          };
        }

        case 'galaxyGarden': {
          // Twinkling celestial cosmos garden seeds (spinning spirals)
          const angle = Math.random() * Math.PI * 2;
          const radius = isInit ? Math.random() * 220 : 450;
          return {
            type: 'particle',
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
            size: 1.0 + Math.random() * 2.2,
            color: Math.random() > 0.4 ? '236, 72, 153' : '139, 92, 246', // violet pink cosmic flowers
            alpha: Math.random() * 0.8 + 0.1,
            decay: 0.004,
            angle,
            radius,
            speed: 0.8 + Math.random() * 1.8
          };
        }

        case 'crystalCave': {
          return {
            type: 'reflection',
            x: Math.random() * width,
            y: Math.random() * height,
            vx: Math.random() * 0.4 - 0.2,
            vy: Math.random() * 0.4 - 0.2,
            size: 2.0 + Math.random() * 4.0,
            color: Math.random() > 0.5 ? '45, 212, 191' : '34, 211, 238', // teal & neon blue crystal sparks
            alpha: Math.random() * 0.9,
            decay: 0.005,
            angle: Math.random() * Math.PI * 2,
            speed: 0.01 + Math.random() * 0.02
          };
        }

        case 'spiritWorld': {
          return {
            type: 'particle',
            x: Math.random() * width,
            y: isInit ? Math.random() * height : height + 10,
            vx: Math.random() * 0.8 - 0.4,
            vy: -(0.5 + Math.random() * 2.0),
            size: 2.0 + Math.random() * 4.5,
            color: Math.random() > 0.5 ? '168, 85, 247' : '99, 102, 241', // purple/indigo souls
            alpha: Math.random() * 0.8,
            decay: 0.002,
            angle: Math.random() * Math.PI * 2,
            speed: 0.02 + Math.random() * 0.04
          };
        }

        default: {
          return {
            x: Math.random() * width,
            y: Math.random() * height,
            vx: Math.random() * 1.5 - 0.75,
            vy: Math.random() * 1.5 - 0.75,
            size: 2,
            color: '100, 116, 139',
            alpha: 0.8,
            decay: 0.005
          };
        }
      }
    };

    // Pre-populate elements pool
    for (let i = 0; i < maxParticles; i++) {
      entities.push(constructEntity(true));
    }

    const renderLoop = () => {
      // Background clears or overlay settings to promote depth feel
      if (selectedAnimation === 'underwaterDream') {
        ctx.fillStyle = 'rgba(3, 10, 24, 0.28)'; // Deep aquatic blue tone
      } else if (selectedAnimation === 'crystalCave') {
        ctx.fillStyle = 'rgba(2, 4, 10, 0.24)'; // Dark crystal cave shadows
      } else if (selectedAnimation === 'portalForest') {
        ctx.fillStyle = 'rgba(4, 12, 8, 0.20)'; // Mystic jade woods
      } else {
        ctx.fillStyle = 'rgba(2, 4, 7, 0.25)'; // Cosmos dark void base
      }
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height / 2;

      // Draw Specialized Scene Environments below the entities for a feeling of extreme depth
      if (selectedAnimation === 'fairyLand') {
        // Draw soft back glowing layers
        const radial = ctx.createRadialGradient(cx, cy, 5, cx, cy, width * 0.6);
        radial.addColorStop(0, 'rgba(16, 185, 129, 0.06)');
        radial.addColorStop(0.5, 'rgba(236, 72, 153, 0.03)');
        radial.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, width, height);

        // Subtle mountain trees silhouette at bottom
        ctx.fillStyle = 'rgba(4, 30, 20, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.quadraticCurveTo(width * 0.25, height - 80, width * 0.5, height - 30);
        ctx.quadraticCurveTo(width * 0.75, height - 120, width, height);
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fill();
      }

      else if (selectedAnimation === 'heavenGate') {
        // Celestial Gate golden background pillars & light shafts
        const sunRay = ctx.createRadialGradient(cx, cy - 30, 10, cx, cy - 30, width * 0.55);
        sunRay.addColorStop(0, 'rgba(254, 240, 138, 0.09)');
        sunRay.addColorStop(0.4, 'rgba(245, 158, 11, 0.03)');
        sunRay.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunRay;
        ctx.fillRect(0, 0, width, height);

        // Outer holy gateway circle lines
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.09)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy - 10, 200, Math.PI, 0, false);
        ctx.stroke();

        // Heavenly fluffy cloud outlines
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.beginPath();
        ctx.arc(cx - 220, height, 160, 0, Math.PI * 2);
        ctx.arc(cx + 220, height, 160, 0, Math.PI * 2);
        ctx.arc(cx, height + 40, 200, 0, Math.PI * 2);
        ctx.fill();
      }

      else if (selectedAnimation === 'floatingIsland') {
        // Floating Island layout back silhouette
        ctx.fillStyle = 'rgba(15, 23, 42, 0.65)';
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
        ctx.lineWidth = 1.5;
        // Nearest Island center landmass
        ctx.beginPath();
        ctx.moveTo(cx - 140, height - 10);
        ctx.lineTo(cx - 80, height - 65);
        ctx.lineTo(cx + 80, height - 65);
        ctx.lineTo(cx + 140, height - 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // hanging vines
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
        ctx.beginPath();
        ctx.moveTo(cx - 70, height - 65);
        ctx.bezierCurveTo(cx - 65, height - 20, cx - 80, height - 10, cx - 75, height + 10);
        ctx.moveTo(cx + 50, height - 65);
        ctx.bezierCurveTo(cx + 45, height - 30, cx + 55, height - 20, cx + 50, height + 5);
        ctx.stroke();
      }

      else if (selectedAnimation === 'portalForest') {
        // Deep vortex concentric tracks
        ctx.strokeStyle = 'rgba(52, 211, 153, 0.05)';
        ctx.lineWidth = 1.2;
        for (let ring = 50; ring <= 300; ring += 50) {
          ctx.beginPath();
          ctx.arc(cx, cy, ring, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      else if (selectedAnimation === 'stairwaySky') {
        // Stellar nebula field
        const nebula = ctx.createRadialGradient(cx, cy, 5, cx, cy, width * 0.7);
        nebula.addColorStop(0, 'rgba(147, 51, 234, 0.05)');
        nebula.addColorStop(0.5, 'rgba(59, 130, 246, 0.03)');
        nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = nebula;
        ctx.fillRect(0, 0, width, height);

        // Diagonal cyber stairway guide rails (Rising high into top-right)
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.14)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cx - 180, height);
        ctx.lineTo(cx + 140, cy - 100);
        ctx.stroke();

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.14)';
        ctx.beginPath();
        ctx.moveTo(cx - 110, height);
        ctx.lineTo(cx + 210, cy - 100);
        ctx.stroke();

        // Glow steps rising
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        for (let step = 0; step < 9; step++) {
          const ratio = step / 9;
          const sx = (cx - 180) + (140 - (cx - 180)) * ratio;
          const sy = height - (height - (cy - 100)) * ratio;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + 70, sy);
          ctx.stroke();
        }
      }

      else if (selectedAnimation === 'underwaterDream') {
        // Ocean surface light flickering rays
        const surfaceRays = ctx.createLinearGradient(0, 0, width, 0);
        surfaceRays.addColorStop(0, 'rgba(14, 165, 233, 0.12)');
        surfaceRays.addColorStop(0.4, 'rgba(56, 189, 248, 0.03)');
        surfaceRays.addColorStop(0.7, 'rgba(14, 165, 233, 0.15)');
        surfaceRays.addColorStop(1, 'rgba(3, 105, 161, 0.08)');
        ctx.fillStyle = surfaceRays;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(width * 0.1, height * 0.45);
        ctx.lineTo(width * 0.35, 0);
        ctx.lineTo(width * 0.7, height * 0.55);
        ctx.lineTo(width, 0);
        ctx.closePath();
        ctx.fill();
      }

      else if (selectedAnimation === 'sunriseValley') {
        // Dynamic glowing sun halo
        const sunHalo = ctx.createRadialGradient(cx, height * 0.3, 10, cx, height * 0.3, width * 0.5);
        sunHalo.addColorStop(0, 'rgba(251, 191, 36, 0.12)');
        sunHalo.addColorStop(0.6, 'rgba(239, 68, 68, 0.03)');
        sunHalo.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = sunHalo;
        ctx.fillRect(0, 0, width, height);

        // Valley mountain ranges silhouettes
        ctx.fillStyle = 'rgba(24, 16, 8, 0.55)';
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo(0, height - 120);
        ctx.lineTo(width * 0.3, height - 200);
        ctx.lineTo(width * 0.6, height - 140);
        ctx.lineTo(width, height - 240);
        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      else if (selectedAnimation === 'crystalCave') {
        // Large vector glowing crystal stalactites coordinates
        ctx.strokeStyle = 'rgba(45, 212, 191, 0.15)';
        ctx.fillStyle = 'rgba(13, 148, 136, 0.04)';
        ctx.lineWidth = 1.2;

        const crystals = [
          { px: 40, py: 0, w: 50, h: 220 },
          { px: width - 80, py: 0, w: 60, h: 280 },
          { px: 110, py: height, w: 45, h: -140 },
          { px: width - 200, py: height, w: 70, h: -180 },
        ];

        crystals.forEach(c => {
          ctx.beginPath();
          ctx.moveTo(c.px, c.py);
          ctx.lineTo(c.px + c.w / 2, c.py + c.h);
          ctx.lineTo(c.px + c.w, c.py);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        });
      }

      else if (selectedAnimation === 'spiritWorld') {
        // Mystical violet dimensional vortex glow
        const spiritDust = ctx.createRadialGradient(cx, cy, 20, cx, cy, width * 0.5);
        spiritDust.addColorStop(0, 'rgba(168, 85, 247, 0.08)');
        spiritDust.addColorStop(0.6, 'rgba(99, 102, 241, 0.03)');
        spiritDust.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = spiritDust;
        ctx.fillRect(0, 0, width, height);
      }


      // Animate and render entities (flying birds, bubbles, custom particles)
      for (let i = 0; i < entities.length; i++) {
        const e = entities[i];

        if (selectedAnimation === 'portalForest') {
          // Collapse/spiral inward dynamically
          const tx = cx + Math.cos(e.angle || 0) * (e.radius || 0);
          const ty = cy + Math.sin(e.angle || 0) * (e.radius || 0);

          e.radius = (e.radius || 0) - (e.speed || 1.8) * (1.1 + (width * 0.6 - (e.radius || 0)) / (width * 0.6) * 4);
          e.angle = (e.angle || 0) + 0.022 + (150 - Math.min(150, e.radius || 0)) / 2500;

          const nx = cx + Math.cos(e.angle || 0) * (e.radius || 0);
          const ny = cy + Math.sin(e.angle || 0) * (e.radius || 0);

          e.alpha = Math.min(0.9, e.alpha + 0.04);

          if ((e.radius || 0) < 8) {
            entities[i] = constructEntity(false);
            continue;
          }

          ctx.strokeStyle = `rgba(${e.color}, ${e.alpha})`;
          ctx.lineWidth = e.size;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(nx, ny);
          ctx.stroke();
        }

        else if (selectedAnimation === 'galaxyGarden') {
          // Spiral orbits with rotating stars
          e.radius = (e.radius || 300) - (e.speed || 1.1);
          e.angle = (e.angle || 0) + 0.015;

          const gx = cx + Math.cos(e.angle) * (e.radius || 300);
          const gy = cy + Math.sin(e.angle) * (e.radius || 300) * 0.45; // Elliptical distortion

          ctx.fillStyle = `rgba(${e.color}, ${e.alpha})`;
          ctx.beginPath();
          ctx.arc(gx, gy, e.size, 0, Math.PI * 2);
          ctx.fill();

          if ((e.radius || 300) < 6) {
            entities[i] = constructEntity(false);
          }
        }

        else if (e.type === 'bird') {
          // Animated horizontal horizontal bird soaring paths
          e.x += e.vx;
          e.y += e.vy;
          const wingSpan = e.size * 2.2;
          const flap = Math.sin(Date.now() * 0.015 + e.x * 0.03) * 3;

          ctx.strokeStyle = `rgba(${e.color}, ${e.alpha})`;
          ctx.lineWidth = 1.3;
          ctx.beginPath();
          ctx.moveTo(e.x - wingSpan, e.y + flap);
          ctx.lineTo(e.x, e.y);
          ctx.lineTo(e.x + wingSpan, e.y + flap);
          ctx.stroke();

          if (e.x > width + wingSpan || e.y < -30) {
            entities[i] = constructEntity(false);
          }
        }

        else if (e.type === 'fish') {
          // Biomorphic swerving organic fish lines
          e.x += e.vx;
          e.y += e.vy;
          const wiggle = Math.sin(Date.now() * 0.009 + e.x * 0.06) * 4;

          ctx.fillStyle = `rgba(${e.color}, ${e.alpha})`;
          // Draw beautiful small vector arrowheads as bio fishes
          ctx.beginPath();
          ctx.moveTo(e.x, e.y);
          ctx.lineTo(e.x - e.vx * 3, e.y - 4 + wiggle);
          ctx.lineTo(e.x - e.vx * 3, e.y + 4 + wiggle);
          ctx.closePath();
          ctx.fill();

          if (e.x < -20 || e.x > width + 20) {
            entities[i] = constructEntity(false);
          }
        }

        else if (selectedAnimation === 'underwaterDream' && e.type === 'bubble') {
          // Bubbles rising up with sinusoidal waves swaying
          e.y += e.vy;
          e.angle = (e.angle || 0) + 0.02;
          e.x += Math.sin(e.angle + (e.waveOffset || 0)) * 0.6;

          ctx.strokeStyle = `rgba(${e.color}, ${e.alpha})`;
          ctx.lineWidth = 1;
          ctx.fillStyle = `rgba(${e.color}, ${e.alpha * 0.15})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Highlight dot
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.beginPath();
          ctx.arc(e.x - e.size * 0.3, e.y - e.size * 0.3, 0.6, 0, Math.PI * 2);
          ctx.fill();

          if (e.y < -15) {
            entities[i] = constructEntity(false);
          }
        }

        else {
          // standard floating dust (stairwaySky, spiritRise, heavenGate)
          e.y += e.vy;
          e.x += e.vx;
          e.alpha -= e.decay;

          if (selectedAnimation === 'heavenGate') {
            const wave = Math.sin(Date.now() * 0.002 + (e.waveOffset || 0)) * 0.3;
            e.x += wave;
          }

          ctx.fillStyle = `rgba(${e.color}, ${Math.max(0.01, e.alpha)})`;
          ctx.beginPath();
          ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
          ctx.fill();

          if (e.alpha <= 0 || e.y < -10 || e.y > height + 20) {
            entities[i] = constructEntity(false);
          }
        }
      }

      animId = requestAnimationFrame(renderLoop);
    };

    renderLoop();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);
    };
  }, [selectedAnimation, transitionProgress]);

  // IMMERSIVE STORY METADATA MAPPINGS
  const storyDetails = useMemo(() => {
    switch (selectedAnimation) {
      case 'fairyLand':
        return {
          badge: 'Fairy Land Entry 🌸',
          themeClass: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(52,211,153,0.3)]',
          gradientBg: 'from-emerald-500 via-teal-600 to-pink-500',
          desc: 'Glowing forests emerge. Birds take wing. Ascending deep into the canopy...',
          actionText: 'Slowly walking forward...'
        };
      case 'heavenGate':
        return {
          badge: 'Heaven Cloud Gate ☁️',
          themeClass: 'text-amber-300 border-amber-500/20 bg-amber-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(251,191,36,0.3)]',
          gradientBg: 'from-amber-500 via-yellow-600 to-slate-900',
          desc: 'Clouds parting. The ancient Golden Gate swings open slowly. Enter the bright light...',
          actionText: 'Ascending staircase and entering gate...'
        };
      case 'floatingIsland':
        return {
          badge: 'Floating Island World 🏝️',
          themeClass: 'text-sky-300 border-sky-500/20 bg-sky-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(56,189,248,0.3)]',
          gradientBg: 'from-sky-500 via-indigo-600 to-sky-900',
          desc: 'Floating islands drift in light air. Waterfalls rush. Preparing leap forward.',
          actionText: 'Leaping towards the nearest skyline island...'
        };
      case 'portalForest':
        return {
          badge: 'Magic Portal Forest 🌿',
          themeClass: 'text-green-300 border-green-500/20 bg-green-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(34,197,94,0.35)]',
          gradientBg: 'from-green-500 via-emerald-600 to-teal-800',
          desc: 'Ancient woods hum as a high-density green portal spins. Energy surrounds you.',
          actionText: 'Sucked into portal core singularity...'
        };
      case 'stairwaySky':
        return {
          badge: 'Stairway to Sky 🌌',
          themeClass: 'text-purple-300 border-purple-500/20 bg-purple-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(168,85,247,0.3)]',
          gradientBg: 'from-purple-600 via-violet-800 to-slate-950',
          desc: 'Gleaming platform rungs rise directly into starlight and planetary rings.',
          actionText: 'Ascending starry staircase step-by-step...'
        };
      case 'underwaterDream':
        return {
          badge: 'Underwater Dream 🐠',
          themeClass: 'text-cyan-300 border-cyan-500/20 bg-cyan-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(34,211,238,0.35)]',
          gradientBg: 'from-cyan-500 via-blue-600 to-indigo-900',
          desc: 'Gliding underwater. Soft bubbles rise. Bioluminescent aquatic entities swirl close.',
          actionText: 'Floating upward to surface oceans...'
        };
      case 'sunriseValley':
        return {
          badge: 'Sunrise Valley 🌄',
          themeClass: 'text-orange-300 border-orange-500/20 bg-orange-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(249,115,22,0.35)]',
          gradientBg: 'from-orange-500 via-amber-600 to-red-950',
          desc: 'Morning sun climbs past visual ridges. Breathe the valley wind.',
          actionText: 'Walking directly into sunrise heat...'
        };
      case 'galaxyGarden':
        return {
          badge: 'Galaxy Garden ✨',
          themeClass: 'text-fuchsia-300 border-fuchsia-500/20 bg-fuchsia-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(217,70,239,0.34)]',
          gradientBg: 'from-fuchsia-500 via-purple-700 to-rose-950',
          desc: 'Outer-space garden clusters rotate. Celestial glowing petals drift past planetary cores.',
          actionText: 'Zooming into galaxy heart cluster...'
        };
      case 'crystalCave':
        return {
          badge: 'Crystal Cave 💎',
          themeClass: 'text-teal-300 border-teal-500/20 bg-teal-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(45,212,191,0.35)]',
          gradientBg: 'from-teal-500 via-cyan-600 to-slate-950',
          desc: 'Bioluminescent stalactites reflect teal light. Walk deeper into crystal shards.',
          actionText: 'Merging with crystallographic central core...'
        };
      case 'spiritWorld':
        return {
          badge: 'Spirit World 🔮',
          themeClass: 'text-indigo-300 border-indigo-500/20 bg-indigo-500/5',
          glowEffect: 'shadow-[0_0_100px_rgba(99,102,241,0.35)]',
          gradientBg: 'from-indigo-500 via-purple-600 to-indigo-950',
          desc: 'Purple energetic aura mist. Soft ethereal signals play inside the corridor.',
          actionText: 'Dissolving body particles into digital code...'
        };
      default:
        return {
          badge: 'Security Portal Handshake',
          themeClass: 'text-slate-400 border-slate-500/20 bg-slate-500/5',
          glowEffect: 'shadow-[0_0_80px_rgba(255,255,255,0.1)]',
          gradientBg: 'from-slate-700 to-slate-900',
          desc: 'Synchronizing with workspace coordinates.',
          actionText: 'Loading systems...'
        };
    }
  }, [selectedAnimation]);

  const getStoryStatusText = () => {
    if (transitionProgress === 0) return 'Analyzing environmental pipeline...';
    if (transitionProgress === 1) return `Establishing: [${selectedAnimation.toUpperCase()}]`;
    if (transitionProgress === 2) return `Handshake secure. Calibrating workspace telemetry...`;
    return 'Decrypting secure corridors. Welcoming explorer!';
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#020306] overflow-hidden flex flex-col items-center justify-center font-sans select-none">
      
      {/* Visual Canvas Backdrop */}
      <canvas ref={canvasRef} className="absolute inset-0 block z-0 pointer-events-none" />

      {/* Mesmeric gradient light flare center */}
      <div className={`absolute w-[450px] md:w-[700px] h-[450px] md:h-[700px] rounded-full blur-[140px] opacity-25 z-0 bg-gradient-to-tr ${storyDetails.gradientBg}`} />

      {/* Immersive Scanlines filter */}
      <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.3)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%]" />

      {/* Cinematic HUD Header */}
      <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-20 pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-sm font-black text-white shadow-xl">
            SY
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">SYNORA TRANSIT PIPELINE</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] font-mono font-bold text-emerald-400 uppercase">THEME: {selectedAnimation}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Sounds switch */}
          <button
            onClick={toggleSound}
            className="p-2.5 bg-slate-950/80 hover:bg-slate-900 border border-white/10 text-slate-400 hover:text-white rounded-xl transition-all shadow-md flex items-center justify-center"
            title={soundEnabled ? "Mute Procedural Audio" : "Unmute Procedural Audio"}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400 animate-pulse" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

          {/* Cinematic Skip interaction */}
          <button
            onClick={triggerSkip}
            className="px-4 py-2 bg-slate-950/90 hover:bg-slate-900 border border-white/10 text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white rounded-xl transition-all shadow-2xl flex items-center gap-2"
          >
            <span>Skip Cinematic</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>
      </div>

      {/* CHARACTER PORTAL SCENERY CONTROLS */}
      <div className="relative z-10 w-full max-w-2xl px-6 flex flex-col items-center justify-center text-center text-white" style={{ perspective: '1600px' }}>
        
        <AnimatePresence mode="wait">

          {/* DYNAMIC CHARACTER OBJECT (Glowing letter avatar, leaps/scales/walks based on choice!) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4, y: 35 }}
            animate={{ 
              opacity: transitionProgress === 3 ? 0 : 1, 
              // Different dynamic camera & character movements per layout style!
              scale: selectedAnimation === 'portalForest'
                ? (transitionProgress === 2 ? 0.3 : transitionProgress === 1 ? 0.8 : 1)
                : selectedAnimation === 'crystalCave'
                ? (transitionProgress === 2 ? 1.35 : 1)
                : selectedAnimation === 'galaxyGarden'
                ? (transitionProgress === 2 ? 1.25 : 1)
                : transitionProgress === 3 ? 0.2 : transitionProgress === 2 ? 1.15 : 1,
              y: selectedAnimation === 'stairwaySky' 
                ? (transitionProgress === 2 ? -180 : transitionProgress === 1 ? -90 : 20)
                : selectedAnimation === 'underwaterDream'
                ? (transitionProgress === 2 ? -200 : transitionProgress === 1 ? -100 : 20)
                : selectedAnimation === 'floatingIsland'
                ? (transitionProgress === 2 ? -60 : transitionProgress === 1 ? -120 : 15) // hops to island
                : 15,
              rotate: selectedAnimation === 'portalForest' 
                ? (transitionProgress * 120) 
                : selectedAnimation === 'galaxyGarden' 
                ? (transitionProgress * 90) 
                : 0,
              filter: transitionProgress === 3 ? 'blur(15px)' : 'blur(0px)'
            }}
            transition={{ type: 'spring', stiffness: 50, damping: 13 }}
            className="relative z-20 flex flex-col items-center justify-center mb-6"
          >
            {/* Glowing Orb containing first letter representation (glowing orb and letter avatar) */}
            <div className={`relative w-24 h-24 rounded-full flex items-center justify-center border-2 border-white/20 bg-slate-950/95 shadow-2.5xl ${storyDetails.glowEffect}`}>
              
              {/* Rotating glowing orbit rings */}
              <div className={`absolute -inset-2.5 rounded-full border border-dashed border-white/10 animate-[spin_10s_linear_infinite]`} />
              <div className={`absolute -inset-4 rounded-full border border-double border-white/5 animate-[spin_18s_linear_infinite_reverse]`} />
              
              {/* First letter avatar */}
              <span className="text-3xl font-extrabold font-mono tracking-tight text-white uppercase bg-clip-text">
                [ {initialChar} ]
              </span>

              {/* Pulsing secure lock indicator */}
              <span className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-emerald-500 border-2 border-slate-950 flex items-center justify-center" />
            </div>

            {/* Glowing light projection below avatar */}
            <div className="w-16 h-3 bg-white/5 rounded-full blur-[4px] mt-2.5 animate-pulse mx-auto opacity-75" />
          </motion.div>

        </AnimatePresence>

        <AnimatePresence mode="wait">
          {/* ==================== 1. FAIRY LAND ENVIRONMENT CANVAS HUD ==================== */}
          {selectedAnimation === 'fairyLand' && (
            <motion.div 
              key="fairyland"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: transitionProgress === 3 ? 0.7 : 1 }}
              exit={{ opacity: 0 }}
              className="relative w-80 h-32 mb-6 flex flex-col items-center justify-center gap-1.5"
            >
              <div className="flex items-center gap-3 text-emerald-400/80 animate-pulse">
                <Trees className="w-8 h-8 animate-bounce" style={{ animationDuration: '2.5s' }} />
                <span className="w-2 h-2 rounded-full bg-pink-400" />
                <Sparkles className="w-7 h-7 text-pink-400 animate-pulse" />
              </div>
              <span className="text-[9px] font-mono tracking-widest text-emerald-450 uppercase mt-1">
                glowing cherry trees blossoms
              </span>
            </motion.div>
          )}

          {/* ==================== 2. HEAVEN CLOUD GATE ENVIRONMENT HUD ==================== */}
          {selectedAnimation === 'heavenGate' && (
            <motion.div 
              key="heavengate"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-80 h-44 mb-6 flex items-center justify-center overflow-hidden rounded-3xl"
            >
              <div className="absolute inset-x-0 flex items-center justify-center gap-2">
                {/* Left golden gate door */}
                <motion.div 
                  initial={{ x: 0 }}
                  animate={{ x: transitionProgress >= 2 ? -130 : 0 }}
                  transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                  className="w-22 h-36 bg-slate-950/90 border-r border-amber-500/30 rounded-l-2xl shadow-[0_0_30px_rgba(251,191,36,0.12)] flex items-center justify-end pr-3.5"
                >
                  <Cloud className="w-5 h-5 text-amber-500/50" />
                </motion.div>

                {/* center aperture line */}
                <div className="w-1 h-36 bg-gradient-to-b from-transparent via-amber-300 to-transparent blur-[1px] opacity-20" />

                {/* Right golden gate door */}
                <motion.div 
                  initial={{ x: 0 }}
                  animate={{ x: transitionProgress >= 2 ? 130 : 0 }}
                  transition={{ duration: 1.8, ease: [0.16, 1, 0.3, 1] }}
                  className="w-22 h-36 bg-slate-950/90 border-l border-amber-500/30 rounded-r-2xl shadow-[0_0_30px_rgba(251,191,36,0.12)] flex items-center justify-start pl-3.5"
                >
                  <Cloud className="w-5 h-5 text-amber-500/50" />
                </motion.div>
              </div>

              {/* Emerging radiant center gold star */}
              <AnimatePresence>
                {transitionProgress >= 2 && (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.1 }}
                    animate={{ opacity: 1, scale: 1.25 }}
                    className="absolute w-12 h-12 rounded-full bg-white shadow-[0_0_50px_#fef08a] flex items-center justify-center"
                  >
                    <Sun className="w-6 h-6 text-amber-500 animate-spin" style={{ animationDuration: '15s' }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ==================== 3. FLOATING ISLAND WORLD HUD ==================== */}
          {selectedAnimation === 'floatingIsland' && (
            <motion.div 
              key="floatingisland"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative w-85 h-36 mb-6 flex flex-col items-center justify-center gap-2"
            >
              <div className="flex items-center gap-3 text-sky-400">
                <Compass className="w-7 h-7 animate-[spin_10s_linear_infinite]" />
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-black uppercase tracking-wider text-sky-200">ISLAND RADAR LOCATED</span>
                  <span className="text-[7.5px] font-mono text-sky-500 uppercase font-bold">ALTITUDE: 14,500 FT // WATERFALLS DETECTED</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 4. MAGIC PORTAL FOREST HUD ==================== */}
          {selectedAnimation === 'portalForest' && (
            <motion.div 
              key="portalforest"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ 
                opacity: 1, 
                scale: transitionProgress === 3 ? 0.1 : transitionProgress === 2 ? 1.25 : 1,
                rotate: transitionProgress >= 2 ? [0, 90, 180] : 0 
              }}
              className="relative w-48 h-48 mb-6 flex items-center justify-center"
            >
              <div className="absolute inset-1 rounded-full border-2 border-dashed border-green-500/30 animate-[ping_3.2s_infinite]" />
              <div className="w-36 h-36 rounded-full border-[3px] border-emerald-500/35 border-t-emerald-300 flex items-center justify-center">
                <Workflow className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
            </motion.div>
          )}

          {/* ==================== 5. STAIRWAY TO SKY HUD ==================== */}
          {selectedAnimation === 'stairwaySky' && (
            <motion.div 
              key="stairwaysky"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-80 h-36 mb-6 flex flex-col items-center justify-end"
            >
              <div className="flex items-center gap-2.5 text-purple-400 animate-pulse mb-3">
                <Moon className="w-6 h-6" />
                <span className="text-[9px] font-mono tracking-widest text-purple-300 uppercase">
                  ascending stairs to galaxy core
                </span>
              </div>
            </motion.div>
          )}

          {/* ==================== 6. UNDERWATER DREAM HUD ==================== */}
          {selectedAnimation === 'underwaterDream' && (
            <motion.div 
              key="underwaterdream"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-80 h-36 mb-6 flex flex-col items-center justify-center gap-2"
            >
              <div className="flex items-center gap-3 text-cyan-400 animate-pulse">
                <Waves className="w-8 h-8 animate-[bounce_2s_infinite]" />
                <span className="text-[9px] font-mono tracking-widest text-cyan-300 uppercase">
                  ocean swell // bio-signals locking
                </span>
              </div>
            </motion.div>
          )}

          {/* ==================== 7. SUNRISE VALLEY HUD ==================== */}
          {selectedAnimation === 'sunriseValley' && (
            <motion.div 
              key="sunrisevalley"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-80 h-36 mb-6 flex flex-col items-center justify-center gap-2"
            >
              <div className="flex items-center gap-2.5 text-amber-400 animate-pulse">
                <Sun className="w-8 h-8" />
                <span className="text-[9px] font-mono tracking-widest text-amber-350 uppercase">
                  morning solar rays stabilizing
                </span>
              </div>
            </motion.div>
          )}

          {/* ==================== 8. GALAXY GARDEN HUD ==================== */}
          {selectedAnimation === 'galaxyGarden' && (
            <motion.div 
              key="galaxygarden"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-80 h-36 mb-6 flex flex-col items-center justify-center gap-1.5"
            >
              <div className="flex items-center gap-3 text-fuchsia-400 animate-pulse">
                <Sparkles className="w-7 h-7" />
                <span className="text-[9px] font-mono tracking-widest text-fuchsia-300 uppercase">
                  spinning space nebula flora
                </span>
              </div>
            </motion.div>
          )}

          {/* ==================== 9. CRYSTAL CAVE HUD ==================== */}
          {selectedAnimation === 'crystalCave' && (
            <motion.div 
              key="crystalcave"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative w-80 h-36 mb-6 flex flex-col items-center justify-center gap-1.5"
            >
              <div className="flex items-center gap-3 text-teal-405">
                <Gem className="w-7 h-7 text-teal-400 animate-bounce" />
                <div className="text-left">
                  <span className="text-[9px] font-black uppercase tracking-wider text-teal-200">CRYSTALLOGRAPHIC HANDSHAKE</span>
                  <span className="text-[7.5px] font-mono block text-teal-500 uppercase font-bold">REFLECTIONS LOCKED ● STABLE</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ==================== 10. SPIRIT WORLD HUD ==================== */}
          {selectedAnimation === 'spiritWorld' && (
            <motion.div 
              key="spiritworld"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative w-85 h-36 mb-6 flex flex-col items-center justify-center gap-2"
            >
              <div className="flex items-center gap-2.5 text-indigo-400 animate-pulse">
                <Wind className="w-7 h-7" />
                <span className="text-[9px] font-mono tracking-widest text-indigo-300 uppercase">
                  portal aura // soul dissolution active
                </span>
              </div>
            </motion.div>
          )}

        </AnimatePresence>

        {/* PERSONALIZED USER BANNER & ACTION TEXTS */}
        <div className="w-full flex flex-col items-center mt-2.5" style={{ transformStyle: 'preserve-3d' }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 15 }}
            animate={{ 
              opacity: transitionProgress === 3 ? 0 : 1, 
              scale: transitionProgress === 3 ? 0.35 : transitionProgress === 2 ? 1.05 : 1,
              y: transitionProgress === 3 ? -90 : 0
            }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="flex flex-col items-center space-y-3"
          >
            {/* Immersive HUD Badge */}
            <span className={`text-[10px] font-black uppercase tracking-[0.3em] ${storyDetails.themeClass} flex items-center gap-2 py-1.5 px-6 rounded-full border shadow-xl`}>
              <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
              {storyDetails.badge}
            </span>

            {/* Split Username anim sequence */}
            <div className="flex justify-center flex-wrap gap-x-4 gap-y-1">
              {userName.split(' ').map((word, wIdx) => (
                <div key={wIdx} className="flex gap-0.5">
                  {word.split('').map((letter, lIdx) => (
                    <motion.span
                      key={lIdx}
                      initial={{ opacity: 0, scale: 0.5, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.45, delay: (wIdx * 3 + lIdx) * 0.05 }}
                      className="text-4xl md:text-5xl font-black font-sans tracking-tight text-white uppercase inline-block"
                    >
                      {letter}
                    </motion.span>
                  ))}
                </div>
              ))}
            </div>

            {/* Lore environment description text */}
            <p className="text-[10px] text-slate-400 font-medium italic max-w-md mt-1 leading-relaxed">
              {storyDetails.desc}
            </p>

            {/* Telemetry tunnel mapping code */}
            <div className="text-[9.5px] font-mono leading-none text-slate-500 uppercase tracking-widest bg-slate-950/80 p-2.5 px-6 rounded-2xl border border-white/5 shadow-2xl flex items-center gap-1.5">
              <span>EXPLORER_GUID:</span>
              <span className="text-white font-black">{userName.toUpperCase().replace(/\s+/g, '_')}</span>
              <span className="text-slate-600">//</span>
              <span className={`font-semibold text-xs animate-pulse ${storyDetails.themeClass.split(' ')[0]}`}>{selectedAnimation.toUpperCase()}</span>
            </div>
          </motion.div>
        </div>

        {/* TRANSIT STEP PROGRESS BAR */}
        <div className="absolute bottom-10 flex flex-col items-center gap-3">
          <div className="h-[2px] w-32 bg-slate-900 rounded-full overflow-hidden">
            <motion.div 
              initial={{ x: '-100%' }}
              animate={{ 
                x: transitionProgress === 3 ? '100%' : transitionProgress === 2 ? '45%' : '15%' 
              }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full w-2/3 bg-gradient-to-r ${storyDetails.gradientBg}`}
            />
          </div>
          
          {/* Active coordinate loading text message */}
          <span className="text-[8.5px] font-mono tracking-[0.18em] font-black text-slate-400 uppercase animate-pulse">
            {storyDetails.actionText} • {getStoryStatusText()}
          </span>

          <span className="text-[7.5px] font-mono text-slate-600 uppercase block select-none">
            [ Press Esc / Space key or skip to enter instant ]
          </span>
        </div>

      </div>
    </div>
  );
};
