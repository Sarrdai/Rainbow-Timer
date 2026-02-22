import { KeepAwake } from '@capacitor-community/keep-awake';
import { Capacitor } from '@capacitor/core';

/**
 * Keep the device awake while timer is running
 */
export async function keepAwake(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to Web Wake Lock API
    if ('wakeLock' in navigator) {
      try {
        // @ts-ignore - wakeLock is not in TypeScript types yet
        await navigator.wakeLock.request('screen');
        console.log('Web wake lock activated');
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
    // Web wake lock is automatically released when page is hidden
    console.log('Web wake lock will be released automatically');
    return;
  }

  try {
    await KeepAwake.allowSleep();
    console.log('Native keep awake deactivated');
  } catch (error) {
    console.error('Error deactivating keep awake:', error);
  }
}
