package com.rainbowtimer.app;

import android.content.Intent;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "ForegroundService")
public class ForegroundServicePlugin extends Plugin {

    @PluginMethod
    public void startForegroundService(PluginCall call) {
        Long endTime = call.getLong("endTime");
        if (endTime == null) {
            call.reject("Must provide endTime");
            return;
        }

        Intent serviceIntent = new Intent(getContext(), TimerForegroundService.class);
        serviceIntent.setAction("START");
        serviceIntent.putExtra("endTime", endTime);

        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
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
