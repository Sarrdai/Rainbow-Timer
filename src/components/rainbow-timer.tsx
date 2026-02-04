"use client";

import React, { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Confetti, ConfettiRain } from './confetti';
import { cn } from '@/lib/utils';

const SIZE = 320;
const CENTER = SIZE / 2;
const DIAL_RADIUS = SIZE / 2 - 40;
const RAINBOW_OUTER_RADIUS = DIAL_RADIUS + 0.5;
const LABEL_RADIUS = DIAL_RADIUS + 20;
const TICK_START_RADIUS = DIAL_RADIUS - 8;
const TICK_END_RADIUS = DIAL_RADIUS;
const MAX_TIME_MS = 60 * 60 * 1000;
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


export function RainbowTimer({ isFullscreen, onFullscreenChange, isPartyMode, isForcedFullscreen, titleBangTrigger, onInterruptCelebration, isUIVisible }: { isFullscreen: boolean; onFullscreenChange: (isFs: boolean) => void; isPartyMode: boolean; isForcedFullscreen: boolean; titleBangTrigger: number; onInterruptCelebration: (e: MouseEvent | TouchEvent) => void; isUIVisible: boolean; }) {
    const [hasMounted, setHasMounted] = useState(false);
    const [angle, setAngle] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [timeData, setTimeData] = useState<{ startTime: number; duration: number } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const countdownFrameId = useRef<number | null>(null);
    const lastDragAngle = useRef<number | null>(null);
    const wakeLockSentinel = useRef<any>(null);
    const interactionStartRef = useRef<{time: number, angle: number, wasRunning: boolean} | null>(null);
    const quickSetAnimationId = useRef<number | null>(null);
    
    const [isMuted, setIsMuted] = useState(true);
    const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
    const animationStartRef = useRef<number>(0);
    const [animationState, setAnimationState] = useState<'idle' | 'growing' | 'bursting'>('idle');
    const [lang, setLang] = useState<'en' | 'de'>('en');

    const [notificationPermission, setNotificationPermission] = useState('default');
    const [supportsPersistentNotifications, setSupportsPersistentNotifications] = useState(false);
    
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
    const isAlarmPlayingRef = useRef(isAlarmPlaying);
isAlarmPlayingRef.current = isAlarmPlaying;

    const lastTickSecond = useRef<number | null>(null);
    const growingSoundRef = useRef<OscillatorNode | null>(null);

    useEffect(() => {
        setHasMounted(true);
    }, []);

    const handleFullscreenToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        onFullscreenChange(!isFullscreen);
    };

    const handleBackdropClick = () => {
        if (isFullscreen && !isForcedFullscreen) {
            onFullscreenChange(false);
        }
    };

    const playSingleBeep = useCallback(() => {
        const audioCtx = audioContextRef.current;
        if (!audioCtx || isMuted || audioCtx.state !== 'running') return;
    
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
    }, [isMuted]);

    const stopGrowingSound = useCallback(() => {
        if (growingSoundRef.current) {
            try {
                growingSoundRef.current.stop();
            } catch (e) {
                // Oscillator might have already stopped
            }
            growingSoundRef.current = null;
        }
    }, []);

    const playGrowingSound = useCallback(() => {
        const audioCtx = audioContextRef.current;
        if (!audioCtx || isMuted || audioCtx.state !== 'running') return;

        stopGrowingSound(); // Stop any previous instance

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.type = 'triangle';
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        const now = audioCtx.currentTime;
        const duration = 0.562; // Duration of the growing animation

        gainNode.gain.setValueAtTime(0.3, now);
        gainNode.gain.setValueAtTime(0.3, now + duration);

        oscillator.frequency.setValueAtTime(440, now); // Start at A4
        oscillator.frequency.linearRampToValueAtTime(1200, now + duration); // Ramp up

        oscillator.start(now);
        oscillator.stop(now + duration); // Automatically stops

        growingSoundRef.current = oscillator;
    }, [isMuted, stopGrowingSound]);

    const stopCelebrationAndReset = useCallback((e?: MouseEvent | TouchEvent) => {
        if (!isCelebratingRef.current && animationStateRef.current === 'idle' && !isRainingRef.current) {
            return;
        }

        if (e) {
            onInterruptCelebration(e);
        }

        interruptedRef.current = true;
        setIsCelebrating(false);
        setAnimationState('idle');
        setIsAlarmPlaying(false);
        stopGrowingSound();

        if (!interruptionTime) {
            setInterruptionTime(Date.now());
        }
        
        // After 2 seconds (duration of fade out), clean up everything
        setTimeout(() => {
            // Only reset if no new celebration has started in the meantime
            if (interruptedRef.current) {
                setIsRaining(false);
                setMountConfettiRain(false);
                setInterruptionTime(null);
                interruptedRef.current = false;
            }
        }, 2000);

    }, [stopGrowingSound, interruptionTime, onInterruptCelebration]);

    useEffect(() => {
        if (navigator.language.startsWith('de')) {
            setLang('de');
        }
    }, []);

    // PWA Service Worker setup
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(error => {
                // Registration failed
            });
        }
    }, []);

    // Notification capability detection
    useEffect(() => {
      if ('Notification' in window && 'serviceWorker' in navigator) {
        setNotificationPermission(Notification.permission);
        if ('showTrigger' in Notification.prototype) {
          setSupportsPersistentNotifications(true);
        }
      }
    }, []);

    // Screen Wake Lock
    useEffect(() => {
      const requestWakeLock = async () => {
          if ('wakeLock' in navigator) {
              try {
                  wakeLockSentinel.current = await navigator.wakeLock.request('screen');
              } catch (err: any) {
                  // Wake lock request can fail, e.g. if tab is not visible.
              }
          }
      };

      const releaseWakeLock = async () => {
          if (wakeLockSentinel.current) {
            try {
              await wakeLockSentinel.current.release();
              wakeLockSentinel.current = null;
            } catch (err: any) {
                // Ignore release errors
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

    const cancelAllTimersAndAnimations = useCallback(() => {
        if (countdownFrameId.current) {
          cancelAnimationFrame(countdownFrameId.current);
          countdownFrameId.current = null;
        }
        if (quickSetAnimationId.current) {
            cancelAnimationFrame(quickSetAnimationId.current);
            quickSetAnimationId.current = null;
        }
        setTimeData(null);
        lastTickSecond.current = null;
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_TIMER' });
        }
        try {
          localStorage.removeItem(TIMER_STORAGE_KEY);
        } catch (error) {}
    }, []);
    
    const startTimerFromAngle = useCallback((angleToSet: number) => {
        cancelAllTimersAndAnimations();
        stopCelebrationAndReset();
        lastTickSecond.current = null;
        if (angleToSet > 0.1) {
          const duration = (angleToSet / 360) * MAX_TIME_MS;
          const newEndTime = Date.now() + duration;
    
          setTimeData({
            startTime: Date.now(),
            duration: duration,
          });
  
          try {
            const dataToStore = JSON.stringify({ endTime: newEndTime, duration });
            localStorage.setItem(TIMER_STORAGE_KEY, dataToStore);
          } catch (error) {
            // Ignore write errors
          }
    
          if (!isMuted && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
                type: 'START_TIMER',
                endTime: newEndTime,
            });
          }
    
        } else {
            cancelAllTimersAndAnimations();
            setAngle(0);
        }
      }, [cancelAllTimersAndAnimations, isMuted, stopCelebrationAndReset]);

      const animateAngle = useCallback((targetAngle: number) => {
        const DURATION = 400; // ms
        const startAngle = angle;
        const startTime = performance.now();

        if (quickSetAnimationId.current) {
            cancelAnimationFrame(quickSetAnimationId.current);
        }

        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / DURATION, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3); // Ease-out cubic

            const newAngle = startAngle + (targetAngle - startAngle) * easedProgress;
            setAngle(newAngle);

            if (progress < 1) {
                quickSetAnimationId.current = requestAnimationFrame(step);
            } else {
                setAngle(targetAngle);
                startTimerFromAngle(targetAngle);
                quickSetAnimationId.current = null;
            }
        };

        quickSetAnimationId.current = requestAnimationFrame(step);
    }, [angle, startTimerFromAngle]);

    const handleQuickSet = useCallback((minutes: number) => {
      stopCelebrationAndReset();
      cancelAllTimersAndAnimations();
      
      const newAngle = (minutes / 60) * 360;
      animateAngle(newAngle);
    }, [stopCelebrationAndReset, cancelAllTimersAndAnimations, animateAngle]);

    const pauseTimer = useCallback(() => {
        if (countdownFrameId.current) {
            cancelAnimationFrame(countdownFrameId.current);
            countdownFrameId.current = null;
        }
        if (quickSetAnimationId.current) {
            cancelAnimationFrame(quickSetAnimationId.current);
            quickSetAnimationId.current = null;
        }
        
        if (timeData) {
            const elapsed = Date.now() - timeData.startTime;
            const remaining = timeData.duration - elapsed;
            const remainingAngle = (remaining / MAX_TIME_MS) * 360;
            if (isFinite(remainingAngle)) {
                setAngle(Math.max(0, remainingAngle));
            }
            setTimeData(null);
        }
        lastTickSecond.current = null;

        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_TIMER' });
        }
    }, [timeData]);

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const target = e.target as HTMLElement;
        if (target.closest('g.quick-set-button')) {
            e.stopPropagation();
            return;
        }
        
        const celebrationInProgress = isCelebratingRef.current || animationStateRef.current !== 'idle';
        if (celebrationInProgress) {
            // The global listener will handle stopping the celebration
            return;
        }
        
        if (quickSetAnimationId.current) {
            cancelAnimationFrame(quickSetAnimationId.current);
            quickSetAnimationId.current = null;
        }

        const targetButton = e.target as HTMLElement;
        if (targetButton.closest('button')) {
            e.stopPropagation();
            return;
        }
        
        interactionStartRef.current = { time: Date.now(), angle, wasRunning: !!timeData };
        
        setIsDragging(true);
        lastDragAngle.current = null; 

    }, [angle, timeData]);
    
    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const celebrationInProgress = isCelebratingRef.current || animationStateRef.current !== 'idle';
      if(celebrationInProgress && !interruptedRef.current) return;
      
      if ('touches' in e && e.cancelable) e.preventDefault();
    
      if (interactionStartRef.current) {
        if (interactionStartRef.current.wasRunning) {
            pauseTimer();
        }
        if(animationStateRef.current === 'growing' && interactionStartRef.current.angle > 0) {
            setAngle(interactionStartRef.current.angle);
        }
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
        return Math.max(0, Math.min(360, newAngle));
      });
      lastDragAngle.current = currentAngleFromCoords;
    }, [isDragging, pauseTimer]);

    const handleInteractionEnd = useCallback(() => {
        if (isDragging) {
            setIsDragging(false);
            lastDragAngle.current = null;
            
            const startInfo = interactionStartRef.current;
            interactionStartRef.current = null;

            if (startInfo) {
                const elapsed = Date.now() - startInfo.time;
                if (elapsed < 200) { // It's a tap, not a drag
                    const celebrationInProgress = isCelebratingRef.current || animationStateRef.current !== 'idle';
                    if (celebrationInProgress) {
                      // Already handled by the global listener
                      return;
                    }
                    if (startInfo.wasRunning) {
                        startTimerFromAngle(startInfo.angle); // Resume timer
                        return;
                    }
                    
                    setAngle(0);
                    return;
                }
            }
            
            if (!interruptedRef.current) {
                startTimerFromAngle(angle);
            }
        }
    }, [isDragging, angle, startTimerFromAngle]);

    const handleMuteToggle = async () => {
      const celebrationInProgress = isCelebratingRef.current || animationStateRef.current !== 'idle';
      if (celebrationInProgress) {
        stopCelebrationAndReset();
        return; 
      }
      
      const initializeAudio = async () => {
          if (!audioContextRef.current) {
              try {
                  audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
              } catch (e) {
                  return false;
              }
          }
          if (audioContextRef.current.state === 'suspended') {
              try {
                  await audioContextRef.current.resume();
              } catch (e) {
                  return false;
              }
          }
          return true;
      };
    
      const audioReady = await initializeAudio();
      
      if (isMuted) { // Unmuting
        if (audioReady) {
            setIsMuted(false);
            if (!alarmAudioRef.current) {
              alarmAudioRef.current = new Audio('/party-horn.mp3');
              alarmAudioRef.current.loop = true;
              alarmAudioRef.current.load();
            }
            if ('Notification' in window && Notification.permission === 'default') {
              try {
                const newPermission = await Notification.requestPermission();
                setNotificationPermission(newPermission);
              } catch (e) {
                // User might deny, that's fine
              }
            }
            if (timeData) { // If a timer is running, schedule a notification
                const remaining = timeData.duration - (Date.now() - timeData.startTime);
                const endTime = Date.now() + remaining;
                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.controller.postMessage({ type: 'START_TIMER', endTime });
                }
            }
        }
      } else { // Muting
        setIsMuted(true);
        if (isAlarmPlaying) {
            setIsAlarmPlaying(false); // This will stop the sound via the useEffect
        }
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'CANCEL_TIMER' });
        }
      }
    };

    useEffect(() => {
        try {
          const storedData = localStorage.getItem(TIMER_STORAGE_KEY);
          if (storedData) {
            const { endTime, duration } = JSON.parse(storedData);
            const remaining = endTime - Date.now();
            
            if (remaining > 0 && duration > 0) {
              const newStartTime = Date.now() - (duration - remaining);
              setTimeData({
                startTime: newStartTime,
                duration: duration,
              });
              const newAngle = (remaining / duration) * (duration / MAX_TIME_MS * 360);
              if(isFinite(newAngle)) {
                setAngle(newAngle);
              } else {
                setAngle(0);
              }

              if (!isMuted && 'serviceWorker' in navigator && navigator.serviceWorker.ready) {
                navigator.serviceWorker.ready.then(registration => {
                  registration.active?.postMessage({
                      type: 'START_TIMER',
                      endTime: endTime,
                  });
                });
              }
            } else if (remaining <= 0) {
                localStorage.removeItem(TIMER_STORAGE_KEY);
            }
          }
        } catch (error) {
          // Ignore read/parse errors
        }
      }, [isMuted]);

    useEffect(() => {
        const moveHandler = (e: MouseEvent | TouchEvent) => handleInteractionMove(e);
        const endHandler = (e: MouseEvent | TouchEvent) => handleInteractionEnd();

        if (isDragging) {
          window.addEventListener('mousemove', moveHandler);
          window.addEventListener('touchmove', moveHandler, { passive: false });
          window.addEventListener('mouseup', endHandler);
          window.addEventListener('touchend', endHandler);
        }
    
        return () => {
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.removeEventListener('mouseup', endHandler);
          window.removeEventListener('touchend', endHandler);
        };
      }, [isDragging, handleInteractionMove, handleInteractionEnd]);
    
    // Global click listener to interrupt celebration
    useEffect(() => {
        const handler = (e: MouseEvent | TouchEvent) => {
            const celebrationInProgress = isCelebratingRef.current || animationStateRef.current !== 'idle';
            if (!celebrationInProgress) return;

            stopCelebrationAndReset(e);
        };
        document.body.addEventListener('mousedown', handler);
        document.body.addEventListener('touchstart', handler);
        return () => {
            document.body.removeEventListener('mousedown', handler);
            document.body.removeEventListener('touchstart', handler);
        }
    }, [stopCelebrationAndReset]);

  useEffect(() => {
    if (!timeData || animationState !== 'idle') {
      if (countdownFrameId.current) {
        cancelAnimationFrame(countdownFrameId.current);
        countdownFrameId.current = null;
      }
      return;
    }

    const animate = () => {
      const elapsed = Date.now() - timeData.startTime;
      const remaining = timeData.duration - elapsed;

      // Countdown ticks for the last 5 seconds
      if (!isMuted && remaining > 0 && remaining <= 5000) {
        const currentSecond = Math.ceil(remaining / 1000);
        if (lastTickSecond.current !== currentSecond) {
            playSingleBeep();
            lastTickSecond.current = currentSecond;
        }
      }

      if (remaining <= 0) {
        setAngle(0); // Set visual to 0 first
        setTimeData(null); 
        setAnimationState('growing');
        try {
            localStorage.removeItem(TIMER_STORAGE_KEY);
        } catch(e) {
            // ignore
        }
      } else {
        const initialAngle = (timeData.duration / MAX_TIME_MS) * 360;
        const newAngle = (remaining / timeData.duration) * initialAngle;
        setAngle(newAngle);
        countdownFrameId.current = requestAnimationFrame(animate);
      }
    };

    countdownFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (countdownFrameId.current) cancelAnimationFrame(countdownFrameId.current);
    };
  }, [timeData, animationState, isMuted, playSingleBeep]);

    const playBang = useCallback(() => {
        const audioCtx = audioContextRef.current;
        if (!audioCtx || isMuted || audioCtx.state !== 'running') return;

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
    }, [isMuted]);

    useEffect(() => {
      if (titleBangTrigger > 0) {
        playBang();
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [titleBangTrigger]);

  useEffect(() => {
    let animationFrameId: number;
    if (animationState === 'growing') {
        interruptedRef.current = false; // Reset interruption flag for new animation
        playGrowingSound();
        animationStartRef.current = performance.now();
        const duration = 562; 

        const growAnimation = (now: number) => {
            if (interruptedRef.current) return;

            const elapsed = now - animationStartRef.current;
            let progress = Math.min(elapsed / duration, 1);
            
            setAngle(360 * progress);

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(growAnimation);
            } else {
                setAngle(0); // Snap to zero at the end
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
                    
                    if (isPartyMode) {
                        setMountConfettiRain(true);
                        setIsRaining(true);
                    }
                    
                    setTimeout(() => {
                        if (isCelebratingRef.current && !interruptedRef.current) {
                            setIsAlarmPlaying(true);
                        }
                    }, 200);
                }
            }
        };
        animationFrameId = requestAnimationFrame(growAnimation);
    }
    return () => cancelAnimationFrame(animationFrameId);
  }, [animationState, playBang, playGrowingSound, isPartyMode]);

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

  return (
    <>
        <div className="relative w-[320px] h-[320px]">
            {/* Timer dial part */}
            <div className={cn(
                "absolute inset-0 flex items-center justify-center", 
                isFullscreen && "fixed z-50"
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
                    className={cn(
                        "relative aspect-square touch-none select-none rounded-full transition-all duration-400 ease-in-out",
                        "w-[320px]",
                        isFullscreen && "w-[80vmin]"
                    )}
                    onMouseDown={handleInteractionStart}
                    onTouchStart={handleInteractionStart}
                >
                    {!isForcedFullscreen && (
                        <Button
                            variant="secondary"
                            size="icon"
                            className="absolute -top-1 -right-1 z-20 h-8 w-8 rounded-full shadow-md bg-[hsl(300,100%,97%)] hover:bg-[hsl(300,100%,98%)] transition-transform duration-150 active:scale-95"
                            onClick={handleFullscreenToggle}
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
                        <circle cx={CENTER} cy={CENTER} r={DIAL_RADIUS} className="fill-[hsl(300,100%,97%)]" filter="url(#shadow)" />
                        
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
                                <g key={tick} onClick={() => handleQuickSet(60)} style={{ cursor: 'pointer' }} className="group quick-set-button">
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
                                <g key={tick} onClick={() => handleQuickSet(tick)} style={{ cursor: 'pointer' }} className="group quick-set-button">
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
                        
                        {angle > 0 && animationState !== 'bursting' && !isCelebrating && ringColors.map((color, i) => {
                            const radius = INNER_WHITE_RADIUS + i * bandWidth + bandWidth / 2;
                            const circumference = 2 * Math.PI * radius;
                            const effectiveAngle = angle > 0 && angle < 0.5 ? 0.5 : angle;
                            const strokeDashoffset = circumference * (1 - (effectiveAngle / 360));

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

            {/* Volume button part */}
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
