import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

// Web wake lock sentinel, kept so it can be released when the timer stops
let webWakeLock: WakeLockSentinel | null = null;

/**
 * Keep the device awake while timer is running
 */
export async function keepAwake(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to Web Wake Lock API
    if ('wakeLock' in navigator) {
      try {
        if (webWakeLock && !webWakeLock.released) return;
        webWakeLock = await navigator.wakeLock.request('screen');
      } catch (error) {
        console.error('Error activating web wake lock:', error);
      }
    }
    return;
  }

  try {
    await KeepAwake.keepAwake();
    console.log('Native keep awake activated');
  } catch (error) {
    console.error('Error activating keep awake:', error);
  }
}

/**
 * Allow the device to sleep
 */
export async function allowSleep(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    try {
      await webWakeLock?.release();
    } catch (error) {
      console.error('Error releasing web wake lock:', error);
    }
    webWakeLock = null;
    return;
  }

  try {
    await KeepAwake.allowSleep();
    console.log('Native keep awake deactivated');
  } catch (error) {
    console.error('Error deactivating keep awake:', error);
  }
}
