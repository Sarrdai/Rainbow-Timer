"use client";

import { useCallback, useEffect, useRef } from 'react';

const ALARM_SRC = '/party-horn.mp3';
const BANG_DURATION_S = 0.3;

/**
 * Web Audio for the timer: bang (noise burst), countdown beep and the looping alarm.
 * `isMuted` is read through a ref so the returned callbacks stay stable.
 */
export function useTimerAudio(isMuted: boolean, isAlarmPlaying: boolean) {
    const audioContextRef = useRef<AudioContext | null>(null);
    const alarmAudioRef = useRef<HTMLAudioElement | null>(null);
    const bangBufferRef = useRef<AudioBuffer | null>(null);
    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;

    const getAlarm = () => {
        if (!alarmAudioRef.current) {
            alarmAudioRef.current = new Audio(ALARM_SRC);
            alarmAudioRef.current.loop = true;
            alarmAudioRef.current.preload = 'auto';
        }
        return alarmAudioRef.current;
    };

    const initializeAudio = useCallback(async () => {
        if (typeof window === 'undefined') return false;
        if (!audioContextRef.current) {
            try {
                const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
                audioContextRef.current = new Ctx();
            } catch { return false; }
        }
        if (audioContextRef.current.state === 'suspended') {
            try { await audioContextRef.current.resume(); } catch { return false; }
        }
        getAlarm();
        return audioContextRef.current.state === 'running';
    }, []);

    const playBang = useCallback(async () => {
        const audioReady = await initializeAudio();
        const audioCtx = audioContextRef.current;
        if (isMutedRef.current || !audioReady || !audioCtx) return;

        // The noise buffer is generated once and reused
        if (!bangBufferRef.current) {
            const size = Math.floor(audioCtx.sampleRate * BANG_DURATION_S);
            const buffer = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
            bangBufferRef.current = buffer;
        }

        const source = audioCtx.createBufferSource();
        source.buffer = bangBufferRef.current;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + BANG_DURATION_S);
        source.connect(gain);
        gain.connect(audioCtx.destination);
        source.start();
    }, [initializeAudio]);

    const playBeep = useCallback(async () => {
        if (isMutedRef.current) return;
        const audioReady = await initializeAudio();
        const audioCtx = audioContextRef.current;
        if (!audioReady || !audioCtx) return;

        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const t = audioCtx.currentTime;
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, t); // A5
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        oscillator.connect(gain);
        gain.connect(audioCtx.destination);
        oscillator.start(t);
        oscillator.stop(t + 0.15);
    }, [initializeAudio]);

    useEffect(() => {
        if (isAlarmPlaying) {
            if (!isMuted) getAlarm().play().catch(() => {});
        } else if (alarmAudioRef.current) {
            alarmAudioRef.current.pause();
            alarmAudioRef.current.currentTime = 0;
        }
    }, [isAlarmPlaying, isMuted]);

    useEffect(() => () => {
        audioContextRef.current?.close();
        if (alarmAudioRef.current) {
            alarmAudioRef.current.pause();
            alarmAudioRef.current = null;
        }
    }, []);

    return { initializeAudio, playBang, playBeep };
}
