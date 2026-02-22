import { Capacitor, registerPlugin } from '@capacitor/core';

export interface BatteryOptimizationPlugin {
  /**
   * Check if battery optimization is disabled for the app
   */
  isBatteryOptimizationDisabled(): Promise<{ disabled: boolean }>;

  /**
   * Request to disable battery optimization
   */
  requestDisableBatteryOptimization(): Promise<void>;
}

// Register the plugin
const BatteryOptimization = registerPlugin<BatteryOptimizationPlugin>('BatteryOptimization', {
  web: () => {
    return {
      isBatteryOptimizationDisabled: async () => ({ disabled: true }),
      requestDisableBatteryOptimization: async () => {
        console.log('[Web] Battery optimization not applicable');
      },
    };
  },
});

const BATTERY_DIALOG_SHOWN_KEY = 'rainbow_timer_battery_dialog_shown';

/**
 * Check if we should show the battery optimization dialog
 */
export function shouldShowBatteryDialog(): boolean {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }

  try {
    const shown = localStorage.getItem(BATTERY_DIALOG_SHOWN_KEY);
    return shown !== 'true';
  } catch {
    return true;
  }
}

/**
 * Mark that the battery dialog has been shown
 */
export function markBatteryDialogShown(): void {
  try {
    localStorage.setItem(BATTERY_DIALOG_SHOWN_KEY, 'true');
  } catch (error) {
    console.error('Failed to mark battery dialog as shown:', error);
  }
}

/**
 * Check if battery optimization is disabled
 */
export async function checkBatteryOptimization(): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return true;
  }

  try {
    const result = await BatteryOptimization.isBatteryOptimizationDisabled();
    return result.disabled;
  } catch (error) {
    console.error('Error checking battery optimization:', error);
    return false;
  }
}

/**
 * Request to disable battery optimization
 */
export async function requestBatteryOptimizationExemption(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    await BatteryOptimization.requestDisableBatteryOptimization();
    markBatteryDialogShown();
  } catch (error) {
    console.error('Error requesting battery optimization exemption:', error);
  }
}
