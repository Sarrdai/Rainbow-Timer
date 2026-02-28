package com.rainbowtimer.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;

public class TimerForegroundService extends Service {

    private static final String TAG = "RBT_FGS_Service";
    // New channel ID — forces creation of channel with correct importance.
    // IMPORTANCE_LOW (old channel) was hiding the notification on Android 16.
    private static final String CHANNEL_ID = "TimerChannel";
    private static final int NOTIFICATION_ID = 1001;

    private Handler handler;
    private Runnable updateRunnable;
    private long endTime;
    private long totalDurationMs;

    @Override
    public void onCreate() {
        Log.d(TAG, "onCreate called");
        super.onCreate();
        createNotificationChannel();
        handler = new Handler(Looper.getMainLooper());
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand called, intent=" + intent);
        if (intent != null) {
            String action = intent.getAction();
            Log.d(TAG, "action=" + action);

            if ("START".equals(action)) {
                endTime = intent.getLongExtra("endTime", 0);
                totalDurationMs = intent.getLongExtra("totalDurationMs", 0);
                Log.d(TAG, "Starting timer: endTime=" + endTime + " total=" + totalDurationMs);
                startForegroundService();
            } else if ("UPDATE".equals(action)) {
                long remainingMs = intent.getLongExtra("remainingMs", 0);
                updateNotification(remainingMs);
            } else if ("STOP".equals(action)) {
                stopForegroundService();
            }
        }

        return START_STICKY;
    }

    private void startForegroundService() {
        Log.d(TAG, "startForegroundService: creating notification");
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        );

        long initialRemaining = endTime - System.currentTimeMillis();
        int totalSec = (totalDurationMs > 0) ? (int) (totalDurationMs / 1000) : 1;
        int remainingSec = (int) Math.max(0, initialRemaining / 1000);
        int elapsedSec = Math.max(0, totalSec - remainingSec);

        // Use setUsesChronometer + setChronometerCountDown + setWhen(endTime) so Android
        // handles the countdown display natively — no per-second notify() calls needed
        // for the time text. This works reliably on Android 16 (targetSdk 36).
        Notification notification = buildNotification(pendingIntent, totalSec, elapsedSec);

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                Log.d(TAG, "Calling startForeground with SPECIAL_USE type (API >= 34)");
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                Log.d(TAG, "Calling startForeground (API < 34)");
                startForeground(NOTIFICATION_ID, notification);
            }
            Log.d(TAG, "startForeground succeeded!");
        } catch (Exception e) {
            Log.e(TAG, "startForeground FAILED: " + e.getMessage(), e);
        }

        startUpdateLoop();
    }

    private Notification buildNotification(PendingIntent pendingIntent, int totalSec, int elapsedSec) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Rainbow Timer")
            .setSmallIcon(R.drawable.ic_notification_rainbow)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            // CATEGORY_STOPWATCH tells Android this is a timer — helps with display priority
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            // Native system chronometer: counts down to endTime automatically
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(endTime)
            .setShowWhen(true)
            .setProgress(totalSec, elapsedSec, false)
            .build();
    }

    private void startUpdateLoop() {
        updateRunnable = new Runnable() {
            @Override
            public void run() {
                long remaining = endTime - System.currentTimeMillis();
                if (remaining > 0) {
                    updateNotification(remaining);
                    handler.postDelayed(this, 1000);
                } else {
                    stopForegroundService();
                }
            }
        };
        handler.post(updateRunnable);
    }

    private void updateNotification(long remainingMs) {
        if (remainingMs <= 0) {
            return;
        }

        int totalSec = (totalDurationMs > 0) ? (int) (totalDurationMs / 1000) : 1;
        int remainingSec = (int) (remainingMs / 1000);
        int elapsedSec = Math.max(0, totalSec - remainingSec);

        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        );

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notificationManager.notify(NOTIFICATION_ID, buildNotification(pendingIntent, totalSec, elapsedSec));
    }

    private void stopForegroundService() {
        if (updateRunnable != null) {
            handler.removeCallbacks(updateRunnable);
        }
        // stopForeground(boolean) is deprecated since API 33 — use int constant instead
        stopForeground(Service.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                CHANNEL_ID,
                "Timer",
                // IMPORTANCE_DEFAULT ensures the notification is visible in the shade.
                // IMPORTANCE_LOW was causing Android 16 to hide/minimize the notification.
                NotificationManager.IMPORTANCE_DEFAULT
            );
            serviceChannel.setDescription("Zeigt verbleibende Timer-Zeit an");
            // Disable sound and vibration — we just want a silent persistent notification
            serviceChannel.setSound(null, null);
            serviceChannel.enableVibration(false);
            serviceChannel.setShowBadge(false);

            NotificationManager manager = getSystemService(NotificationManager.class);
            manager.createNotificationChannel(serviceChannel);
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        if (updateRunnable != null) {
            handler.removeCallbacks(updateRunnable);
        }
    }
}
