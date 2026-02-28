package com.rainbowtimer.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.graphics.drawable.IconCompat;

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

    /**
     * Reference cycle duration for all progress indicators (icon + notification bar).
     *
     * This value defines what "one full rotation" means, matching the rainbow in the app:
     *   - 60s mode:   maxTimeMs = 60_000        (1 step = 1 second)
     *   - 60min mode: maxTimeMs = 3_600_000     (1 step = 1 minute)
     *   - Future 12h: maxTimeMs = 43_200_000    (1 step = 12 minutes)
     *
     * All progress (icon sweep, notification bar) is calculated as:
     *   step60 = clamp(remainingMs / maxTimeMs, 0, 1) × 60
     *
     * To add a new mode: pass the new maxTimeMs value from JS — no other Java changes needed.
     */
    private long maxTimeMs;

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
                // maxTimeMs passed from JS based on current mode (sec/min/future 12h).
                // Default: 60min, consistent with the app's default mode.
                maxTimeMs = intent.getLongExtra("maxTimeMs", 3_600_000L);
                Log.d(TAG, "Starting timer: endTime=" + endTime
                    + " total=" + totalDurationMs + " maxTimeMs=" + maxTimeMs);
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
        int step60 = computeStep60(initialRemaining);

        Notification notification = buildNotification(pendingIntent, step60);

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

    /**
     * Compute the 0–60 progress step for the current mode cycle.
     *
     * Maps remaining time onto the reference cycle:
     *   step60 = round( clamp(remainingMs / maxTimeMs, 0, 1) × 60 )
     *
     * step60 = 60 → full arcs / full progress bar (timer just started, still within cycle)
     * step60 =  0 → no arcs  / empty progress bar (timer expired or at cycle boundary)
     *
     * Timers longer than one cycle (e.g. 90 min in 60-min mode) clamp to step60=60 at start
     * and behave normally once remaining drops below maxTimeMs — same as the rainbow in-app.
     *
     * Future 12h mode: pass maxTimeMs = 43_200_000 from JS; this method needs no change.
     */
    private int computeStep60(long remainingMs) {
        if (maxTimeMs <= 0) return 0;
        double fraction = (double) remainingMs / (double) maxTimeMs;
        fraction = Math.min(1.0, Math.max(0.0, fraction));
        return (int) Math.round(fraction * 60.0);
    }

    private Notification buildNotification(PendingIntent pendingIntent, int step60) {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Rainbow Timer")
            // Dynamic icon: bitmap rendered to match the current step60 (see createProgressIcon).
            .setSmallIcon(IconCompat.createWithBitmap(createProgressIcon(step60)))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            // CATEGORY_STOPWATCH tells Android this is a timer — helps with display priority.
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            // Native system chronometer: counts down to endTime automatically.
            .setUsesChronometer(true)
            .setChronometerCountDown(true)
            .setWhen(endTime)
            .setShowWhen(true)
            // Progress bar: max=60, value=(60 - step60) = elapsed fraction of the mode cycle.
            // Bar grows from left (empty at start) to right (full at expiry).
            // Remaining time is shown as the unfilled right portion.
            // Future 12h mode: this line needs no change; only computeStep60() differs.
            .setProgress(60, 60 - step60, false)
            .build();
    }

    /**
     * Render the notification status-bar icon as a Bitmap for the given progress step.
     *
     * Layout mirrors ic_notification_rainbow.xml (36×36 viewport, radii 16/10/4):
     *
     *   Outer arc  (r≈42px): sweeps 0°–270° clockwise from 12 o'clock.
     *   Middle arc (r≈26px): same sweep as outer arc.
     *   Inner dot  (r≈10px): always fully filled — visible even at step60=0.
     *
     * The inner dot replaces the original 270° inner arc so the icon has a permanent
     * anchor point. This ensures the status bar never shows a blank icon.
     *
     * Direction matches the app rainbow: step60=60 → full arcs, step60=0 → dot only.
     * Android renders the bitmap monochromatic (white tint) in the status bar.
     *
     * Future 12h mode: no changes needed here; sweep is driven purely by step60.
     */
    private static Bitmap createProgressIcon(int step60) {
        final int   SIZE      = 96;        // px — system scales to target dp size
        final float CENTER    = SIZE / 2f;

        // Geometry proportional to ic_notification_rainbow.xml (scale factor: 96/36 ≈ 2.667)
        final float STROKE_W  = 8f;        // ≈ strokeWidth=3 in 36vp  × 2.667
        final float OUTER_R   = 42f;       // ≈ r=16 in 36vp            × 2.667
        final float MIDDLE_R  = 26f;       // ≈ r=10 in 36vp            × 2.667
        final float INNER_R   = 10f;       // inner anchor dot (replaces r=4 arc)

        // Arc geometry: full circle at maximum fill.
        // START_ANGLE = -90° → 12 o'clock (top); sweeps clockwise.
        // MAX_SWEEP   = 360° → complete circle at step60=60 (full cycle).
        // The static icon used 270° (3/4), but for a progress indicator a full circle
        // is more intuitive: 60min or 60s = one complete ring.
        final float START_ANGLE = -90f;
        final float MAX_SWEEP   = 360f;

        // Sweep proportional to step60: 0° when empty, 270° when full.
        float sweep = MAX_SWEEP * step60 / 60f;

        Bitmap bitmap = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);

        Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        // White on transparent — status bar uses alpha channel for monochrome tinting.
        paint.setColor(Color.WHITE);
        paint.setStrokeWidth(STROKE_W);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStyle(Paint.Style.STROKE);

        RectF outerRect  = new RectF(CENTER - OUTER_R,  CENTER - OUTER_R,
                                     CENTER + OUTER_R,  CENTER + OUTER_R);
        RectF middleRect = new RectF(CENTER - MIDDLE_R, CENTER - MIDDLE_R,
                                     CENTER + MIDDLE_R, CENTER + MIDDLE_R);

        // Outer arc: primary progress ring.
        canvas.drawArc(outerRect, START_ANGLE, sweep, false, paint);

        // Middle arc: secondary progress ring, same fill level.
        canvas.drawArc(middleRect, START_ANGLE, sweep, false, paint);

        // Inner dot: permanent anchor — always visible regardless of progress.
        paint.setStyle(Paint.Style.FILL);
        canvas.drawCircle(CENTER, CENTER, INNER_R, paint);

        return bitmap;
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

        int step60 = computeStep60(remainingMs);

        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this, 0, notificationIntent,
            PendingIntent.FLAG_IMMUTABLE
        );

        NotificationManager notificationManager =
            (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
        notificationManager.notify(NOTIFICATION_ID, buildNotification(pendingIntent, step60));
    }

    private void stopForegroundService() {
        if (updateRunnable != null) {
            handler.removeCallbacks(updateRunnable);
        }
        // stopForeground(boolean) is deprecated since API 33 — use int constant instead.
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
            // Disable sound and vibration — we just want a silent persistent notification.
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
