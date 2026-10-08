"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Maximize, Minimize, Volume2, VolumeX } from 'lucide-react';
import { confetti } from './confetti';
import { RAINBOW_COLORS } from '@/lib/palette';
import { sounds } from '@/lib/sounds';
import { cn } from '@/lib/utils';
import { TimeUnitSwitch } from './time-unit-switch';
import { Dial, type DialHint, type HubContent, type Particle } from './timer/dial';
import {
    type TimeUnit, LABEL_RADIUS, MAX_TIME_MS, SNAP_UNIT_MS,
    angleToMs, msToAngle, snapAngle, polarToCartesian,
    formatClock, formatSetValue, formatSpoken,
} from './timer/geometry';
import { useAnimatedProgress } from './timer/use-animated-progress';
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

const TIMER_STORAGE_KEY = 'rainbowTimerData';
const MUTED_STORAGE_KEY = 'rainbowTimerMuted';
// Countdown angle is quantized to 1/50° (sub-pixel even in fullscreen): frames without a
// visible change don't re-render.
const ANGLE_QUANTUM = 50;
const KEYBOARD_START_DELAY_MS = 1000;
// First-run hint: ghost handle (2 sweeps), then number wave (2 rounds). Skipped once the dial was used.
const HINT_SEEN_KEY = 'rainbowTimerHintSeen';
const HINT_GHOST_MS = 6500;
const HINT_WAVE_MS = 6800;
const IDLE_CAPTION = 'Drag the handle clockwise, or tap a number';

interface StoredTimer {
    endTime?: number;
    duration?: number;
    pausedRemaining?: number;
    unit?: TimeUnit;
}

/** Position of a mouse click or touch */
const tapPoint = (e: MouseEvent | TouchEvent) => {
    const p = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e;
    return p ? { x: p.clientX, y: p.clientY } : null;
};

const writeStorage = (data: StoredTimer | null) => {
    try {
        if (data) localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(data));
        else localStorage.removeItem(TIMER_STORAGE_KEY);
    } catch {}
};

const stopNativeTimer = () => {
    if (!isNativePlatform()) return;
    cancelAllNotifications();
    if (isAndroid()) stopTimerForegroundService();
};

const iconButtonClass = "flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const pillClass = "flex items-center gap-1.5 rounded-full p-1.5 shadow-[0_4px_14px_var(--control-shadow)]";

interface RainbowTimerProps {
    isFullscreen: boolean;
    onFullscreenChange: (isFs: boolean) => void;
    isPartyMode: boolean;
    isForcedFullscreen: boolean;
    titleRef: React.RefObject<HTMLDivElement | null>;
}

export function RainbowTimer({ isFullscreen, onFullscreenChange, isPartyMode, isForcedFullscreen, titleRef }: RainbowTimerProps) {
    const [hasMounted, setHasMounted] = useState(false);
    const [angle, setAngle] = useState(0);
    const angleRef = useRef(angle);
    angleRef.current = angle;
    const [isDragging, setIsDragging] = useState(false);
    const isDraggingRef = useRef(isDragging);
    isDraggingRef.current = isDragging;
    const [isKeyboardSetting, setIsKeyboardSetting] = useState(false);
    const [timeData, setTimeData] = useState<{ startTime: number; duration: number } | null>(null);
    const timeDataRef = useRef(timeData);
    timeDataRef.current = timeData;
    // Remaining whole seconds for the hub clock; only changes once per second
    const [remainingSec, setRemainingSec] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const isPausedRef = useRef(isPaused);
    isPausedRef.current = isPaused;
    const pausedRemainingRef = useRef(0);

    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const countdownFrameId = useRef<number | null>(null);
    const lastDragAngle = useRef<number | null>(null);
    const interactionStartRef = useRef<{ time: number, angle: number, wasRunning: boolean } | null>(null);
    const quickSetAnimationId = useRef<number | null>(null);
    const snapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const keyboardStartTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const interruptTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const burstIdRef = useRef(0);

    const [hintPhase, setHintPhase] = useState<'ghost' | 'wave' | 'done'>('done');

    const [isMuted, setIsMuted] = useState(true);
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;
    const [animationState, setAnimationState] = useState<'idle' | 'bursting'>('idle');
    const [isAlarmPlaying, setIsAlarmPlaying] = useState(false);
    const [isRaining, setIsRaining] = useState(false);
    const [isCelebrating, setIsCelebrating] = useState(false);
    useEffect(() => { sounds.setMuted(isMuted); }, [isMuted]);

    const interruptedRef = useRef(false);
    // Set when the app returns to foreground and the timer already expired in background.
    // Cleared once the countdown loop picks it up.
    const timerExpiredInBgRef = useRef(false);
    // Set for the duration of a celebration that was triggered by a background expiry.
    // Suppresses the looping alarm.
    const silentCelebrationRef = useRef(false);

    const celebrationRef = useRef({ isAlarmPlaying, isCelebrating, animationState, isRaining });
    celebrationRef.current = { isAlarmPlaying, isCelebrating, animationState, isRaining };
    const isCelebrationInProgress = (includeRain = true) => {
        const c = celebrationRef.current;
        return c.isAlarmPlaying || c.isCelebrating || c.animationState !== 'idle' || (includeRain && c.isRaining);
    };

    const lastTickSecond = useRef<number | null>(null);

    const [timeUnit, setTimeUnit] = useState<TimeUnit>('min');
    const [isDetailView, setIsDetailView] = useState(false);
    const [isTransitioningToAutoSec, setIsTransitioningToAutoSec] = useState(false);
    const [isTransitioningToAutoMin, setIsTransitioningToAutoMin] = useState(false);

    const isPartyModeRef = useRef(isPartyMode);
    isPartyModeRef.current = isPartyMode;
    const timeUnitRef = useRef(timeUnit);
    timeUnitRef.current = timeUnit;
    const isDetailViewRef = useRef(isDetailView);
    isDetailViewRef.current = isDetailView;

    const wasAutoSwitchedRef = useRef(false);
    const wasAutoSwitchedToMinRef = useRef(false);

    const displayUnitModeForSwitch = wasAutoSwitchedRef.current ? "auto-sec"
        : wasAutoSwitchedToMinRef.current ? "auto-min"
        : timeUnit;

    // Slider stays on the originally selected mode, not the auto-switched mode
    const sliderModeForSwitch: TimeUnit =
        wasAutoSwitchedRef.current
            ? (wasAutoSwitchedToMinRef.current ? "hr" : "min") // hr→auto-min→auto-sec stays hr; min→auto-sec stays min
            : wasAutoSwitchedToMinRef.current
            ? "hr" // hr→auto-min stays hr
            : timeUnit;

    const secModeProgress = useAnimatedProgress(timeUnit === 'sec' && !wasAutoSwitchedRef.current ? 1 : 0, 500);
    const hrModeProgress = useAnimatedProgress(timeUnit === 'hr' ? 1 : 0, 350);

    const [explosionParticles, setExplosionParticles] = useState<Particle[]>([]);
    const explosionCounterRef = useRef(0);
    const prevTimeUnitRef = useRef<TimeUnit>('min');

    // --- Celebration -------------------------------------------------------------------

    const stopCelebrationAndReset = useCallback((e?: MouseEvent | TouchEvent | React.MouseEvent | React.TouchEvent) => {
        if (!isCelebrationInProgress()) return;

        silentCelebrationRef.current = false;

        // The gust starts at the tap; without a tap position (keyboard, title click) at the center of the dial
        const isTitleClick = e && titleRef.current?.contains(e.target as Node);
        const tap = e && !isTitleClick ? tapPoint(('nativeEvent' in e ? e.nativeEvent : e) as MouseEvent | TouchEvent) : null;
        const rect = containerRef.current?.getBoundingClientRect();
        const origin = tap ?? (rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 2 });

        interruptedRef.current = true;
        setIsCelebrating(false);
        setIsAlarmPlaying(false);
        setAnimationState('idle');
        setIsRaining(false);
        confetti.interrupt(origin.x, origin.y);
        sounds.horn(false);

        if (interruptTimeoutRef.current) clearTimeout(interruptTimeoutRef.current);
        interruptTimeoutRef.current = setTimeout(() => {
            interruptedRef.current = false;
            interruptTimeoutRef.current = null;
        }, 2000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [titleRef]);

    const celebrate = useCallback((silent: boolean) => {
        silentCelebrationRef.current = silent;
        const burstId = ++burstIdRef.current;
        const rect = containerRef.current?.getBoundingClientRect();
        setAnimationState('bursting');
        setIsCelebrating(true);
        if (rect) {
            confetti.timerEnd(rect).then(() => {
                if (burstIdRef.current === burstId) setAnimationState('idle');
            });
        } else {
            setAnimationState('idle');
        }

        if (isPartyModeRef.current) setIsRaining(true);

        if (!silent) {
            sounds.horn(true);
            setIsAlarmPlaying(true);
        }
    }, []);

    useEffect(() => {
        confetti.setRaining(isRaining);
    }, [isRaining]);

    // --- Timer control -----------------------------------------------------------------

    const cancelSettingAnimations = useCallback(() => {
        if (snapTimeoutRef.current) {
            clearTimeout(snapTimeoutRef.current);
            snapTimeoutRef.current = null;
        }
        if (keyboardStartTimeoutRef.current) {
            clearTimeout(keyboardStartTimeoutRef.current);
            keyboardStartTimeoutRef.current = null;
        }
        if (quickSetAnimationId.current) {
            cancelAnimationFrame(quickSetAnimationId.current);
            quickSetAnimationId.current = null;
        }
    }, []);

    /** Stops the countdown without touching the dial angle */
    const pauseTimer = useCallback(() => {
        if (countdownFrameId.current) {
            cancelAnimationFrame(countdownFrameId.current);
            countdownFrameId.current = null;
        }
        setIsTransitioningToAutoSec(false);
        setIsTransitioningToAutoMin(false);
        setTimeData(null);
        lastTickSecond.current = null;
        stopNativeTimer();
    }, []);

    const cancelAllTimersAndAnimations = useCallback(() => {
        pauseTimer();
        cancelSettingAnimations();
        setIsPaused(false);
        setIsKeyboardSetting(false);
        writeStorage(null);
    }, [pauseTimer, cancelSettingAnimations]);

    const startTimer = useCallback(async (duration: number) => {
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

        if (duration < 50) {
            setAngle(0);
            return;
        }

        const now = Date.now();
        const endTime = now + duration;
        setTimeData({ startTime: now, duration });
        setRemainingSec(Math.ceil(duration / 1000));
        writeStorage({ endTime, duration, unit: timeUnitRef.current });

        // Schedule end-of-timer alarm notification (only when not muted)
        if (isNativePlatform() && !isMutedRef.current) {
            await scheduleTimerNotification(new Date(endTime), 'party_horn.mp3');
        }
    }, [cancelAllTimersAndAnimations, stopCelebrationAndReset]);

    const startTimerFromAngle = useCallback((angleToSet: number) => {
        return startTimer(angleToMs(angleToSet, timeUnitRef.current));
    }, [startTimer]);

    const pauseExplicit = useCallback(() => {
        const td = timeDataRef.current;
        if (!td) return;
        const remaining = Math.max(0, td.duration - (Date.now() - td.startTime));
        pauseTimer();
        pausedRemainingRef.current = remaining;
        setIsPaused(true);
        setRemainingSec(Math.ceil(remaining / 1000));
        setAngle(msToAngle(remaining, timeUnitRef.current));
        writeStorage({ pausedRemaining: remaining, unit: timeUnitRef.current });
    }, [pauseTimer]);

    const togglePause = useCallback(() => {
        if (isCelebrationInProgress()) {
            stopCelebrationAndReset();
            return;
        }
        if (isPausedRef.current) startTimer(pausedRemainingRef.current);
        else if (timeDataRef.current) pauseExplicit();
        else if (angleRef.current > 0) startTimerFromAngle(angleRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startTimer, pauseExplicit, startTimerFromAngle, stopCelebrationAndReset]);

    const animateAngle = useCallback((targetAngle: number, startTimerOnComplete = true) => {
        cancelSettingAnimations();
        const DURATION = 400;
        let animationStartTime: number | null = null;
        const startAngle = angleRef.current;

        const step = (currentTime: number) => {
            if (animationStartTime === null) animationStartTime = currentTime;
            const progress = Math.min((currentTime - animationStartTime) / DURATION, 1);
            const eased = 1 - Math.pow(1 - progress, 3);

            if (progress < 1) {
                setAngle(startAngle + (targetAngle - startAngle) * eased);
                quickSetAnimationId.current = requestAnimationFrame(step);
            } else {
                setAngle(targetAngle);
                quickSetAnimationId.current = null;
                if (startTimerOnComplete) startTimerFromAngle(targetAngle);
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

    // --- Restore state -----------------------------------------------------------------

    useEffect(() => {
      setHasMounted(true);
      try {
        const storedMuteState = localStorage.getItem(MUTED_STORAGE_KEY);
        if (storedMuteState) setIsMuted(JSON.parse(storedMuteState));
      } catch {}

      try {
        const storedData = localStorage.getItem(TIMER_STORAGE_KEY);
        if (!storedData) return;
        const { endTime, duration, pausedRemaining, unit }: StoredTimer = JSON.parse(storedData);
        const currentUnit = unit || 'min';

        if (pausedRemaining && pausedRemaining > 0) {
            setTimeUnit(currentUnit);
            setIsDetailView(currentUnit === 'sec');
            pausedRemainingRef.current = pausedRemaining;
            setIsPaused(true);
            setRemainingSec(Math.ceil(pausedRemaining / 1000));
            setAngle(msToAngle(pausedRemaining, currentUnit));
            return;
        }

        const remaining = (endTime ?? 0) - Date.now();
        if (remaining > 0 && duration && duration > 0) {
            setTimeUnit(currentUnit);
            setIsDetailView(currentUnit === 'sec');
            setTimeData({ startTime: Date.now() - (duration - remaining), duration });
        } else {
            writeStorage(null);
        }
      } catch {}
    }, []);

    // Confetti explosion on hr mode transitions
    useEffect(() => {
        const prev = prevTimeUnitRef.current;
        prevTimeUnitRef.current = timeUnit;
        if ((prev === 'hr') === (timeUnit === 'hr')) return;

        const newParticles: Particle[] = [];
        const batchId = ++explosionCounterRef.current;
        const svgNow = svgRef.current?.getCurrentTime() ?? 0;

        for (let labelIndex = 0; labelIndex < 12; labelIndex++) {
            const labelPos = polarToCartesian(LABEL_RADIUS, ((labelIndex + 1) / 12) * 360);
            const count = 8 + Math.floor(Math.random() * 5);
            for (let p = 0; p < count; p++) {
                const particleAngleRad = ((Math.random() * 360 + (Math.random() - 0.5) * 30) * Math.PI) / 180;
                const speed = 12 + Math.random() * 18;
                newParticles.push({
                    key: `exp-${batchId}-${labelIndex}-${p}`,
                    startX: labelPos.x,
                    startY: labelPos.y,
                    dx: Math.cos(particleAngleRad) * speed,
                    dy: Math.sin(particleAngleRad) * speed,
                    color: RAINBOW_COLORS[(labelIndex + p) % RAINBOW_COLORS.length],
                    r: 1.5 + Math.random() * 2.5,
                    duration: 400 + Math.random() * 300,
                    beginTimeSec: svgNow,
                });
            }
        }

        setExplosionParticles(newParticles);
        const timeout = setTimeout(() => setExplosionParticles([]), 700);
        return () => clearTimeout(timeout);
    }, [timeUnit]);

    const handleFullscreenToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onFullscreenChange(!isFullscreen);
    };

    const handleBackdropClick = () => {
        if (isFullscreen && !isForcedFullscreen) onFullscreenChange(false);
    };

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
      const handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && timeData) keepAwake();
      };

      if (timeData) {
          keepAwake();
          document.addEventListener('visibilitychange', handleVisibilityChange);
      } else {
          allowSleep();
      }

      return () => {
          allowSleep();
          document.removeEventListener('visibilitychange', handleVisibilityChange);
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
                    startTimerForegroundService(Date.now() + remaining, td.duration, MAX_TIME_MS[timeUnitRef.current]);
                }
            } else if (document.visibilityState === 'visible') {
                stopTimerForegroundService();
                // If the timer expired while the app was hidden (background / screen locked),
                // mark it so the countdown loop can start a silent celebration (animation
                // without looping alarm) and cancel any pending notifications immediately.
                const td = timeDataRef.current;
                if (td && !silentCelebrationRef.current && td.duration - (Date.now() - td.startTime) <= 0) {
                    timerExpiredInBgRef.current = true;
                    cancelAllNotifications();
                }
            }
        };

        document.addEventListener('visibilitychange', handleForegroundVisibility);
        return () => document.removeEventListener('visibilitychange', handleForegroundVisibility);
    }, []);

    // --- User input --------------------------------------------------------------------

    const handleQuickSet = useCallback((e: React.MouseEvent | React.TouchEvent, value: number) => {
      e.preventDefault();
      e.stopPropagation();

      if (isCelebrationInProgress()) {
        stopCelebrationAndReset(e);
        return;
      }

      wasAutoSwitchedToMinRef.current = false;
      cancelAllTimersAndAnimations();
      resetAutoSwitchMode();
      animateAngle((value / 60) * 360, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [stopCelebrationAndReset, cancelAllTimersAndAnimations, animateAngle, resetAutoSwitchMode]);

    const handleUnitChange = useCallback((newUnit: TimeUnit) => {
        // In an auto mode every selection is explicit (reset, confirm or jump ahead)
        const isAutoMode = wasAutoSwitchedRef.current || wasAutoSwitchedToMinRef.current;
        if (!isAutoMode && timeUnitRef.current === newUnit) return;

        cancelAllTimersAndAnimations();
        stopCelebrationAndReset();
        wasAutoSwitchedRef.current = false;
        wasAutoSwitchedToMinRef.current = false;
        setTimeUnit(newUnit);
        setIsDetailView(newUnit === 'sec');
        setAngle(0);
    }, [cancelAllTimersAndAnimations, stopCelebrationAndReset]);

    const handleInteractionStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        // Ignore duplicate start events during dragging (happens with touch on SVG elements)
        if (isDraggingRef.current) {
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        if (isCelebrationInProgress()) {
          stopCelebrationAndReset(e);
          e.stopPropagation();
          e.preventDefault();
          return;
        }

        if ((e.target as Element).closest('[data-dial-container-child]')) {
          e.stopPropagation();
          return;
        }

        const wasRunning = !!timeDataRef.current;
        pauseTimer();
        setIsPaused(false);
        setIsKeyboardSetting(false);

        if (wasAutoSwitchedRef.current) resetAutoSwitchMode();

        cancelSettingAnimations();
        interactionStartRef.current = { time: Date.now(), angle: angleRef.current, wasRunning };
        setIsDragging(true);
        lastDragAngle.current = null;

        // Fire-and-forget: audio init must not block drag start
        void sounds.warmUp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pauseTimer, cancelSettingAnimations, resetAutoSwitchMode, stopCelebrationAndReset]);

    const handleInteractionMove = useCallback((e: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !containerRef.current) return;

      cancelSettingAnimations();

      if (isCelebrationInProgress(false) && !interruptedRef.current) return;

      if ('touches' in e && e.cancelable) e.preventDefault();

      interactionStartRef.current = null;

      const point = 'touches' in e ? e.touches[0] : e;
      if (!point) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = point.clientX - rect.left - rect.width / 2;
      const y = point.clientY - rect.top - rect.height / 2;

      let currentAngleFromCoords = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (currentAngleFromCoords < 0) currentAngleFromCoords += 360;

      const lastAngle = lastDragAngle.current;
      lastDragAngle.current = currentAngleFromCoords;
      if (lastAngle === null) return;

      let deltaAngle = currentAngleFromCoords - lastAngle;
      if (deltaAngle > 180) deltaAngle -= 360;
      else if (deltaAngle < -180) deltaAngle += 360;

      setAngle(prevAngle => Math.min(360, Math.max(0, prevAngle + deltaAngle)));

      // Snap to the unit step when the finger rests
      if (snapTimeoutRef.current) clearTimeout(snapTimeoutRef.current);
      snapTimeoutRef.current = setTimeout(() => {
        if (!isDraggingRef.current) return;
        animateAngle(snapAngle(angleRef.current, timeUnitRef.current), false);
      }, 800);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animateAngle, cancelSettingAnimations]);

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
            if (isCelebrationInProgress(false)) return;
            if (startInfo.wasRunning) {
                // Tap on a running dial: keep running
                setAngle(startInfo.angle);
                startTimerFromAngle(startInfo.angle);
                return;
            }
            animateAngle(0, true);
            return;
        }

        if (!interruptedRef.current) {
            animateAngle(snapAngle(angleRef.current, timeUnitRef.current), true);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [animateAngle, startTimerFromAngle]);

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        const unit = timeUnitRef.current;
        const stepAngle = msToAngle(SNAP_UNIT_MS[unit], unit);
        let target: number;

        switch (e.key) {
            case 'ArrowUp': case 'ArrowRight': target = angleRef.current + stepAngle; break;
            case 'ArrowDown': case 'ArrowLeft': target = angleRef.current - stepAngle; break;
            case 'PageUp': target = angleRef.current + 5 * stepAngle; break;
            case 'PageDown': target = angleRef.current - 5 * stepAngle; break;
            case 'Home': target = 0; break;
            case 'End': target = 360; break;
            case 'Enter': case ' ':
                e.preventDefault();
                if (keyboardStartTimeoutRef.current) {
                    // Start immediately instead of waiting for the debounce
                    clearTimeout(keyboardStartTimeoutRef.current);
                    keyboardStartTimeoutRef.current = null;
                    setIsKeyboardSetting(false);
                    startTimerFromAngle(angleRef.current);
                } else {
                    togglePause();
                }
                return;
            default: return;
        }

        e.preventDefault();
        if (isCelebrationInProgress()) {
            stopCelebrationAndReset();
            return;
        }

        pauseTimer();
        setIsPaused(false);
        cancelSettingAnimations();
        const newAngle = snapAngle(Math.min(360, Math.max(0, target)), unit);
        setAngle(newAngle);
        setIsKeyboardSetting(true);
        keyboardStartTimeoutRef.current = setTimeout(() => {
            keyboardStartTimeoutRef.current = null;
            setIsKeyboardSetting(false);
            if (newAngle > 0) startTimerFromAngle(newAngle);
            else cancelAllTimersAndAnimations();
        }, KEYBOARD_START_DELAY_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pauseTimer, cancelSettingAnimations, startTimerFromAngle, togglePause, stopCelebrationAndReset, cancelAllTimersAndAnimations]);

    const handleMuteToggle = async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (isCelebrationInProgress(false)) {
        stopCelebrationAndReset();
        return;
      }

      const newMutedState = !isMuted;
      setIsMuted(newMutedState);
      try {
        localStorage.setItem(MUTED_STORAGE_KEY, JSON.stringify(newMutedState));
      } catch {}

      if (!newMutedState) {
        const audioReady = await sounds.warmUp();
        if (audioReady && isNativePlatform()) {
            await requestNotificationPermissions();
            // Re-schedule notification if timer is running
            if (timeData) {
                const remaining = timeData.duration - (Date.now() - timeData.startTime);
                await scheduleTimerNotification(new Date(Date.now() + remaining), 'party_horn.mp3');
            }
        }
      } else {
        setIsAlarmPlaying(false);
        if (isNativePlatform()) await cancelAllNotifications();
      }
    };

    useEffect(() => {
        if (!isDragging) return;
        const moveHandler = (e: MouseEvent | TouchEvent) => handleInteractionMove(e);
        const endHandler = () => handleInteractionEnd();

        window.addEventListener('mousemove', moveHandler);
        window.addEventListener('touchmove', moveHandler, { passive: false });
        window.addEventListener('mouseup', endHandler);
        window.addEventListener('touchend', endHandler);
        window.addEventListener('touchcancel', endHandler);

        return () => {
          window.removeEventListener('mousemove', moveHandler);
          window.removeEventListener('touchmove', moveHandler);
          window.removeEventListener('mouseup', endHandler);
          window.removeEventListener('touchend', endHandler);
          window.removeEventListener('touchcancel', endHandler);
        };
    }, [isDragging, handleInteractionMove, handleInteractionEnd]);

    // Any click anywhere stops a running celebration
    useEffect(() => {
        if (!hasMounted) return;

        let interactionStarted = false;

        const handler = (e: MouseEvent | TouchEvent) => {
            if (!interactionStarted) return;
            interactionStarted = false;

            // If mousedown/touchstart already interrupted the celebration, don't double-trigger
            if (interruptedRef.current) return;
            if (!isCelebrationInProgress()) return;

            if (!titleRef.current?.contains(e.target as Node)) {
                if (e.cancelable) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                stopCelebrationAndReset(e);
            }
        };

        const startHandler = () => {
            if (isCelebrationInProgress()) interactionStarted = true;
        };

        document.body.addEventListener('mousedown', startHandler, { capture: true });
        document.body.addEventListener('touchstart', startHandler, { capture: true });
        document.body.addEventListener('click', handler, { capture: true });

        return () => {
            document.body.removeEventListener('mousedown', startHandler, { capture: true });
            document.body.removeEventListener('touchstart', startHandler, { capture: true });
            document.body.removeEventListener('click', handler, { capture: true });
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasMounted, stopCelebrationAndReset, titleRef]);

    // --- Countdown ---------------------------------------------------------------------

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
            const td = timeDataRef.current;
            if (isCancelled || !td) return;

            const remaining = td.duration - (Date.now() - td.startTime);
            const unit = timeUnitRef.current;

            // hr → auto-min: when remaining time fits within a min cycle
            if (unit === 'hr' && remaining <= MAX_TIME_MS.min && remaining > 0 && !isDraggingRef.current) {
                setIsTransitioningToAutoMin(true);
                return;
            }

            // min → auto-sec: last minute
            if (unit === 'min' && !isDetailViewRef.current && remaining <= MAX_TIME_MS.sec && remaining > 0 && !isDraggingRef.current) {
                setIsTransitioningToAutoSec(true);
                return;
            }

            if (remaining > 0 && remaining <= 5000 && (isDetailViewRef.current || unit === 'sec')) {
                const currentSecond = Math.ceil(remaining / 1000);
                if (lastTickSecond.current !== currentSecond) {
                    sounds.beep();
                    lastTickSecond.current = currentSecond;
                }
            }

            if (remaining <= 0) {
                setAngle(0);
                setRemainingSec(0);
                setTimeData(null);
                resetAutoSwitchMode();
                writeStorage(null);

                // App is in foreground (JS is running) — cancel the scheduled
                // notification so it doesn't fire on top of the in-app celebration.
                stopNativeTimer();

                if (!interruptedRef.current) {
                    // If the timer expired in the background, show the animation but skip the
                    // looping alarm so that unlocking / opening the app is enough to stop all audio.
                    const expiredInBg = timerExpiredInBgRef.current;
                    timerExpiredInBgRef.current = false;
                    celebrate(expiredInBg);
                }
                return;
            }

            // Both setters bail out when the value is unchanged, so most frames are free
            setAngle(Math.round(msToAngle(remaining, unit) * ANGLE_QUANTUM) / ANGLE_QUANTUM);
            setRemainingSec(Math.ceil(remaining / 1000));
            countdownFrameId.current = requestAnimationFrame(animate);
        };

        countdownFrameId.current = requestAnimationFrame(animate);

        return () => {
            isCancelled = true;
            if (countdownFrameId.current) cancelAnimationFrame(countdownFrameId.current);
        };
    }, [timeData, resetAutoSwitchMode, celebrate, isTransitioningToAutoSec, isTransitioningToAutoMin]);

    // Transition into an auto mode: sweep the rainbow to 0, then show the remaining time
    // on the finer scale (min → sec or hr → min).
    useEffect(() => {
        const target: TimeUnit | null = isTransitioningToAutoSec ? 'sec' : isTransitioningToAutoMin ? 'min' : null;
        if (!target) return;

        if (countdownFrameId.current) {
            cancelAnimationFrame(countdownFrameId.current);
            countdownFrameId.current = null;
        }

        const DURATION = 500;
        let animationStartTime: number | null = null;
        const startAngle = angleRef.current;

        const transitionAnimate = (currentTime: number) => {
            if (animationStartTime === null) animationStartTime = currentTime;
            const progress = Math.min((currentTime - animationStartTime) / DURATION, 1);
            setAngle(startAngle * Math.pow(1 - progress, 3));

            if (progress < 1) {
                countdownFrameId.current = requestAnimationFrame(transitionAnimate);
                return;
            }

            const td = timeDataRef.current;
            if (td) {
                const remaining = td.duration - (Date.now() - td.startTime);
                if (target === 'sec') {
                    wasAutoSwitchedRef.current = true;
                    setTimeUnit('sec');
                    setIsDetailView(true);
                } else {
                    wasAutoSwitchedToMinRef.current = true;
                    setTimeUnit('min');
                    setIsDetailView(false);
                    // Update Android notification to use min-mode reference cycle
                    if (isAndroid()) updateTimerNotification(remaining, MAX_TIME_MS.min);
                }
                setAngle(Math.max(0, msToAngle(remaining, target)));
            }
            if (target === 'sec') setIsTransitioningToAutoSec(false);
            else setIsTransitioningToAutoMin(false);
        };

        countdownFrameId.current = requestAnimationFrame(transitionAnimate);

        return () => {
            if (countdownFrameId.current) {
                cancelAnimationFrame(countdownFrameId.current);
                countdownFrameId.current = null;
            }
        };
    }, [isTransitioningToAutoSec, isTransitioningToAutoMin]);

    useEffect(() => () => {
        if (interruptTimeoutRef.current) clearTimeout(interruptTimeoutRef.current);
        if (keyboardStartTimeoutRef.current) clearTimeout(keyboardStartTimeoutRef.current);
    }, []);

    // --- Derived display ---------------------------------------------------------------

    const isRunning = timeData !== null;
    const showClock = (isRunning || isPaused) && !isDragging && !isKeyboardSetting;
    const isSetting = !showClock && angle > 0;
    const hideRainbow = animationState === 'bursting' || isCelebrating;
    const setMs = angleToMs(snapAngle(angle, timeUnit), timeUnit);
    const setValue = formatSetValue(setMs, timeUnit);

    // Nothing set, running, paused or celebrating
    const isHintIdle = !isRunning && !isPaused && !isDragging && !isKeyboardSetting && angle === 0
        && !hideRainbow && !isAlarmPlaying && !isRaining;
    const hint: DialHint = isHintIdle && hintPhase !== 'done' ? hintPhase : 'none';

    useEffect(() => {
        if (!hasMounted) return;
        try {
            if (!localStorage.getItem(HINT_SEEN_KEY)) setHintPhase('ghost');
        } catch {}
    }, [hasMounted]);

    useEffect(() => {
        if (hintPhase === 'done') return;
        if (!isHintIdle) {
            // First use of the dial ends the hint for good
            setHintPhase('done');
            try { localStorage.setItem(HINT_SEEN_KEY, '1'); } catch {}
            return;
        }
        const timeout = setTimeout(
            () => setHintPhase(hintPhase === 'ghost' ? 'wave' : 'done'),
            hintPhase === 'ghost' ? HINT_GHOST_MS : HINT_WAVE_MS,
        );
        return () => clearTimeout(timeout);
    }, [hintPhase, isHintIdle]);

    const hub: HubContent = useMemo(() => {
        if (hint !== 'none') return { kind: 'hint', mode: hint };
        if (showClock) return { kind: 'clock', value: formatClock(remainingSec * 1000), paused: isPaused };
        if (isSetting) return { kind: 'set', value: setValue.value, unit: setValue.unit };
        return { kind: 'empty' };
    }, [hint, showClock, isSetting, isPaused, remainingSec, setValue.value, setValue.unit]);

    const endTimeLabel = useMemo(() => {
        if (!timeData) return '';
        return new Date(timeData.startTime + timeData.duration).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }, [timeData]);

    const caption = hideRainbow ? ''
        : isDragging ? 'release to start'
        : isKeyboardSetting ? 'press Enter to start'
        : isPaused ? 'paused – tap the center to resume'
        : isRunning ? `ends at ${endTimeLabel}`
        : isHintIdle ? IDLE_CAPTION
        : '';

    const ariaMax = timeUnit === 'hr' ? 12 : 60;
    const ariaUnit = timeUnit === 'hr' ? 'hours' : timeUnit === 'min' ? 'minutes' : 'seconds';
    const ariaValueText = `${formatSpoken(showClock ? remainingSec * 1000 : setMs)}${isPaused ? ', paused' : isRunning ? ' remaining' : ''}`;

    const muteButton = (
        <button
            type="button"
            className={iconButtonClass}
            style={{ color: 'var(--control-icon)' }}
            onClick={handleMuteToggle}
            aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
            {isMuted ? <VolumeX className="h-[22px] w-[22px]" /> : <Volume2 className="h-[22px] w-[22px]" />}
        </button>
    );

    const unitSwitch = (
        <TimeUnitSwitch
            mode={displayUnitModeForSwitch}
            sliderMode={sliderModeForSwitch}
            onUnitChange={handleUnitChange}
        />
    );

  return (
    <>
        {/* Dial wrapper: always fixed at viewport center so the dial center never jumps during transitions */}
        <div className={cn(
            "fixed inset-0 z-40 flex items-center justify-center",
            !isFullscreen && "pointer-events-none"
        )}>
                <div
                    className={cn(
                        "absolute inset-0 bg-background/90 backdrop-blur-sm transition-opacity duration-400 ease-in-out",
                        isFullscreen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    )}
                    onClick={handleBackdropClick}
                />
                <div
                    ref={containerRef}
                    data-dial-container="true"
                    role="slider"
                    tabIndex={0}
                    aria-label={`Timer (${ariaUnit})`}
                    aria-valuemin={0}
                    aria-valuemax={ariaMax}
                    aria-valuenow={Math.round((angle / 360) * ariaMax * 10) / 10}
                    aria-valuetext={ariaValueText}
                    className={cn(
                        "relative aspect-square touch-none select-none rounded-full transition-[width] duration-400 ease-in-out pointer-events-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/40",
                        isFullscreen ? "w-[80vmin]" : "w-[320px] sm:w-[350px] md:w-[390px] lg:w-[430px] xl:w-[460px]"
                    )}
                    onMouseDown={handleInteractionStart}
                    onTouchStart={handleInteractionStart}
                    onKeyDown={handleKeyDown}
                >
                    {hasMounted && (
                        <Dial
                            angle={angle}
                            secModeProgress={secModeProgress}
                            hrModeProgress={hrModeProgress}
                            showElapsed={isDetailView && wasAutoSwitchedRef.current}
                            hideRainbow={hideRainbow}
                            hint={hint}
                            hoverHandle={isHintIdle}
                            isDragging={isDragging}
                            particles={explosionParticles}
                            hub={hub}
                            hubInteractive={isRunning || isPaused}
                            onHubActivate={togglePause}
                            onQuickSet={handleQuickSet}
                            svgRef={svgRef}
                        />
                    )}
                    <p
                        aria-hidden="true"
                        className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap text-[13px] text-muted-foreground transition-opacity duration-200"
                        style={{ opacity: caption ? 1 : 0 }}
                    >
                        {caption || ' '}
                    </p>
                </div>
        </div>

        {hasMounted && (
            isForcedFullscreen ? (
                /* Forced fullscreen (low height): sound bottom-left, unit switch bottom-right */
                <>
                    <div className={cn(pillClass, "fixed z-50 bottom-4 left-4")} style={{ background: 'var(--control-bg)' }}>
                        {muteButton}
                    </div>
                    <div className={cn(pillClass, "fixed z-50 bottom-4 right-4")} style={{ background: 'var(--control-bg)' }}>
                        {unitSwitch}
                    </div>
                </>
            ) : (
                <div className={cn(pillClass, "fixed z-50 bottom-14 left-1/2 -translate-x-1/2")} style={{ background: 'var(--control-bg)' }}>
                    {muteButton}
                    {unitSwitch}
                    <button
                        type="button"
                        className={iconButtonClass}
                        style={{ color: 'var(--control-icon)' }}
                        onClick={handleFullscreenToggle}
                        aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? <Minimize className="h-[22px] w-[22px]" /> : <Maximize className="h-[22px] w-[22px]" />}
                    </button>
                </div>
            )
        )}
    </>
  );
}
