# Development Guide

## Project Structure

```
Rainbow-Timer/
├── src/
│   ├── app/              # Next.js app directory
│   ├── components/       # React components
│   │   ├── rainbow-timer.tsx  # Main timer component
│   │   ├── confetti.tsx       # Celebration effects
│   │   └── ui/                # UI components
│   └── services/         # Native platform services
│       ├── native-notifications.ts   # Notification handling
│       ├── wake-lock.ts              # Keep device awake
│       ├── platform-utils.ts         # Platform detection
│       ├── foreground-service.ts     # Android foreground service
│       └── battery-optimization.ts   # Android battery settings
├── android/              # Android native project
│   └── app/src/main/java/com/rainbowtimer/app/
│       ├── MainActivity.java
│       ├── ForegroundServicePlugin.java
│       ├── TimerForegroundService.java
│       └── BatteryOptimizationPlugin.java
├── ios/                  # iOS native project
│   └── App/
│       ├── App/
│       │   ├── Info.plist
│       │   └── sounds/   # Custom notification sounds
│       └── App.xcworkspace
├── public/               # Static assets
│   ├── party-horn.mp3    # Alarm sound
│   └── sw.js             # Service worker (PWA fallback)
└── out/                  # Static build output
```

## Architecture

### Platform Abstraction

The app uses a service layer to abstract platform-specific functionality:

```typescript
// Platform detection
import { isNativePlatform, isIOS, isAndroid } from '@/services/platform-utils';

// Use native APIs on mobile, fall back to web APIs
if (isNativePlatform()) {
  // Capacitor native APIs
  await scheduleTimerNotification(endTime, 'party_horn.mp3');
} else {
  // Web APIs (Service Worker)
  navigator.serviceWorker.controller.postMessage(...);
}
```

### Notification System

**Native (iOS/Android):**
- Uses `@capacitor/local-notifications`
- Scheduled notifications with exact timing
- Custom sound support
- Survives app closure

**Web (PWA):**
- Uses Service Worker with `setTimeout`
- Browser notification API
- Limited when tab is closed

### Android Foreground Service

The foreground service ensures the timer runs reliably:

```java
TimerForegroundService.java
- Runs as a foreground service (can't be killed by system)
- Shows ongoing notification: "Timer Running: 05:23 remaining"
- Updates every second
- Automatically stops when timer completes
```

### iOS Time-Sensitive Notifications

iOS notifications use the time-sensitive interruption level:

```typescript
{
  interruptionLevel: 'timeSensitive',  // iOS 15+
  relevanceScore: 1.0,                  // Highest priority
  sound: 'party_horn.mp3'
}
```

## Key Components

### RainbowTimer Component

Location: `src/components/rainbow-timer.tsx`

**Main Responsibilities:**
- Renders circular timer UI
- Handles user interactions (drag, tap, quick-set)
- Manages timer state and countdown
- Triggers notifications and celebrations
- Persists state to localStorage

**Key Functions:**
- `startTimerFromAngle(angle)` - Starts timer from given angle
- `pauseTimer()` - Pauses/stops the timer
- `handleToggleMute()` - Toggles sound/notifications
- `cancelAllTimersAndAnimations()` - Cleanup function

### Native Services

#### native-notifications.ts
```typescript
// Request notification permissions
await requestNotificationPermissions();

// Schedule a notification
await scheduleTimerNotification(endTime, soundFile);

// Cancel all notifications
await cancelAllNotifications();

// Setup Android notification channels
await setupNotificationChannels();
```

#### wake-lock.ts
```typescript
// Keep device awake
await keepAwake();

// Allow device to sleep
await allowSleep();
```

#### foreground-service.ts (Android only)
```typescript
// Start foreground service
await startTimerForegroundService(endTime);

// Stop foreground service
await stopTimerForegroundService();
```

#### battery-optimization.ts (Android only)
```typescript
// Check if should show dialog
if (shouldShowBatteryDialog()) {
  // Request exemption from battery optimization
  await requestBatteryOptimizationExemption();
}
```

## Development Workflow

### 1. Web Development

```bash
npm run dev
```

- Fast hot-reload
- Test in browser
- Service Worker notifications (limited)

### 2. Native Testing

```bash
# Make changes to code
npm run build:native

# Open in IDE
npm run ios:dev      # or
npm run android:dev

# Run on device/emulator
```

### 3. Debugging

**Web:**
- Chrome DevTools
- Console logs
- React DevTools extension

**iOS:**
- Safari Web Inspector (for WebView debugging)
- Xcode console for native logs
- Network tab for API calls

**Android:**
- Chrome DevTools (chrome://inspect)
- Android Studio Logcat
- adb logcat for native logs

## Testing Checklist

### Functional Testing

- [ ] Timer starts and counts down correctly
- [ ] Timer can be paused and resumed
- [ ] Quick-set buttons work (5, 10, 15, etc.)
- [ ] Time unit switch (min/sec) works
- [ ] Notification fires at exactly the right time
- [ ] Alarm sound plays when timer ends
- [ ] Confetti celebration triggers
- [ ] Timer persists across app restarts (native)
- [ ] Timer persists across app being closed (native)

### Platform-Specific Testing

**iOS:**
- [ ] Notification permission dialog appears
- [ ] Notification arrives with custom sound
- [ ] Notification works in Focus mode (if allowed)
- [ ] Silent mode doesn't affect notification sound
- [ ] Wake lock prevents screen sleep

**Android:**
- [ ] Battery optimization dialog appears on first timer
- [ ] Foreground service notification shows countdown
- [ ] Timer survives aggressive battery management
- [ ] Notification channel is high-priority
- [ ] Full-screen intent wakes device (optional)

### Edge Cases

- [ ] Very short timers (< 10 seconds)
- [ ] Long timers (> 1 hour)
- [ ] Rapid start/stop/restart
- [ ] Multiple quick-set taps
- [ ] App killed during timer (native)
- [ ] Device restart during timer
- [ ] Low battery scenarios
- [ ] No internet connection

## Common Issues

### iOS Build Errors

**Pod install fails:**
```bash
cd ios/App
pod deintegrate
pod install
```

**Sound file not found:**
- Verify file exists: `ios/App/App/sounds/party_horn.mp3`
- Check it's added to Xcode project
- Verify it's in "Copy Bundle Resources" build phase

### Android Build Errors

**Gradle sync fails:**
```bash
cd android
./gradlew clean
./gradlew build
```

**Sound file not found:**
- Verify file exists: `android/app/src/main/res/raw/party_horn.mp3`
- Filename must be lowercase with underscores (no hyphens)

### Runtime Issues

**Notifications don't arrive:**
1. Check permissions granted
2. Verify sound is unmuted in app
3. Check platform-specific settings (see INSTALL.md)

**Timer stops in background (Android):**
1. Disable battery optimization
2. Verify foreground service is running
3. Check manufacturer-specific power settings

## Adding New Features

### Adding a New Native Plugin

1. **Create TypeScript interface** (`src/services/my-plugin.ts`):
```typescript
import { registerPlugin } from '@capacitor/core';

export interface MyPlugin {
  doSomething(): Promise<void>;
}

const MyPlugin = registerPlugin<MyPlugin>('MyPlugin');
```

2. **Create Android implementation** (`android/.../MyPlugin.java`):
```java
@CapacitorPlugin(name = "MyPlugin")
public class MyPlugin extends Plugin {
    @PluginMethod
    public void doSomething(PluginCall call) {
        // Implementation
        call.resolve();
    }
}
```

3. **Create iOS implementation** (`ios/App/App/MyPlugin.swift`):
```swift
@objc(MyPlugin)
public class MyPlugin: CAPPlugin {
    @objc func doSomething(_ call: CAPPluginCall) {
        // Implementation
        call.resolve()
    }
}
```

4. **Register plugin:**
   - Android: Add to `MainActivity.java`
   - iOS: Add to Podfile or Swift package

5. **Rebuild:**
```bash
npm run build:native
```

## Performance Optimization

### Bundle Size
- Current size: ~137 KB (First Load JS)
- Images are unoptimized (required for static export)
- Consider lazy-loading components if app grows

### Timer Accuracy
- Uses `requestAnimationFrame` for smooth countdown
- Calculates remaining time from start time (no drift)
- Sub-second precision for visual updates

### Battery Usage
- Wake lock only active during countdown
- Foreground service only on Android, only when needed
- Notifications use system APIs (efficient)

## Security Considerations

- No sensitive data stored
- LocalStorage only stores timer state
- No network requests (fully offline)
- All permissions requested at runtime with user consent

## Deployment

### iOS App Store

1. Create App Store Connect listing
2. Archive app in Xcode
3. Upload to App Store Connect
4. Submit for review
5. Wait for approval (typically 24-48 hours)

### Google Play Store

1. Create Google Play Console listing
2. Generate signed APK or AAB
3. Upload to Play Console
4. Submit for review
5. Wait for approval (typically few hours to few days)

### Sideloading

See [INSTALL.md](./INSTALL.md) for instructions.

## Resources

- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [iOS Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Android Design Guidelines](https://developer.android.com/design)
