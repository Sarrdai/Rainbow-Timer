import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ForegroundServicePlugin {
  /**
   * Start the foreground service with timer information
   */
  startForegroundService(options: { endTime: number }): Promise<void>;

  /**
   * Update the foreground notification with remaining time
   */
  updateForegroundNotification(options: { remainingMs: number }): Promise<void>;

  /**
   * Stop the foreground service
   */
  stopForegroundService(): Promise<void>;
}

// Register the plugin (will be undefined if not implemented)
const ForegroundService = registerPlugin<ForegroundServicePlugin>('ForegroundService', {
  web: () => {
    // Web fallback - no-op
    return {
      startForegroundService: async () => {
        console.log('[Web] Foreground service not available');
      },
      updateForegroundNotification: async () => {
        console.log('[Web] Foreground service not available');
      },
      stopForegroundService: async () => {
        console.log('[Web] Foreground service not available');
      },
    };
  },
});

/**
 * Start the foreground service for Android timer tracking
 */
export async function startTimerForegroundService(endTime: number): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    await ForegroundService.startForegroundService({ endTime });
    console.log('Foreground service started');
  } catch (error) {
    console.error('Error starting foreground service:', error);
  }
}

/**
 * Update the foreground notification with current remaining time
 */
export async function updateTimerNotification(remainingMs: number): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    await ForegroundService.updateForegroundNotification({ remainingMs });
  } catch (error) {
    console.error('Error updating foreground notification:', error);
  }
}

/**
 * Stop the foreground service
 */
export async function stopTimerForegroundService(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    await ForegroundService.stopForegroundService();
    console.log('Foreground service stopped');
  } catch (error) {
    console.error('Error stopping foreground service:', error);
  }
}
