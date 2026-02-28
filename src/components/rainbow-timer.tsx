
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Confetti, ConfettiRain } from './confetti';
import { cn } from '@/lib/utils';
import { TimeUnitSwitch } from './time-unit-switch';
import {
  requestNotificationPermissions,
  scheduleTimerNotification,
  cancelAllNotifications,
  setupNotificationChannels
} from '@/services/native-notifications';
import { keepAwake, allowSleep } from '@/services/wake-lock';
import { isNativePlatform, isAndroid } from '@/services/platform-utils';
import {
  startTimerForegroundService,
  stopTimerForegroundService,
  updateTimerNotification
} from '@/services/foreground-service';
import {
  shouldShowBatteryDialog,
  requestBatteryOptimizationExemption
} from '@/services/battery-optimization';

const SIZE = 320;
const CENTER = SIZE / 2;
const DIAL_RADIUS = SIZE / 2 - 40;
const RAINBOW_OUTER_RADIUS = DIAL_RADIUS + 0.5;
const LABEL_RADIUS = DIAL_RADIUS + 20;
const TICK_START_RADIUS = DIAL_RADIUS - 8;
const TICK_END_RADIUS = DIAL_RADIUS;
const MAX_TIME_HR_MS = 12 * 60 * 60 * 1000;
const MAX_TIME_MIN_MS = 60 * 60 * 1000;
const MAX_TIME_SEC_MS = 60 * 1000;
const HR_SNAP_UNIT_MS = 5 * 60 * 1000;

function getMaxTimeMs(unit: 'hr' | 'min' | 'sec'): number {
    if (unit === 'hr') return MAX_TIME_HR_MS;
    if (unit === 'min') return MAX_TIME_MIN_MS;
    return MAX_TIME_SEC_MS;
}

interface Particle {
    key: string;
    startX: number; startY: number;
    dx: number; dy: number;
    color: string; r: number;
    duration: number; delay: number;
}
const INNER_WHITE_RADIUS = RAINBOW_OUTER_RADIUS * 0.47;

const CENTER_CIRCLE_RADIUS = DIAL_RADIUS * 0.25;
const INDICATOR_START_RADIUS = CENTER_CIRCLE_RADIUS * 0.2;
const INDICATOR_END_RADIUS = CENTER_CIRCLE_RADIUS * 0.85;


const ticks = Array.from({ length: 12 }, (_, i) => (i + 1) * 5);

// From outside to inside: Red, Orange, Yellow, Green, Blue, Indigo, Violet
// Rendered from inside out.
const ringColors = ['#70369d', '#4b369d', '#487de7', '#79c314', '#faeb36', '#ffa500', '#e81416'];
const bandWidth = (RAINBOW_OUTER_RADIUS - INNER_WHITE_RADIUS) / ringColors.length;

const INDIGO = '#4b369d';
const numberColors = [...ringColors].reverse();

const TIMER_STORAGE_KEY = 'rainbowTimerData';


const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

const interpolateAngleShortestPath = (start: number, end: number, progress: number) => {
    let delta = end - start;
    if (delta > 180) {
        delta -= 360;
    } else if (delta < -180) {
        delta += 360;
    }
    const rawAngle = start + delta * progress;
    return rawAngle < 0 ? rawAngle + 360 : rawAngle;
};

const interpolateAngleForSet = (start: number, end: number, progress: number) => {
    const delta = end - start;
    const result = start + delta * progress;
    return result;
};


export function RainbowTimer({ isFullscreen, onFullscreenChange, isPartyMode, isForcedFullscreen, titleBangTrigger, onInterruptCelebration, isUIVisible, titleRef }: { isFullscreen: boolean; onFullscreenChange: (isFs: boolean) => void; isPartyMode: boolean; isForcedFullscreen: boolean; titleBangTrigger: number; onInterruptCelebration: (e: MouseEvent | TouchEvent) => void; isUIVisible: boolean; titleRef: React.RefObject<HTMLDivElement>; }) {
    const [hasMounted, setHasMounted] = useState(false);
    const [angle, setAngle] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(isDragging);
    isDraggingRef.current = isDragging;
    const [timeData, setTimeData] = useState<{ startTime: number; duration: number } | null>(null);
    const timeDataRef = useRef(timeData);
    timeDataRef.current = timeData;
    const containerRef = useRef<HTMLDivElement>(null);
    const countdownFrameId = useRef<number | null>(null);
    const lastDragAngle = useRef<number | null>(null);
    const interactionStartRef = useRef<{time: number, angle: number, wasRunning: boolean} | null>(null);
    const quickSetAnimationId = useRef<number | null>(null);
    const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const angleRef = useRef(angle);
    
    const [isMuted, setIsMuted] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
    const [animationState, setAnimationState] = useState<'idle' | 'bursting'>('idle');
    
    const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
    const isAlarmPlayingRef = useRef(isAlarmPlaying);
    isAlarmPlayingRef.current = isAlarmPlaying;

    const [isRaining, setIsRaining] = useState(false);
    const [isCelebrating, setIsCelebrating] = useState(false);
    const [mountConfettiRain, setMountConfettiRain] = useState(false);
    const [interruptionTime, setInterruptionTime] = useState<number | null>(null);
    const [burstOrigin, setBurstOrigin] = useState<{ x: number, y: number } | null>(null);
    
    const interruptedRef = useRef(false);
    const isCelebratingRef = useRef(isCelebrating);
    isCelebratingRef.current = isCelebrating;
    const animationStateRef = useRef(animationState);
    animationStateRef.current = animationState;
    const isRainingRef = useRef(isRaining);
    isRainingRef.current = isRaining;

    const lastTickSecond = useRef<number | null>(null);

    const [timeUnit, setTimeUnit] = useState<'hr' | 'min' | 'sec'>('min');
    const [isDetailView, setIsDetailView] = useState(false);

    const [isTransitioningToAutoSec, setIsTransitioningToAutoSec] = useState(false);
    const [isTransitioningToAutoMin, setIsTransitioningToAutoMin] = useState(false);
    
    const isPartyModeRef = useRef(isPartyMode);
    isPartyModeRef.current = isPartyMode;
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;
    const timeUnitRef = useRef(timeUnit);
    timeUnitRef.current = timeUnit;
    const isDetailViewRef = useRef(isDetailView);
    isDetailViewRef.current = isDetailView;

    const wasAutoSwitchedRef = useRef(false);
    const wasAutoSwitchedToMinRef = useRef(false);

    const displayUnitModeForSwitch = wasAutoSwitchedRef.current ? "auto-sec"
        : wasAutoSwitchedToMinRef.current ? "auto-min"
        : timeUnit === 'sec' ? "sec"
        : timeUnit === 'hr' ? "hr"
        : "min";

    const [secModeProgress, setSecModeProgress] = useState(0);
    const secModeProgressRef = useRef(0);
    const secModeAnimRef = useRef<number | null>(null);

    const [hrModeProgress, setHrModeProgress] = useState(0);
    const hrModeProgressRef = useRef(0);
    const hrModeAnimRef = useRef<number | null>(null);

    const [explosionParticles, setExplosionParticles] = useState<Particle[]>([]);
    const explosionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const explosionCounterRef = useRef(0);
    const prevTimeUnitRef = useRef<'hr' | 'min' | 'sec'>('min');

    const onInterruptCelebrationRef = useRef(onInterruptCelebration);
    onInterruptCelebrationRef.current = onInterruptCelebration;

    const initializeAudio = useCallback(async () => {
        if (typeof window === 'undefined') return false;
        if (!audioContextRef.current) {
            try {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) { return false; }
        }
        if (audioContextRef.current.state === 'suspended') {
            try {
                await audioContextRef.current.resume();
            } catch (e) { return false; }
        }
        if (!alarmAudioRef.current) {
            alarmAudioRef.current = new Audio('/party-horn.mp3');
            alarmAudioRef.current.loop = true;
            alarmAudioRef.current.load();
        }
        return audioContextRef.current.state === 'running';
    }, []);

    const playBang = useCallback(async () => {
        const audioReady = await initializeAudio();
        if (isMutedRef.current || !audioReady) return;

        const audioCtx = audioContextRef.current;
        if (!audioCtx) return;

        const duration = 0.3;
        const sampleRate = audioCtx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = audioCtx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = buffer;

        const gainNode = audioCtx.createGain();
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

        source.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        source.start();
    }, [initializeAudio]);

    const stopCelebrationAndReset = useCallback((e?: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
        const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle' || isRainingRef.current;
        if (!celebrationInProgress) {
            return;
        }

        const isTitleClick = e && titleRef.current?.contains(e.target as Node);
        
        if (e && !isTitleClick) {
            if ('clientX' in e) { // React.MouseEvent | MouseEvent
                 onInterruptCelebrationRef.current(e as MouseEvent);
            } else { // React.TouchEvent | TouchEvent
                 onInterruptCelebrationRef.current(e as TouchEvent);
            }
        } else {
             playBang();
        }

        interruptedRef.current = true;
        setIsCelebrating(false);
        setIsAlarmPlaying(false);
        setAnimationState('idle');

        if (isPartyModeRef.current && !isTitleClick) {
            setIsRaining(false);
        }

        setInterruptionTime(current => current ?? Date.now());
        
        setTimeout(() => {
            if (interruptedRef.current) {
                setMountConfettiRain(false);
                setInterruptionTime(null);
                interruptedRef.current = false;
            }
        }, 2000);

    }, [titleRef, playBang, onInterruptCelebrationRef]);
    
    const cancelSettingAnimations = useCallback(() => {
        if (snapTimeoutRef.current) {
            clearTimeout(snapTimeoutRef.current);
            snapTimeoutRef.current = null;
        }
        if (quickSetAnimationId.current) {
            cancelAnimationFrame(quickSetAnimationId.current);
            quickSetAnimationId.current = null;
        }
    }, []);

    const cancelAllTimersAndAnimations = useCallback(() => {
        setIsTransitioningToAutoSec(false);
        setIsTransitioningToAutoMin(false);
        if (countdownFrameId.current) {
          cancelAnimationFrame(countdownFrameId.current);
          countdownFrameId.current = null;
        }
        cancelSettingAnimations();
        setTimeData(null);
        lastTickSecond.current = null;

        // Cancel notifications and foreground service
        if (isNativePlatform()) {
            cancelAllNotifications();

            // Stop Android foreground service
            if (isAndroid()) {
                stopTimerForegroundService();
            }
        }

        try {
          localStorage.removeItem(TIMER_STORAGE_KEY);
        } catch (error) {}
    }, [cancelSettingAnimations]);

    const startTimerFromAngle = useCallback(async (angleToSet: number) => {
        // Check battery optimization on Android on first timer start
        if (isAndroid() && shouldShowBatteryDialog()) {
          try {
            await requestBatteryOptimizationExemption();
          } catch (error) {
            console.error('Failed to request battery optimization exemption:', error);
          }
        }

        cancelAllTimersAndAnimations();
        stopCelebrationAndReset();
        lastTickSecond.current = null;
        const currentMaxTime = getMaxTimeMs(timeUnitRef.current);

        if (angleToSet > 0.1) {
          const duration = (angleToSet / 360) * currentMaxTime;
          const newEndTime = Date.now() + duration;
    
          setTimeData({
            startTime: Date.now(),
            duration: duration,
          });
  
          try {
            const dataToStore = JSON.stringify({ endTime: newEndTime, duration, unit: timeUnitRef.current });
            localStorage.setItem(TIMER_STORAGE_KEY, dataToStore);
          } catch (error) {
          }

          if (isNativePlatform()) {
            // Schedule end-of-timer alarm notification (only when not muted)
            if (!isMutedRef.current) {
                await scheduleTimerNotification(new Date(newEndTime), 'party_horn.mp3');
            }
          }
    
        } else {
            cancelAllTimersAndAnimations();
            setAngle(0);
        }
      }, [cancelAllTimersAndAnimations, stopCelebrationAndReset]);

    const animateAngle = useCallback((targetAngle: number, startTimerOnComplete = true, animationType: 'set' | 'auto' = 'set') => {
        cancelSettingAnimations();
        const DURATION = animationType === 'set' ? 400 : 500;
        let animationStartTime: number | null = null;
        const startAngle = angleRef.current;

        const step = (currentTime: number) => {
            if (animationStartTime === null) {
                animationStartTime = currentTime;
            }

            const elapsed = currentTime - animationStartTime;
            const progress = Math.min(elapsed / DURATION, 1);
            
            let newAngle;
            if (animationType === 'set') {
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                newAngle = interpolateAngleForSet(startAngle, targetAngle, easedProgress);
            } else { // 'auto' for auto-sec transition
                const easedProgress = 1 - Math.pow(1 - progress, 2);
                newAngle = interpolateAngleShortestPath(startAngle, targetAngle, easedProgress);
            }


            if (progress < 1) {
                setAngle(newAngle);
                quickSetAnimationId.current = requestAnimationFrame(step);
            } else {
                setAngle(targetAngle);
                quickSetAnimationId.current = null;
                if (startTimerOnComplete) {
                    startTimerFromAngle(targetAngle);
                }
            }
        };

        quickSetAnimationId.current = requestAnimationFrame(step);
    }, [startTimerFromAngle, cancelSettingAnimations]);

    const resetAutoSwitchMode = useCallback(() => {
        if (wasAutoSwitchedRef.current) {
            setTimeUnit('min');
            setIsDetailView(false);
            wasAutoSwitchedRef.current = false;
        }
        if (wasAutoSwitchedToMinRef.current) {
            setTimeUnit('hr');
            wasAutoSwitchedToMinRef.current = false;
        }
    }, []);

    useEffect(() => {
      setHasMounted(true);
      const storedMuteState = localStorage.getItem('rainbowTimerMuted');
      if (storedMuteState) {
        try {
          setIsMuted(JSON.parse(storedMuteState));
        } catch(e) {}
      }
  
      try {
        const storedData = localStorage.getItem(TIMER_STORAGE_KEY);
        if (storedData) {
          const { endTime, duration, unit: storedUnit } = JSON.parse(storedData);
          const remaining = endTime - Date.now();
          
          if (remaining > 0 && duration > 0) {
            const currentUnit = (storedUnit as 'hr' | 'min' | 'sec') || 'min';

             setTimeUnit(currentUnit);
             setIsDetailView(currentUnit === 'sec');

            const newStartTime = Date.now() - (duration - remaining);
            
            setTimeData({
              startTime: newStartTime,
              duration: duration,
            });

          } else if (remaining <= 0) {
              localStorage.removeItem(TIMER_STORAGE_KEY);
          }
        }
      } catch (error) {
      }
    }, []);
    
    useEffect(() => {
        angleRef.current = angle;
    }, [angle]);

    useEffect(() => {
        timeUnitRef.current = timeUnit;
        isDetailViewRef.current = isDetailView;
    }, [timeUnit, isDetailView]);

    // Animate secModeProgress (0=min, 1=sec) over 500ms when sec mode changes
    useEffect(() => {
        const isSecModeActive = timeUnit === 'sec' && !wasAutoSwitchedRef.current;
        const targetProgress = isSecModeActive ? 1 : 0;

        if (secModeAnimRef.current) {
            cancelAnimationFrame(secModeAnimRef.current);
            secModeAnimRef.current = null;
        }

        if (secModeProgressRef.current === targetProgress) return;

        const DURATION = 500;
        const startProgress = secModeProgressRef.current;
        let startTime: number | null = null;

        const animate = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const t = Math.min(elapsed / DURATION, 1);
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const newProgress = startProgress + (targetProgress - startProgress) * eased;
            secModeProgressRef.current = newProgress;
            setSecModeProgress(newProgress);
            if (t < 1) {
                secModeAnimRef.current = requestAnimationFrame(animate);
            } else {
                secModeAnimRef.current = null;
            }
        };

        secModeAnimRef.current = requestAnimationFrame(animate);

        return () => {
            if (secModeAnimRef.current) {
                cancelAnimationFrame(secModeAnimRef.current);
                secModeAnimRef.current = null;
            }
        };
    }, [timeUnit, isDetailView]);

    // Animate hrModeProgress (0=not-hr, 1=hr) over 600ms when hr mode changes
    useEffect(() => {
        const targetProgress = timeUnit === 'hr' ? 1 : 0;

        if (hrModeAnimRef.current) {
            cancelAnimationFrame(hrModeAnimRef.current);
            hrModeAnimRef.current = null;
        }

        if (hrModeProgressRef.current === targetProgress) return;

        const DURATION = 600;
        const startProgress = hrModeProgressRef.current;
        let startTime: number | null = null;

        const animate = (currentTime: number) => {
            if (startTime === null) startTime = currentTime;
            const elapsed = currentTime - startTime;
            const t = Math.min(elapsed / DURATION, 1);
            const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            const newProgress = startProgress + (targetProgress - startProgress) * eased;
            hrModeProgressRef.current = newProgress;
            setHrModeProgress(newProgress);
            if (t < 1) {
                hrModeAnimRef.current = requestAnimationFrame(animate);
            } else {
                hrModeAnimRef.current = null;
            }
        };

        hrModeAnimRef.current = requestAnimationFrame(animate);

        return () => {
            if (hrModeAnimRef.current) {
                cancelAnimationFrame(hrModeAnimRef.current);
                hrModeAnimRef.current = null;
            }
        };
    }, [timeUnit]);

    // Confetti explosion on hr mode transitions
    useEffect(() => {
        const prev = prevTimeUnitRef.current;
        const curr = timeUnit;
        prevTimeUnitRef.current = curr;

        const shouldExplode = (prev === 'hr' && curr !== 'hr') || (prev !== 'hr' && curr === 'hr');
        if (!shouldExplode) return;

        if (explosionTimeoutRef.current) {
            clearTimeout(explosionTimeoutRef.current);
            explosionTimeoutRef.current = null;
        }

        const newParticles: Particle[] = [];
        explosionCounterRef.current++;
        const batchId = explosionCounterRef.current;

        for (let labelIndex = 0; labelIndex < 12; labelIndex++) {
            const hrValue = labelIndex + 1;
            const angleDeg = (hrValue / 12) * 360;
            const labelPos = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, angleDeg);
            const delay = labelIndex * 6;
            const count = 8 + Math.floor(Math.random() * 5);

            for (let p = 0; p < count; p++) {
                const baseAngleDeg = Math.random() * 360;
                const jitter = (Math.random() - 0.5) * 30;
                const particleAngleDeg = baseAngleDeg + jitter;
                const particleAngleRad = (particleAngleDeg * Math.PI) / 180;
                const speed = 12 + Math.random() * 18;
                const dx = Math.cos(particleAngleRad) * speed;
                const dy = Math.sin(particleAngleRad) * speed;
                const color = numberColors[(labelIndex + p) % numberColors.length];
                const r = 1.5 + Math.random() * 2.5;
                const duration = 400 + Math.random() * 300;
                newParticles.push({
                    key: `exp-${batchId}-${labelIndex}-${p}`,
                    startX: labelPos.x,
                    startY: labelPos.y,
                    dx, dy, color, r, duration, delay,
                });
            }
        }

        setExplosionParticles(newParticles);

        explosionTimeoutRef.current = setTimeout(() => {
            setExplosionParticles([]);
            explosionTimeoutRef.current = null;
        }, 700);

        return () => {
            if (explosionTimeoutRef.current) {
                clearTimeout(explosionTimeoutRef.current);
            }
        };
    }, [timeUnit]);

    const handleFullscreenToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onFullscreenChange(!isFullscreen);
    };

    const handleBackdropClick = () => {
        if (isFullscreen && !isForcedFullscreen) {
            onFullscreenChange(false);
        }
    };

    const playSingleBeep = useCallback(async () => {
        if (isMutedRef.current) return;
        const audioReady = await initializeAudio();
        if (!audioReady) return;
    
        const audioCtx = audioContextRef.current;
        if (!audioCtx) return;
    
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
    
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
    }, [initializeAudio]);

    useEffect(() => {
        if (!isNativePlatform()) return;
        // Setup channels first, then request POST_NOTIFICATIONS permission.
        // On Android 13+ this is a runtime permission — without it the foreground
        // service notification is silently suppressed.
        setupNotificationChannels().then(() => {
            requestNotificationPermissions();
        });
    }, []);

    useEffect(() => {
      const requestWakeLock = async () => {
          await keepAwake();
      };

      const releaseWakeLock = async () => {
          await allowSleep();
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && timeData) {
              requestWakeLock();
          }
      };

      if (timeData) {
          requestWakeLock();
          if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', handleVisibilityChange);
          }
      } else {
          releaseWakeLock();
      }

      return () => {
          releaseWakeLock();
          if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
          }
      };
    }, [timeData]);

    // Start/stop foreground service based on app visibility (Android only)
    // Notification only shows when user leaves the app
    useEffect(() => {
        if (!isAndroid()) return;

        const handleForegroundVisibility = () => {
            if (document.visibilityState === 'hidden') {
                const td = timeDataRef.current;
                if (!td) return;
                const remaining = td.duration - (Date.now() - td.startTime);
                if (remaining > 0) {
                    // maxTimeMs: reference cycle matching the rainbow fill reference.
                    const maxTimeMs = getMaxTimeMs(timeUnitRef.current);
                    startTimerForegroundService(Date.now() + remaining, td.duration, maxTimeMs);
                }
            } else if (document.visibilityState === 'visible') {
                stopTimerForegroundService();
            }
        };

        document.addEventListener('visibilitychange', handleForegroundVisibility);
        return () => document.removeEventListener('visibilitychange', handleForegroundVisibility);
    }, []);

    const handleQuickSet = useCallback((e: React.MouseEvent | React.TouchEvent, value: number) => {
      e.preventDefault();
      e.stopPropagation();

      const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle' || isRainingRef.current;
      if (celebrationInProgress) {
        stopCelebrationAndReset(e);
        return;
      }

      setIsTransitioningToAutoSec(false);
      setIsTransitioningToAutoMin(false);
      wasAutoSwitchedToMinRef.current = false;
      stopCelebrationAndReset();
      cancelAllTimersAndAnimations();
      resetAutoSwitchMode();

      const newAngle = (value / 60) * 360;
      animateAngle(newAngle, true, 'set');
    }, [stopCelebrationAndReset, cancelAllTimersAndAnimations, animateAngle, resetAutoSwitchMode]);

    const handleUnitChange = useCallback((newUnit: "hr" | "min" | "sec") => {
        // In auto-sec mode (timer auto-switched from min to sec)
        if (wasAutoSwitchedRef.current) {
            if (newUnit === "hr") {
                // Full reset back to hr mode
                cancelAllTimersAndAnimations();
                stopCelebrationAndReset();
                wasAutoSwitchedRef.current = false;
                wasAutoSwitchedToMinRef.current = false;
                setTimeUnit('hr');
                setIsDetailView(false);
                setAngle(0);
                return;
            }
            if (newUnit === "min") {
                return; // no-op (already past min)
            }
            if (newUnit === "sec") {
                // Confirm explicit sec mode
                cancelAllTimersAndAnimations();
                stopCelebrationAndReset();
                wasAutoSwitchedRef.current = false;
                setTimeUnit('sec');
                setIsDetailView(true);
                setAngle(0);
                return;
            }
        }

        // In auto-min mode (timer auto-switched from hr to min)
        if (wasAutoSwitchedToMinRef.current) {
            if (newUnit === "hr") {
                return; // no-op (still counting down, will auto-switch further)
            }
            if (newUnit === "min") {
                // Confirm min as permanent mode
                cancelAllTimersAndAnimations();
                stopCelebrationAndReset();
                wasAutoSwitchedToMinRef.current = false;
                setTimeUnit('min');
                setIsDetailView(false);
                setAngle(0);
                return;
            }
            if (newUnit === "sec") {
                // Jump ahead to sec mode
                cancelAllTimersAndAnimations();
                stopCelebrationAndReset();
                wasAutoSwitchedToMinRef.current = false;
                wasAutoSwitchedRef.current = false;
                setTimeUnit('sec');
                setIsDetailView(true);
                setAngle(0);
                return;
            }
        }

        if (timeUnitRef.current === newUnit) return;

        cancelAllTimersAndAnimations();
        stopCelebrationAndReset();

        wasAutoSwitchedRef.current = false;
        wasAutoSwitchedToMinRef.current = false;
        setTimeUnit(newUnit);
        setIsDetailView(newUnit === 'sec');
        setAngle(0);
    }, [cancelAllTimersAndAnimations, stopCelebrationAndReset]);

    const pauseTimer = useCallback(() => {
        if (countdownFrameId.current) {
            cancelAnimationFrame(countdownFrameId.current);
            countdownFrameId.current = null;
        }
        setIsTransitioningToAutoSec(false);
        setIsTransitioningToAutoMin(false);
        setTimeData(null);
        lastTickSecond.current = null;

        // Cancel notifications and foreground service
        if (isNativePlatform()) {
            cancelAllNotifications();

            // Stop Android foreground service
            if (isAndroid()) {
                stopTimerForegroundService();
            }
        }
    }, []);

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;

        // Ignore duplicate start events during dragging (happens with touch on SVG elements)
        if (isDraggingRef.current) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle' || isRainingRef.current;

        if (celebrationInProgress) {
          stopCelebrationAndReset(e);
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        if (target.closest('[data-dial-container-child]')) {
          e.stopPropagation();
          return;
        }

        const wasRunning = !!timeDataRef.current;

        pauseTimer();

        if (wasAutoSwitchedRef.current) {
            resetAutoSwitchMode();
        }

        cancelSettingAnimations();

        interactionStartRef.current = { time: Date.now(), angle: angleRef.current, wasRunning: wasRunning };

        setIsDragging(true);
        lastDragAngle.current = null;

        // Fire-and-forget: audio init must not block drag start
        initializeAudio();

    }, [pauseTimer, cancelSettingAnimations, resetAutoSwitchMode, stopCelebrationAndReset, initializeAudio]);
    
    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      cancelSettingAnimations();

      const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle';
      if(celebrationInProgress && !interruptedRef.current) return;

      if ('touches' in e && e.cancelable) e.preventDefault();
    
      if (interactionStartRef.current) {
        interactionStartRef.current = null;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const x = (clientX - rect.left) - centerX;
      const y = (clientY - rect.top) - centerY;
      
      let currentAngleFromCoords = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (currentAngleFromCoords < 0) currentAngleFromCoords += 360;
  
      const lastAngle = lastDragAngle.current;

      if (lastAngle === null) {
        lastDragAngle.current = currentAngleFromCoords;
        return;
      }
      
      let deltaAngle = currentAngleFromCoords - lastAngle;

      if (deltaAngle > 180) deltaAngle -= 360;
      else if (deltaAngle < -180) deltaAngle += 360;

      setAngle(prevAngle => {
        let newAngle = prevAngle + deltaAngle;
        if (newAngle < 0) newAngle = 0;
        if (newAngle > 360) newAngle = 360;
        return newAngle;
      });
      lastDragAngle.current = currentAngleFromCoords;

      if(snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = setTimeout(() => {
        if (!isDraggingRef.current) return;

        const currentUnit = timeUnitRef.current;
        const currentMaxTime = getMaxTimeMs(currentUnit);
        const duration = (angleRef.current / 360) * currentMaxTime;

        const roundingUnitMs = currentUnit === 'hr' ? HR_SNAP_UNIT_MS
            : currentUnit === 'min' ? 60 * 1000 : 1000;
        const roundedDuration = Math.round(duration / roundingUnitMs) * roundingUnitMs;

        const snappedAngle = roundedDuration > 0 ? (roundedDuration / currentMaxTime) * 360 : 0;

        animateAngle(snappedAngle, false, 'set');
    }, 800);

    }, [animateAngle]);

    const handleInteractionEnd = useCallback(() => {
        if (!isDraggingRef.current) return;
        setIsDragging(false);
        lastDragAngle.current = null;

        if (snapTimeoutRef.current) {
            clearTimeout(snapTimeoutRef.current);
            snapTimeoutRef.current = null;
        }
        
        const startInfo = interactionStartRef.current;
        interactionStartRef.current = null;

        if (startInfo && (Date.now() - startInfo.time) < 200) { 
            const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle';
            if (celebrationInProgress) {
              return;
            }
            if (startInfo.wasRunning) {
                setAngle(startInfo.angle);
                startTimerFromAngle(startInfo.angle);
                return;
            }
            animateAngle(0, true, 'set');
            return;
        }
        
        if (!interruptedRef.current) {
            const currentUnit = timeUnitRef.current;
            const currentMaxTime = getMaxTimeMs(currentUnit);
            const duration = (angleRef.current / 360) * currentMaxTime;

            const roundingUnitMs = currentUnit === 'hr' ? HR_SNAP_UNIT_MS
                : currentUnit === 'min' ? 60 * 1000 : 1000;
            const roundedDuration = Math.round(duration / roundingUnitMs) * roundingUnitMs;

            const snappedAngle = roundedDuration > 0 ? (roundedDuration / currentMaxTime) * 360 : 0;

            animateAngle(snappedAngle, true, 'set');
        }
        
    }, [animateAngle, startTimerFromAngle]);

    const handleMuteToggle = async (e: React.MouseEvent) => {
      e.stopPropagation();
      const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle';
      if (celebrationInProgress) {
        stopCelebrationAndReset();
        return;
      }

      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      try {
        localStorage.setItem('rainbowTimerMuted', JSON.stringify(newMutedState));
      } catch (e) {}

      if (!newMutedState) {
        const audioReady = await initializeAudio();
        if (audioReady && isNativePlatform()) {
            // Request notification permissions on native
            await requestNotificationPermissions();

            // Re-schedule notification if timer is running
            if (timeData) {
                const remaining = timeData.duration - (Date.now() - timeData.startTime);
                const endTime = Date.now() + remaining;
                await scheduleTimerNotification(new Date(endTime), 'party_horn.mp3');
            }
        }
      } else {
        if (isAlarmPlaying) {
            setIsAlarmPlaying(false);
        }
        // Cancel notifications when muting
        if (isNativePlatform()) {
            await cancelAllNotifications();
        }
      }
    };


    useEffect(() => {
        const moveHandler = (e: MouseEvent | TouchEvent) => handleInteractionMove(e);
        const endHandler = () => handleInteractionEnd();

        if (isDragging) {
          window.addEventListener('mousemove', moveHandler);
          window.addEventListener('touchmove', moveHandler, { passive: false });
          window.addEventListener('mouseup', endHandler);
          window.addEventListener('touchend', endHandler);
        }
    
        return () => {
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.addEventListener('mouseup', endHandler);
          window.addEventListener('touchend', endHandler);
        };
      }, [isDragging, handleInteractionMove, handleInteractionEnd]);
    
    useEffect(() => {
        if (!hasMounted) return;

        let interactionStarted = false;
        
        const handler = (e: MouseEvent | TouchEvent) => {
            if (!interactionStarted) return;
            interactionStarted = false;

            // If mousedown/touchstart already interrupted the celebration, don't double-trigger
            if (interruptedRef.current) return;

            const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle' || isRainingRef.current;
            if (!celebrationInProgress) return;

            if (!titleRef.current?.contains(e.target as Node)) {
                if (e.cancelable) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                stopCelebrationAndReset(e);
            }
        };

        const startHandler = (e: MouseEvent | TouchEvent) => {
            const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle' || isRainingRef.current;
            if (celebrationInProgress) {
                interactionStarted = true;
            }
        };

        document.body.addEventListener('mousedown', startHandler, { capture: true });
        document.body.addEventListener('touchstart', startHandler, { capture: true });
        document.body.addEventListener('click', handler, { capture: true });


        return () => {
            document.body.removeEventListener('mousedown', startHandler, { capture: true });
            document.body.removeEventListener('touchstart', startHandler, { capture: true });
            document.body.removeEventListener('click', handler, { capture: true });
        };
    }, [hasMounted, stopCelebrationAndReset, titleRef]);

    // Countdown loop
    useEffect(() => {
        if (timeData === null || isTransitioningToAutoSec || isTransitioningToAutoMin) {
            if (countdownFrameId.current) {
                cancelAnimationFrame(countdownFrameId.current);
                countdownFrameId.current = null;
            }
            return;
        }

        let isCancelled = false;

        const animate = () => {
            if (isCancelled || !timeDataRef.current) return;

            const elapsed = Date.now() - timeDataRef.current.startTime;
            const remaining = timeDataRef.current.duration - elapsed;

            // hr → auto-min: when remaining time fits within a min cycle
            if (timeUnitRef.current === 'hr' && remaining <= MAX_TIME_MIN_MS && remaining > 0 && !isDraggingRef.current) {
                setIsTransitioningToAutoMin(true);
                return;
            }

            if (timeUnitRef.current === 'min' && !isDetailViewRef.current && remaining <= MAX_TIME_SEC_MS && remaining > 0 && !isDraggingRef.current) {
                setIsTransitioningToAutoSec(true);
                return;
            }

            if (remaining > 0 && remaining <= 5000 && (isDetailViewRef.current || timeUnitRef.current === 'sec')) {
                const currentSecond = Math.ceil(remaining / 1000);
                if (lastTickSecond.current !== currentSecond) {
                    playSingleBeep();
                    lastTickSecond.current = currentSecond;
                }
            }

            if (remaining <= 0) {
                setAngle(0);
                setTimeData(null);
                resetAutoSwitchMode();
                try {
                    localStorage.removeItem(TIMER_STORAGE_KEY);
                } catch(e) {}

                // App is in foreground (JS is running) — cancel the scheduled
                // notification so it doesn't fire on top of the in-app celebration.
                if (isNativePlatform()) {
                    cancelAllNotifications();
                    if (isAndroid()) {
                        stopTimerForegroundService();
                    }
                }

                if (!interruptedRef.current) {
                    playBang();
                    if (containerRef.current) {
                        const rect = containerRef.current.getBoundingClientRect();
                        setBurstOrigin({
                            x: rect.left + rect.width / 2,
                            y: rect.top + rect.height / 2,
                        });
                    }
                    setAnimationState('bursting');
                    setIsCelebrating(true);

                    if (isPartyModeRef.current) {
                        setMountConfettiRain(true);
                        setIsRaining(true);
                    }

                    setTimeout(() => {
                        if (isCelebratingRef.current && !interruptedRef.current) {
                            setIsAlarmPlaying(true);
                        }
                    }, 200);
                }
            } else {
                const currentMaxTime = getMaxTimeMs(timeUnitRef.current);
                const newAngle = (remaining / currentMaxTime) * 360;
                setAngle(newAngle);
            }

            countdownFrameId.current = requestAnimationFrame(animate);
        };

        countdownFrameId.current = requestAnimationFrame(animate);

        return () => {
            isCancelled = true;
            if (countdownFrameId.current) cancelAnimationFrame(countdownFrameId.current);
        };
    }, [timeData, playSingleBeep, resetAutoSwitchMode, playBang, isTransitioningToAutoSec, isTransitioningToAutoMin]);

    // Dedicated effect for the transition to auto-sec mode
    useEffect(() => {
      if (!isTransitioningToAutoSec) return;

      if (countdownFrameId.current) {
        cancelAnimationFrame(countdownFrameId.current);
        countdownFrameId.current = null;
      }
      
      const DURATION = 500;
      let animationStartTime: number | null = null;
      const startAngle = angleRef.current;
      
      const transitionAnimate = (currentTime: number) => {
        if (animationStartTime === null) animationStartTime = currentTime;
        const animElapsed = currentTime - animationStartTime;
        const progress = Math.min(animElapsed / DURATION, 1);
        
        const easedProgress = 1 - Math.pow(1 - progress, 3);
        const newAngle = interpolateAngleForSet(startAngle, 0, easedProgress);
        
        setAngle(newAngle);

        if (progress < 1) {
          countdownFrameId.current = requestAnimationFrame(transitionAnimate);
        } else {
            const currentTD = timeDataRef.current;
            if (currentTD) {
                const elapsedFromStart = Date.now() - currentTD.startTime;
                const remaining = currentTD.duration - elapsedFromStart;
                
                // ATOMIC UPDATE
                wasAutoSwitchedRef.current = true;
                setTimeUnit('sec');
                setIsDetailView(true);
                
                const finalAngleAfterTransition = Math.max(0, (remaining / MAX_TIME_SEC_MS) * 360);
                setAngle(finalAngleAfterTransition); // Set final angle for the new mode
            }
            setIsTransitioningToAutoSec(false); 
        }
      };

      countdownFrameId.current = requestAnimationFrame(transitionAnimate);

      return () => {
        if (countdownFrameId.current) {
          cancelAnimationFrame(countdownFrameId.current);
          countdownFrameId.current = null;
        }
      };
    }, [isTransitioningToAutoSec]);

    // Dedicated effect for the transition to auto-min mode (hr → min)
    useEffect(() => {
        if (!isTransitioningToAutoMin) return;

        if (countdownFrameId.current) {
            cancelAnimationFrame(countdownFrameId.current);
            countdownFrameId.current = null;
        }

        const DURATION = 500;
        let animationStartTime: number | null = null;
        const startAngle = angleRef.current;

        const transitionAnimate = (currentTime: number) => {
            if (animationStartTime === null) animationStartTime = currentTime;
            const animElapsed = currentTime - animationStartTime;
            const progress = Math.min(animElapsed / DURATION, 1);

            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const newAngle = interpolateAngleForSet(startAngle, 0, easedProgress);

            setAngle(newAngle);

            if (progress < 1) {
                countdownFrameId.current = requestAnimationFrame(transitionAnimate);
            } else {
                const currentTD = timeDataRef.current;
                if (currentTD) {
                    const elapsedFromStart = Date.now() - currentTD.startTime;
                    const remaining = currentTD.duration - elapsedFromStart;

                    // ATOMIC UPDATE
                    wasAutoSwitchedToMinRef.current = true;
                    setTimeUnit('min');
                    setIsDetailView(false);

                    const finalAngle = Math.max(0, (remaining / MAX_TIME_MIN_MS) * 360);
                    setAngle(finalAngle);

                    // Update Android notification to use min-mode reference cycle
                    if (isAndroid()) {
                        updateTimerNotification(remaining, MAX_TIME_MIN_MS);
                    }
                }
                setIsTransitioningToAutoMin(false);
            }
        };

        countdownFrameId.current = requestAnimationFrame(transitionAnimate);

        return () => {
            if (countdownFrameId.current) {
                cancelAnimationFrame(countdownFrameId.current);
                countdownFrameId.current = null;
            }
        };
    }, [isTransitioningToAutoMin]);

    useEffect(() => {
        if (titleBangTrigger > 0) {
        playBang();
      }
    }, [titleBangTrigger, playBang]);

    useEffect(() => {
        if (isAlarmPlaying) {
            if (!alarmAudioRef.current) {
                alarmAudioRef.current = new Audio('/party-horn.mp3');
                alarmAudioRef.current.loop = true;
            }
            if (!isMuted) {
                alarmAudioRef.current.play().catch(e => {});
            }
        } else if (alarmAudioRef.current) {
            alarmAudioRef.current.pause();
            alarmAudioRef.current.currentTime = 0;
        }
    }, [isAlarmPlaying, isMuted]);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (alarmAudioRef.current) {
        alarmAudioRef.current.pause();
        alarmAudioRef.current.currentTime = 0;
        alarmAudioRef.current = null;
      }
    }
  }, []);

  const RenderDial = () => {
    // auto-sec uses rainbow background + white arc; sec mode uses white background + rainbow (like min mode)
    const shouldShowDetailView = isDetailView && wasAutoSwitchedRef.current;

    return (
        <g>
            {/* 1. Background Layer */}
            <g>
                <circle cx={CENTER} cy={CENTER} r={DIAL_RADIUS} className="fill-[hsl(300,100%,97%)]" style={{ pointerEvents: 'none' }} />
            </g>

            {/* 2. Ticks and Numbers Layer — min/sec mode (fades out in hr mode) */}
            <g opacity={1 - hrModeProgress}>
                {Array.from({ length: 60 }).map((_, i) => {
                if ((i + 1) % 5 === 0) return null;
                const tickAngle = (i + 1) * 6;
                const start = polarToCartesian(CENTER, CENTER, DIAL_RADIUS - 5 - 2.5 * secModeProgress, tickAngle);
                const end = polarToCartesian(CENTER, CENTER, DIAL_RADIUS, tickAngle);
                return (
                    <line
                        key={`minute-tick-${i}`}
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={INDIGO}
                        strokeWidth="1"
                    />
                );
                })}
            </g>

            <g opacity={1 - hrModeProgress}>
                {ticks.map((tick, i) => {
                const tickAngle = (i + 1) * 30;
                const start = polarToCartesian(CENTER, CENTER, TICK_START_RADIUS - 4 * secModeProgress, tickAngle);
                const end = polarToCartesian(CENTER, CENTER, TICK_END_RADIUS, tickAngle);
                const labelPos = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, tickAngle);

                if (tick === 60) {
                    return (
                    <g key={tick} onMouseDown={(e) => handleQuickSet(e, 60)} onTouchStart={(e) => handleQuickSet(e, 60)} style={{ cursor: 'pointer' }} className="group quick-set-button">
                        <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={INDIGO}
                        strokeWidth="2"
                        />
                        <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="bold"
                        fontSize="14"
                        filter="url(#text-shadow)"
                        className="transition-transform duration-150 ease-in-out group-hover:scale-125 group-active:scale-90"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                        >
                        <tspan fill={numberColors[12 % numberColors.length]}>6</tspan>
                        <tspan fill={numberColors[0]}>0</tspan>
                        </text>
                    </g>
                    );
                }

                const colorOrderIndex = (tick / 5);
                const color = numberColors[colorOrderIndex % numberColors.length];

                return (
                    <g key={tick} onMouseDown={(e) => handleQuickSet(e, tick)} onTouchStart={(e) => handleQuickSet(e, tick)} style={{ cursor: 'pointer' }} className="group quick-set-button">
                    <line
                        x1={start.x}
                        y1={start.y}
                        x2={end.x}
                        y2={end.y}
                        stroke={INDIGO}
                        strokeWidth="2"
                    />
                    <text
                        x={labelPos.x}
                        y={labelPos.y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontWeight="bold"
                        fontSize="14"
                        fill={color}
                        filter="url(#text-shadow)"
                        className="transition-transform duration-150 ease-in-out group-hover:scale-125 group-active:scale-90"
                        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                    >
                        {tick}
                    </text>
                    </g>
                );
                })}
            </g>

            {/* 2b. Half-second dot markers (appear in sec mode, hidden in hr mode) */}
            {secModeProgress > 0 && (
                <g>
                    {Array.from({ length: 60 }).map((_, i) => {
                        const dotAngle = 3 + i * 6;
                        const tickMidRadius = DIAL_RADIUS - (5 + 2.5 * secModeProgress) / 2;
                        const dotPos = polarToCartesian(CENTER, CENTER, tickMidRadius, dotAngle);
                        return (
                            <circle
                                key={`half-sec-dot-${i}`}
                                cx={dotPos.x}
                                cy={dotPos.y}
                                r={1.125}
                                fill={INDIGO}
                                opacity={secModeProgress * (1 - hrModeProgress)}
                                style={{ pointerEvents: 'none' }}
                            />
                        );
                    })}
                </g>
            )}

            {/* 2c. Hr mode ticks (144 micro + 48 quarter-hour + 12 hour), cross-fades in */}
            {hrModeProgress > 0 && (
                <g opacity={hrModeProgress}>
                    {/* 144 micro-ticks at 2.5° intervals, skip positions that land on 7.5° marks */}
                    {Array.from({ length: 144 }).map((_, i) => {
                        if ((i + 1) % 3 === 0) return null; // skip 7.5° positions
                        const tickAngle = (i + 1) * 2.5;
                        const start = polarToCartesian(CENTER, CENTER, DIAL_RADIUS - 3, tickAngle);
                        const end = polarToCartesian(CENTER, CENTER, DIAL_RADIUS, tickAngle);
                        return (
                            <line key={`hr-micro-${i}`}
                                x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                                stroke={INDIGO} strokeWidth="0.75" opacity="0.35"
                                style={{ pointerEvents: 'none' }}
                            />
                        );
                    })}
                    {/* 48 quarter-hour ticks at 7.5° intervals, skip positions that land on 30° marks */}
                    {Array.from({ length: 48 }).map((_, j) => {
                        if ((j + 1) % 4 === 0) return null; // skip 30° (hour) positions
                        const tickAngle = (j + 1) * 7.5;
                        const start = polarToCartesian(CENTER, CENTER, DIAL_RADIUS - 5, tickAngle);
                        const end = polarToCartesian(CENTER, CENTER, DIAL_RADIUS, tickAngle);
                        return (
                            <line key={`hr-quarter-${j}`}
                                x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                                stroke={INDIGO} strokeWidth="1"
                                style={{ pointerEvents: 'none' }}
                            />
                        );
                    })}
                    {/* 12 hour labels with major ticks and quick-set interaction */}
                    {Array.from({ length: 12 }).map((_, k) => {
                        const hrValue = k + 1;
                        const tickAngle = (hrValue / 12) * 360;
                        const start = polarToCartesian(CENTER, CENTER, TICK_START_RADIUS, tickAngle);
                        const end = polarToCartesian(CENTER, CENTER, TICK_END_RADIUS, tickAngle);
                        const labelPos = polarToCartesian(CENTER, CENTER, LABEL_RADIUS, tickAngle);
                        const color = numberColors[k % numberColors.length];
                        return (
                            <g key={`hr-label-${hrValue}`}
                                onMouseDown={(e) => handleQuickSet(e, hrValue * 5)}
                                onTouchStart={(e) => handleQuickSet(e, hrValue * 5)}
                                style={{ cursor: 'pointer' }}
                                className="group quick-set-button"
                            >
                                <line
                                    x1={start.x} y1={start.y} x2={end.x} y2={end.y}
                                    stroke={INDIGO} strokeWidth="3.5"
                                />
                                <text
                                    x={labelPos.x} y={labelPos.y}
                                    textAnchor="middle" dominantBaseline="middle"
                                    fontWeight="bold" fontSize="14"
                                    fill={color}
                                    filter="url(#text-shadow)"
                                    className="transition-transform duration-150 ease-in-out group-hover:scale-125 group-active:scale-90"
                                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
                                >
                                    {hrValue}
                                </text>
                            </g>
                        );
                    })}
                </g>
            )}

            {/* Confetti explosion particles on hr mode transitions */}
            {explosionParticles.map((p) => (
                <circle key={p.key} cx={p.startX} cy={p.startY} r={p.r} fill={p.color} style={{ pointerEvents: 'none' }}>
                    <animateTransform attributeName="transform" type="translate"
                        from="0 0" to={`${p.dx} ${p.dy}`}
                        dur={`${p.duration}ms`} begin={`${p.delay}ms`} fill="freeze"
                        calcMode="spline" keySplines="0.25 0.1 0.25 1" keyTimes="0;1" />
                    <animate attributeName="opacity" from="1" to="0"
                        dur={`${p.duration}ms`} begin={`${p.delay}ms`} fill="freeze" />
                </circle>
            ))}

            {/* 3. Animation Layer (covers background) */}
            {(animationState !== 'bursting' && !isCelebrating) && (
                <g>
                    {shouldShowDetailView ? (
                        // auto-sec: rainbow arcs cover the ELAPSED portion (on top of ticks),
                        // leaving remaining time on white — ticks visible on white, hidden under rainbow
                        angle < 360 && (
                            <g>
                                {ringColors.map((color, i) => {
                                    const radius = INNER_WHITE_RADIUS + i * bandWidth + bandWidth / 2;
                                    const circumference = 2 * Math.PI * radius;
                                    const elapsedLength = circumference * (1 - angle / 360);
                                    return (
                                        <circle
                                            key={i}
                                            cx={CENTER}
                                            cy={CENTER}
                                            r={radius}
                                            fill="transparent"
                                            stroke={color}
                                            strokeWidth={bandWidth + 0.5}
                                            strokeDasharray={`${elapsedLength} ${circumference - elapsedLength}`}
                                            strokeDashoffset={0}
                                            transform={`rotate(${angle - 90} ${CENTER} ${CENTER})`}
                                            strokeLinecap="butt"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    );
                                })}
                            </g>
                        )
                    ) : (
                        angle > 0 && (
                            <g>
                                {ringColors.map((color, i) => {
                                    const radius = INNER_WHITE_RADIUS + i * bandWidth + bandWidth / 2;
                                    const circumference = 2 * Math.PI * radius;
                                    const strokeDashoffset = circumference * (1 - (angle / 360));
                                    return (
                                        <circle
                                            key={i}
                                            cx={CENTER}
                                            cy={CENTER}
                                            r={radius}
                                            fill="transparent"
                                            stroke={color}
                                            strokeWidth={bandWidth + 0.5}
                                            strokeDasharray={circumference}
                                            strokeDashoffset={strokeDashoffset}
                                            transform={`rotate(-90 ${CENTER} ${CENTER})`}
                                            strokeLinecap="butt"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    );
                                })}
                            </g>
                        )
                    )}
                </g>
            )}
        </g>
    );
  }


  return (
    <>
        {/* Dial wrapper: always fixed at viewport center so the dial center never jumps during transitions */}
        <div className={cn(
            "fixed inset-0 z-40 flex items-center justify-center",
            !isFullscreen && "pointer-events-none"
        )}>
                {/* backdrop */}
                <div
                    className={cn(
                        "absolute inset-0 bg-background/90 backdrop-blur-sm transition-opacity duration-400 ease-in-out",
                        isFullscreen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                    onClick={handleBackdropClick}
                />
                {/* dial container */}
                <div
                    ref={containerRef}
                    data-dial-container="true"
                    className={cn(
                        "relative aspect-square touch-none select-none rounded-full transition-all duration-400 ease-in-out pointer-events-auto",
                        isFullscreen ? "w-[80vmin]" : "w-[320px] sm:w-[350px] md:w-[390px] lg:w-[430px] xl:w-[460px]"
                    )}
                    onMouseDown={handleInteractionStart}
                    onTouchStart={handleInteractionStart}
                >
                    <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
                        <defs>
                            <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.15)" />
                            </filter>
                            <filter id="text-shadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.2)" />
                            </filter>
                        </defs>
                        {hasMounted && (
                            <>
                                <RenderDial />

                                <g filter="url(#shadow)">
                                    <circle cx={CENTER} cy={CENTER} r={CENTER_CIRCLE_RADIUS} className="fill-[hsl(var(--background))]" style={{ pointerEvents: 'none' }} />
                                    <line
                                        x1={polarToCartesian(CENTER, CENTER, INDICATOR_START_RADIUS, angle).x}
                                        y1={polarToCartesian(CENTER, CENTER, INDICATOR_START_RADIUS, angle).y}
                                        x2={polarToCartesian(CENTER, CENTER, INDICATOR_END_RADIUS, angle).x}
                                        y2={polarToCartesian(CENTER, CENTER, INDICATOR_END_RADIUS, angle).y}
                                        stroke={INDIGO}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                        style={{ pointerEvents: 'none' }}
                                    />
                                </g>
                            </>
                        )}
                    </svg>
                </div>
        </div>

        {/* Fixed button group: top-right */}
        {hasMounted && (
            <>
                {isForcedFullscreen ? (
                    /* Forced fullscreen: volume bottom-left, min/sec switch bottom-right */
                    <>
                        <Button
                            variant="secondary"
                            size="icon"
                            className="fixed z-50 bottom-4 left-4 h-10 w-10 rounded-full shadow-md bg-[hsl(300,100%,97%)] hover:bg-[hsl(300,100%,98%)] transition-transform duration-150 active:scale-95"
                            onClick={handleMuteToggle}
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX className="h-5 w-5" color={INDIGO} /> : <Volume2 className="h-5 w-5" color={INDIGO} />}
                        </Button>
                        <TimeUnitSwitch
                            mode={displayUnitModeForSwitch}
                            onUnitChange={handleUnitChange}
                            className="fixed z-50 bottom-4 right-4 h-10"
                        />
                    </>
                ) : (
                    /* Normal: all buttons centered at bottom */
                    <div className="fixed z-50 flex items-center gap-2 bottom-16 left-1/2 -translate-x-1/2">
                        {/* [🔊] sound button */}
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-full shadow-md bg-[hsl(300,100%,97%)] hover:bg-[hsl(300,100%,98%)] transition-transform duration-150 active:scale-95"
                            onClick={handleMuteToggle}
                            aria-label={isMuted ? 'Unmute' : 'Mute'}
                        >
                            {isMuted ? <VolumeX className="h-5 w-5" color={INDIGO} /> : <Volume2 className="h-5 w-5" color={INDIGO} />}
                        </Button>
                        {/* [min|sec] unit switch */}
                        <TimeUnitSwitch
                            mode={displayUnitModeForSwitch}
                            onUnitChange={handleUnitChange}
                            className="h-10"
                        />
                        {/* [⛶] fullscreen button */}
                        <Button
                            variant="secondary"
                            size="icon"
                            className="h-10 w-10 rounded-full shadow-md bg-[hsl(300,100%,97%)] hover:bg-[hsl(300,100%,98%)] transition-transform duration-150 active:scale-95"
                            onClick={handleFullscreenToggle}
                            aria-label={isFullscreen ? 'Vollbild verlassen' : 'Vollbild'}
                        >
                            {isFullscreen ? <Minimize className="h-5 w-5" color={INDIGO} /> : <Maximize className="h-5 w-5" color={INDIGO} />}
                        </Button>
                    </div>
                )}
            </>
        )}

        {hasMounted && animationState === 'bursting' && burstOrigin && createPortal(
            <Confetti
                colors={ringColors}
                onComplete={() => {
                    setAnimationState('idle');
                    setBurstOrigin(null);
                }}
                interruptionTime={interruptionTime}
                origin={burstOrigin}
            />,
            document.body
        )}
        {hasMounted && mountConfettiRain && createPortal(
            <ConfettiRain colors={ringColors} isRaining={isRaining} interruptionTime={interruptionTime} />,
            document.body
        )}
    </>
  );
}
