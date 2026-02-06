
"use client";

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Confetti, ConfettiRain } from './confetti';
import { cn } from '@/lib/utils';
import { TimeUnitSwitch } from './time-unit-switch';

const SIZE = 320;
const CENTER = SIZE / 2;
const DIAL_RADIUS = SIZE / 2 - 40;
const RAINBOW_OUTER_RADIUS = DIAL_RADIUS + 0.5;
const LABEL_RADIUS = DIAL_RADIUS + 20;
const TICK_START_RADIUS = DIAL_RADIUS - 8;
const TICK_END_RADIUS = DIAL_RADIUS;
const MAX_TIME_MIN_MS = 60 * 60 * 1000;
const MAX_TIME_SEC_MS = 60 * 1000;
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

const translations = {
    en: {
      soundHint: "The alarm sound will only play if this tab is active.",
      persistent: "A system notification will be sent when the timer ends, even if the tab is closed.",
      fallback: "Background notifications may only work for a short time after you leave the tab.",
      disabled: "Notifications are disabled."
    },
    de: {
      soundHint: "Der Alarmton wird nur abgespielt, wenn dieser Tab aktiv ist.",
      persistent: "Eine Systembenachrichtigung wird gesendet, wenn der Timer endet, auch wenn der Tab geschlossen ist.",
      fallback: "Hintergrundbenachrichtigungen funktionieren möglicherweise nur für kurze Zeit, nachdem Sie den Tab verlassen haben.",
      disabled: "Benachrichtigungen sind deaktiviert."
    }
};

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
    const wakeLockSentinel = useRef<any>(null);
    const interactionStartRef = useRef<{time: number, angle: number, wasRunning: boolean} | null>(null);
    const quickSetAnimationId = useRef<number | null>(null);
    const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const angleRef = useRef(angle);
    
    const [isMuted, setIsMuted] = useState(true);
    const audioContextRef = useRef<AudioContext | null>(null);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
    const [animationState, setAnimationState] = useState<'idle' | 'bursting'>('idle');
    const [lang, setLang] = useState<'en' | 'de'>('en');

    const [notificationPermission, setNotificationPermission] = useState('default');
    const [supportsPersistentNotifications, setSupportsPersistentNotifications] = useState(false);
    
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

    const [timeUnit, setTimeUnit] = useState<'min' | 'sec'>('min');
    const [isDetailView, setIsDetailView] = useState(false);
    
    const [isTransitioningToAutoSec, setIsTransitioningToAutoSec] = useState(false);
    
    const isPartyModeRef = useRef(isPartyMode);
    isPartyModeRef.current = isPartyMode;
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;
    const timeUnitRef = useRef(timeUnit);
    timeUnitRef.current = timeUnit;
    const isDetailViewRef = useRef(isDetailView);
    isDetailViewRef.current = isDetailView;

    const wasAutoSwitchedRef = useRef(false);
    const displayUnitModeForSwitch = wasAutoSwitchedRef.current ? "auto-sec" : (timeUnit === 'sec' ? "sec" : "min");

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
        if (countdownFrameId.current) {
          cancelAnimationFrame(countdownFrameId.current);
          countdownFrameId.current = null;
        }
        cancelSettingAnimations();
        setTimeData(null);
        lastTickSecond.current = null;
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_TIMER' });
        }
        try {
          localStorage.removeItem(TIMER_STORAGE_KEY);
        } catch (error) {}
    }, [cancelSettingAnimations]);

    const startTimerFromAngle = useCallback((angleToSet: number) => {
        cancelAllTimersAndAnimations();
        stopCelebrationAndReset();
        lastTickSecond.current = null;
        const currentMaxTime = timeUnitRef.current === 'min' ? MAX_TIME_MIN_MS : MAX_TIME_SEC_MS;

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
    
          if (!isMutedRef.current && typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'START_TIMER',
                endTime: newEndTime,
            });
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
            const currentUnit = storedUnit || 'min';
            
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
        if (typeof window !== 'undefined' && navigator.language.startsWith('de')) {
            setLang('de');
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(error => {
            });
        }
    }, []);

    useEffect(() => {
      if (typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator) {
        setNotificationPermission(Notification.permission);
        if ('showTrigger' in Notification.prototype) {
          setSupportsPersistentNotifications(true);
        }
      }
    }, []);

    useEffect(() => {
      const requestWakeLock = async () => {
          if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
              try {
                  wakeLockSentinel.current = await navigator.wakeLock.request('screen');
              } catch (err: any) {
              }
          }
      };

      const releaseWakeLock = async () => {
          if (wakeLockSentinel.current) {
            try {
              await wakeLockSentinel.current.release();
              wakeLockSentinel.current = null;
            } catch (err: any) {
            }
          }
      };

      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && timeData) {
              requestWakeLock();
          }
      };

      if (timeData) {
          requestWakeLock();
          document.addEventListener('visibilitychange', handleVisibilityChange);
      } else {
          releaseWakeLock();
      }

      return () => {
          releaseWakeLock();
          document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }, [timeData]);
    
    const handleQuickSet = useCallback((e: React.MouseEvent | React.TouchEvent, value: number) => {
      e.preventDefault();
      e.stopPropagation();
      setIsTransitioningToAutoSec(false);
      stopCelebrationAndReset();
      cancelAllTimersAndAnimations();
      resetAutoSwitchMode();
      
      const newAngle = (value / 60) * 360;
      animateAngle(newAngle, true, 'set');
    }, [stopCelebrationAndReset, cancelAllTimersAndAnimations, animateAngle, resetAutoSwitchMode]);

    const handleUnitChange = useCallback((newUnit: "min" | "sec") => {
        if (wasAutoSwitchedRef.current) {
            if (newUnit === "min") {
                return;
            }
            if (newUnit === "sec") {
                cancelAllTimersAndAnimations();
                stopCelebrationAndReset();
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
        setTimeData(null); 
        lastTickSecond.current = null;

        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_TIMER' });
        }
    }, []);

    const handleInteractionStart = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
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
        
        await initializeAudio();
        
        const wasRunning = !!timeDataRef.current;
        
        pauseTimer();
        
        if (wasAutoSwitchedRef.current) {
            resetAutoSwitchMode();
        }
        
        cancelSettingAnimations();
        
        interactionStartRef.current = { time: Date.now(), angle: angleRef.current, wasRunning: wasRunning };
        
        setIsDragging(true);
        lastDragAngle.current = null; 
    
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
        const currentMaxTime = currentUnit === 'min' ? MAX_TIME_MIN_MS : MAX_TIME_SEC_MS;
        const duration = (angleRef.current / 360) * currentMaxTime;
        
        const roundingUnitMs = currentUnit === 'min' ? 60 * 1000 : 1000;
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
            const currentMaxTime = currentUnit === 'min' ? MAX_TIME_MIN_MS : MAX_TIME_SEC_MS;
            const duration = (angleRef.current / 360) * currentMaxTime;
            
            const roundingUnitMs = currentUnit === 'min' ? 60 * 1000 : 1000;
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
        if (audioReady) {
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
              try {
                const newPermission = await Notification.requestPermission();
                setNotificationPermission(newPermission);
              } catch (e) {
              }
            }
            if (timeData) { 
                const remaining = timeData.duration - (Date.now() - timeData.startTime);
                const endTime = Date.now() + remaining;
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'START_TIMER', endTime });
                }
            }
        }
      } else { 
        if (isAlarmPlaying) {
            setIsAlarmPlaying(false); 
        }
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_TIMER' });
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
            
            const celebrationInProgress = isAlarmPlayingRef.current || isCelebratingRef.current || animationStateRef.current !== 'idle' || isRainingRef.current;
            if (!celebrationInProgress) {
                interactionStarted = false;
                return;
            }

            interactionStarted = false;

            const isDialClick = (e.target as HTMLElement).closest('[data-dial-container="true"]');
            const isDialChildClick = (e.target as HTMLElement).closest('[data-dial-container-child]');

            if (!titleRef.current?.contains(e.target as Node) && !isDialClick && !isDialChildClick) {
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
        if (timeData === null || isTransitioningToAutoSec) {
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
                const currentMaxTime = timeUnitRef.current === 'sec' ? MAX_TIME_SEC_MS : MAX_TIME_MIN_MS;
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
    }, [timeData, playSingleBeep, resetAutoSwitchMode, playBang, isTransitioningToAutoSec]);

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

  const getNotificationHint = () => {
    if (!hasMounted) return "";
    const hints = translations[lang];
    const soundHint = hints.soundHint;

    if (notificationPermission === 'granted') {
        if (supportsPersistentNotifications) {
            return `${hints.persistent} ${soundHint}`;
        }
        return `${hints.fallback} ${soundHint}`;
    }
    
    if (notificationPermission === 'denied') {
        return `${hints.disabled} ${soundHint}`;
    }
    return soundHint;
  };

  const RenderDial = () => {
    const shouldShowDetailView = isDetailView;

    return (
        <g>
            {/* 1. Background Layer */}
            <g>
                <circle cx={CENTER} cy={CENTER} r={DIAL_RADIUS} className="fill-[hsl(300,100%,97%)]" />
                {shouldShowDetailView && (
                    <g>
                        {ringColors.map((color, i) => {
                            const radius = INNER_WHITE_RADIUS + i * bandWidth + bandWidth / 2;
                            return (
                                <circle
                                    key={`bg-ring-${i}`}
                                    cx={CENTER}
                                    cy={CENTER}
                                    r={radius}
                                    fill="transparent"
                                    stroke={color}
                                    strokeWidth={bandWidth + 0.5}
                                />
                            );
                        })}
                    </g>
                )}
            </g>

            {/* 2. Ticks and Numbers Layer */}
            <g>
                {Array.from({ length: 60 }).map((_, i) => {
                if ((i + 1) % 5 === 0) return null;
                const tickAngle = (i + 1) * 6;
                const start = polarToCartesian(CENTER, CENTER, DIAL_RADIUS - 5, tickAngle);
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
            
            <g>
                {ticks.map((tick, i) => {
                const tickAngle = (i + 1) * 30;
                const start = polarToCartesian(CENTER, CENTER, TICK_START_RADIUS, tickAngle);
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

            {/* 3. Animation Layer (covers background) */}
            {(animationState !== 'bursting' && !isCelebrating) && (
                <g>
                    {shouldShowDetailView ? (
                        <circle
                            cx={CENTER}
                            cy={CENTER}
                            r={(INNER_WHITE_RADIUS + RAINBOW_OUTER_RADIUS) / 2}
                            fill="transparent"
                            stroke="hsl(300,100%,97%)"
                            strokeWidth={RAINBOW_OUTER_RADIUS - INNER_WHITE_RADIUS + 3.5}
                            strokeDasharray={2 * Math.PI * ((INNER_WHITE_RADIUS + RAINBOW_OUTER_RADIUS) / 2)}
                            strokeDashoffset={
                                (2 * Math.PI * ((INNER_WHITE_RADIUS + RAINBOW_OUTER_RADIUS) / 2)) *
                                (1 - (angle / 360))
                            }
                            transform={`rotate(-90 ${CENTER} ${CENTER})`}
                            strokeLinecap="butt"
                        />
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
        <div className="relative w-[320px] h-[320px]">
            {/* Timer dial part */}
            <div className={cn(
                "absolute inset-0 flex items-center justify-center", 
                isFullscreen && "fixed z-40"
            )}>
                {/* backdrop */}
                <div 
                    className={cn(
                        "absolute inset-0 bg-background/90 backdrop-blur-sm transition-opacity duration-400 ease-in-out",
                        isFullscreen ? "opacity-100" : "opacity-0 pointer-events-none"
                    )}
                    onClick={handleBackdropClick}
                />
                {/* dial container */}
                <div
                    ref={containerRef}
                    data-dial-container="true"
                    className={cn(
                        "relative aspect-square touch-none select-none rounded-full transition-all duration-400 ease-in-out",
                        "w-[320px]",
                        isFullscreen && "w-[80vmin]"
                    )}
                    onMouseDown={handleInteractionStart}
                    onTouchStart={handleInteractionStart}
                >
                    <div
                        data-dial-container-child="true"
                        className="absolute -top-1 -left-1 z-20"
                        onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); }}
                        onTouchStart={(e: React.TouchEvent) => { e.stopPropagation(); }}
                    >
                        <TimeUnitSwitch
                            mode={displayUnitModeForSwitch}
                            onUnitChange={handleUnitChange}
                        />
                    </div>
                    

                    {!isForcedFullscreen && (
                        <Button
                            data-dial-container-child="true"
                            variant="secondary"
                            size="icon"
                            className="absolute -top-1 -right-1 z-20 h-8 w-8 rounded-full shadow-md bg-[hsl(300,100%,97%)] hover:bg-[hsl(300,100%,98%)] transition-transform duration-150 active:scale-95"
                            onClick={handleFullscreenToggle}
                            onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); }}
                            onTouchStart={(e: React.TouchEvent) => { e.stopPropagation(); }}
                            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                        >
                            {isFullscreen ? <Minimize className="h-4 w-4" color={INDIGO}/> : <Maximize className="h-4 w-4" color={INDIGO} />}
                        </Button>
                    )}

                    <svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
                        {hasMounted && (
                            <>
                                <defs>
                                    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="rgba(0,0,0,0.15)" />
                                    </filter>
                                    <filter id="text-shadow" x="-50%" y="-50%" width="200%" height="200%">
                                        <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.2)" />
                                    </filter>
                                </defs>
                                
                                <RenderDial />

                                <g filter="url(#shadow)">
                                    <circle cx={CENTER} cy={CENTER} r={CENTER_CIRCLE_RADIUS} className="fill-[hsl(var(--background))]" />
                                    <line
                                        x1={polarToCartesian(CENTER, CENTER, INDICATOR_START_RADIUS, angle).x}
                                        y1={polarToCartesian(CENTER, CENTER, INDICATOR_START_RADIUS, angle).y}
                                        x2={polarToCartesian(CENTER, CENTER, INDICATOR_END_RADIUS, angle).x}
                                        y2={polarToCartesian(CENTER, CENTER, INDICATOR_END_RADIUS, angle).y}
                                        stroke={INDIGO}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </g>
                            </>
                        )}
                    </svg>
                </div>
            </div>

            <div className={cn(
                "absolute top-full left-1/2 -translate-x-1/2 mt-4 w-full max-w-[320px] flex flex-col items-center gap-2 transition-opacity duration-200",
                !isUIVisible && "pointer-events-none opacity-0"
            )}>
                <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full h-14 w-14 shadow-lg fill-[hsl(300,100%,97%)] hover:fill-[hsl(300,100%,97%)] bg-[hsl(300,100%,97%)] hover:bg-[hsl(300,100%,98%)] transition-transform duration-150 active:scale-95"
                    onClick={handleMuteToggle}
                    aria-label={isMuted ? 'Unmute' : 'Mute'}
                >
                    {isMuted ? <VolumeX className="h-6 w-6" color={INDIGO} /> : <Volume2 className="h-6 w-6" color={INDIGO} />}
                </Button>
                <div className="h-12 w-full max-w-[320px] text-center px-4 flex items-center justify-center">
                    <p className={cn(
                        "text-xs text-muted-foreground leading-snug transition-opacity duration-500 pt-1",
                        isMuted && "opacity-0"
                    )}>
                        {getNotificationHint()}
                    </p>
                </div>
            </div>
        </div>

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
