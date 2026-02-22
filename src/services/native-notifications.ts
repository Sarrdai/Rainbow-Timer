import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

export interface NotificationOptions {
  title: string;
  body: string;
  sound?: string;
  id?: number;
  schedule?: {
    at: Date;
  };
}

/**
 * Request notification permissions from the user
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to web Notification API for PWA
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }

  try {
    const permStatus = await LocalNotifications.checkPermissions();

    if (permStatus.display === 'granted') {
      return true;
    }

    const requestResult = await LocalNotifications.requestPermissions();
    return requestResult.display === 'granted';
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Check if notification permissions are granted
 */
export async function checkNotificationPermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // Fallback to web Notification API
    if ('Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  }

  try {
    const permStatus = await LocalNotifications.checkPermissions();
    return permStatus.display === 'granted';
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return false;
  }
}

/**
 * Schedule a timer notification
 */
export async function scheduleTimerNotification(
  endTime: Date,
  customSound: string = 'party_horn.mp3'
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Not on native platform, using web notifications');
    return;
  }

  try {
    // Cancel any existing notifications first
    await cancelAllNotifications();

    const notification = {
      title: 'Timer finished!',
      body: 'Your timer has ended',
      id: 1,
      schedule: {
        at: endTime,
      },
      sound: customSound,
      attachments: undefined,
      actionTypeId: '',
      extra: null,
    };

    // iOS-specific options
    if (Capacitor.getPlatform() === 'ios') {
      await LocalNotifications.schedule({
        notifications: [
          {
            ...notification,
            sound: customSound,
            // @ts-ignore - iOS-specific properties
            interruptionLevel: 'timeSensitive',
            relevanceScore: 1.0,
          },
        ],
      });
    }
    // Android-specific options
    else if (Capacitor.getPlatform() === 'android') {
      await LocalNotifications.schedule({
        notifications: [
          {
            ...notification,
            sound: customSound,
            // @ts-ignore - Android-specific properties
            channelId: 'timer-alerts',
            importance: 5, // IMPORTANCE_HIGH
            visibility: 1, // VISIBILITY_PUBLIC
          },
        ],
      });
    }

    console.log('Timer notification scheduled for:', endTime);
  } catch (error) {
    console.error('Error scheduling notification:', error);
    throw error;
  }
}

/**
 * Cancel all scheduled notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    console.log('All notifications canceled');
  } catch (error) {
    console.error('Error canceling notifications:', error);
  }
}

/**
 * Setup notification channels for Android
 */
export async function setupNotificationChannels(): Promise<void> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return;
  }

  try {
    // Create a high-priority alarm channel
    await LocalNotifications.createChannel({
      id: 'timer-alerts',
      name: 'Timer Alerts',
      description: 'Notifications for timer alerts',
      importance: 5, // IMPORTANCE_HIGH
      sound: 'party_horn.mp3',
      visibility: 1, // VISIBILITY_PUBLIC
      vibration: true,
    });

    console.log('Notification channel created');
  } catch (error) {
    console.error('Error creating notification channel:', error);
  }
}
