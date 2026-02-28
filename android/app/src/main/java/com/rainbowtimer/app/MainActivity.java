package com.rainbowtimer.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugins MUST be registered before super.onCreate() in Capacitor 6+
        // Registering after causes the JS bridge to use the web fallback instead of native.
        registerPlugin(ForegroundServicePlugin.class);
        registerPlugin(BatteryOptimizationPlugin.class);

        super.onCreate(savedInstanceState);
    }
}
