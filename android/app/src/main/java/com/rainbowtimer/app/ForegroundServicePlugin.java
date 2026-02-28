package com.rainbowtimer.app;

import android.content.Intent;
import android.util.Log;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ForegroundService")
public class ForegroundServicePlugin extends Plugin {

    private static final String TAG = "RBT_FGS_Plugin";

    @Override
    public void load() {
        Log.d(TAG, "ForegroundServicePlugin.load() called — plugin is registered and active");
    }

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        Log.d(TAG, "startForegroundService called");
        Long endTime = call.getLong("endTime");
        if (endTime == null) {
            Log.e(TAG, "endTime is null — rejecting");
            call.reject("Must provide endTime");
            return;
        }
        // Use getDouble because JS Duration values are floats; round to long.
        long totalDurationMs = Math.round(call.getDouble("totalDurationMs", 0.0));
        // maxTimeMs: reference cycle for all progress indicators (icon + notification bar).
        // Matches the rainbow reference: 60s=60_000, 60min=3_600_000, future 12h=43_200_000.
        // Default: 60min, consistent with the app's default mode.
        long maxTimeMs = Math.round(call.getDouble("maxTimeMs", 3_600_000.0));
        Log.d(TAG, "endTime=" + endTime + " totalDurationMs=" + totalDurationMs + " maxTimeMs=" + maxTimeMs);

        Intent serviceIntent = new Intent(getContext(), TimerForegroundService.class);
        serviceIntent.setAction("START");
        serviceIntent.putExtra("endTime", (long) endTime);
        serviceIntent.putExtra("totalDurationMs", (long) totalDurationMs);
        serviceIntent.putExtra("maxTimeMs", maxTimeMs);

        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                Log.d(TAG, "calling startForegroundService (API >= O)");
                getContext().startForegroundService(serviceIntent);
            } else {
                Log.d(TAG, "calling startService (API < O)");
                getContext().startService(serviceIntent);
            }
            Log.d(TAG, "startForegroundService call succeeded");
        } catch (Exception e) {
            Log.e(TAG, "startForegroundService EXCEPTION: " + e.getMessage(), e);
            call.reject("Service start failed: " + e.getMessage());
            return;
        }

        call.resolve();
    }

    @PluginMethod
    public void updateForegroundNotification(PluginCall call) {
        Long remainingMs = call.getLong("remainingMs");
        if (remainingMs == null) {
            call.reject("Must provide remainingMs");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), TimerForegroundService.class);
        serviceIntent.setAction("UPDATE");
        serviceIntent.putExtra("remainingMs", remainingMs);

        // Optional maxTimeMs — forward if provided (used when mode changes during background,
        // e.g. auto-switch from hr → min resets the reference cycle to 3_600_000).
        Double maxTimeMsRaw = call.getDouble("maxTimeMs", -1.0);
        if (maxTimeMsRaw != null && maxTimeMsRaw > 0) {
            serviceIntent.putExtra("maxTimeMs", Math.round(maxTimeMsRaw));
        }

        getContext().startService(serviceIntent);

        call.resolve();
    }

    @PluginMethod
    public void stopForegroundService(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), TimerForegroundService.class);
        serviceIntent.setAction("STOP");

        getContext().startService(serviceIntent);

        call.resolve();
    }
}
