package com.rainbowtimer.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "BatteryOptimization")
public class BatteryOptimizationPlugin extends Plugin {

    @PluginMethod
    public void isBatteryOptimizationDisabled(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager powerManager = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            String packageName = getContext().getPackageName();
            boolean isIgnoringBatteryOptimizations = powerManager.isIgnoringBatteryOptimizations(packageName);

            JSObject result = new JSObject();
            result.put("disabled", isIgnoringBatteryOptimizations);
            call.resolve(result);
        } else {
            // Battery optimization doesn't exist before Android M
            JSObject result = new JSObject();
            result.put("disabled", true);
            call.resolve(result);
        }
    }

    @PluginMethod
    public void requestDisableBatteryOptimization(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
                getActivity().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Failed to open battery optimization settings", e);
            }
        } else {
            // Battery optimization doesn't exist before Android M
            call.resolve();
        }
    }
}
