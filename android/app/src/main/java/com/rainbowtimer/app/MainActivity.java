package com.rainbowtimer.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Register custom plugins
        registerPlugin(ForegroundServicePlugin.class);
        registerPlugin(BatteryOptimizationPlugin.class);
    }
}
