# Rainbow Timer - Native App Installation Guide

This guide explains how to build and install the Rainbow Timer app as a native iOS or Android application.

## Table of Contents
- [Prerequisites](#prerequisites)
- [Building the App](#building-the-app)
- [iOS Installation](#ios-installation)
- [Android Installation](#android-installation)
- [Notification Setup](#notification-setup)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### General Requirements
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)
- **Git** (for cloning the repository)

### iOS Development
- **macOS** (required for iOS development)
- **Xcode** 14 or higher
- **CocoaPods** (usually installed with Xcode)
- **Apple Developer Account** (optional, for TestFlight or App Store)
  - Free account allows sideloading to your own devices
  - Paid account ($99/year) required for TestFlight/App Store distribution

### Android Development
- **Android Studio** (latest version recommended)
- **Android SDK** (API 26 or higher)
- **Java Development Kit (JDK)** 17 or higher

## Building the App

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd Rainbow-Timer
npm install
```

### 2. Build the Web Assets

```bash
npm run build:web
```

This creates a static export in the `out/` directory.

### 3. Sync to Native Platforms

```bash
npm run build:native
```

This runs the web build and syncs the assets to both iOS and Android projects.

## iOS Installation

### Development Build (Xcode)

1. **Open the iOS project:**
   ```bash
   npm run ios:dev
   ```
   Or manually:
   ```bash
   cd ios/App
   open App.xcworkspace
   ```

2. **Configure signing:**
   - In Xcode, select the "App" target
   - Go to "Signing & Capabilities"
   - Select your Team (Apple Developer account)
   - Xcode will automatically manage provisioning profiles

3. **Add Sound File to Xcode:**
   - In Xcode's Project Navigator, right-click on the "App" folder
   - Select "Add Files to App"
   - Navigate to `ios/App/App/sounds/party_horn.mp3`
   - Check "Copy items if needed"
   - Verify the file appears in Build Phases → Copy Bundle Resources

4. **Select your device:**
   - Connect your iPhone/iPad via USB
   - Select it from the device dropdown in Xcode toolbar

5. **Build and Run:**
   - Click the "Play" button (▶️) in Xcode
   - Or press `Cmd + R`
   - The app will install and launch on your device

### Sideloading (Without Developer Account)

With a free Apple Developer account:
- You can install on up to 3 devices
- Apps expire after 7 days (must rebuild)
- Follow the same Xcode steps above

### TestFlight Distribution

1. **Archive the app:**
   ```bash
   cd ios/App
   xcodebuild -workspace App.xcworkspace -scheme App -configuration Release -archivePath ./build/App.xcarchive archive
   ```

2. **Upload to App Store Connect:**
   - Open Xcode → Window → Organizer
   - Select your archive
   - Click "Distribute App"
   - Choose "App Store Connect"
   - Follow the wizard

3. **TestFlight Setup:**
   - Go to [App Store Connect](https://appstoreconnect.apple.com)
   - Select your app → TestFlight
   - Add internal or external testers
   - Testers receive an invitation to download via TestFlight app

### Notification Configuration

iOS notifications are configured automatically with:
- **Time Sensitive Notifications:** Enabled for timer alerts
- **Sound:** Custom `party_horn.mp3` sound
- **Relevance Score:** 1.0 (highest priority)

Users must grant notification permissions when first starting a timer.

## Android Installation

### Development Build (Android Studio)

1. **Open the Android project:**
   ```bash
   npm run android:dev
   ```
   Or manually:
   ```bash
   cd android
   # Then open Android Studio and select this directory
   ```

2. **Enable Developer Mode on your device:**
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times
   - Developer options will appear in Settings

3. **Enable USB Debugging:**
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

4. **Connect your device:**
   - Connect via USB
   - Accept the "Allow USB Debugging" prompt on your device

5. **Build and Run:**
   - Click the "Run" button (▶️) in Android Studio
   - Or run: `cd android && ./gradlew installDebug`

### APK Installation (Sideloading)

1. **Build the APK:**
   ```bash
   cd android
   ./gradlew assembleRelease
   ```

   The APK will be created at:
   `android/app/build/outputs/apk/release/app-release-unsigned.apk`

2. **Sign the APK (Optional but recommended):**
   - For production, you should sign the APK
   - See [Android documentation](https://developer.android.com/studio/publish/app-signing) for signing instructions

3. **Transfer APK to your device:**
   - Via USB: Copy the APK file to your device's Downloads folder
   - Via cloud: Upload to Google Drive, Dropbox, etc., and download on device

4. **Install the APK:**
   - Open the APK file on your device
   - Tap "Install"
   - If prompted, allow installation from "Unknown Sources"

### Allow Unknown Sources

Android 8.0+ requires per-app permission:
- When installing, you'll see a prompt to allow "Install unknown apps"
- Grant permission to the app you're using to install (e.g., Files, Chrome)

### Battery Optimization Setup

**CRITICAL for reliable timer notifications:**

The app will automatically prompt you to disable battery optimization on first timer start. However, you can also do this manually:

1. Go to **Settings → Apps → Rainbow Timer**
2. Tap **Battery** or **Battery Optimization**
3. Select **"Don't optimize"** or **"Unrestricted"**

Different manufacturers have different settings:
- **Samsung:** Settings → Apps → Rainbow Timer → Battery → Allow background activity
- **Xiaomi:** Settings → Apps → Rainbow Timer → Battery saver → No restrictions
- **Huawei:** Settings → Apps → Rainbow Timer → Battery → App launch → Manual → Allow all
- **OnePlus:** Settings → Apps → Rainbow Timer → Battery → Battery optimization → Don't optimize

### Notification Channels

The app creates a high-priority notification channel "Timer Alerts" automatically. If notifications aren't working:

1. Go to **Settings → Apps → Rainbow Timer → Notifications**
2. Ensure notifications are enabled
3. Tap **"Timer Alerts"** channel
4. Set importance to **"High"** or **"Urgent"**
5. Enable **"Show on lock screen"**

## Notification Setup

### iOS

1. **Grant Permission:**
   - When you start your first timer with sound enabled, iOS will ask for notification permission
   - Tap "Allow"

2. **Notification Settings:**
   - Settings → Notifications → Rainbow Timer
   - Ensure "Allow Notifications" is ON
   - Set "Banner Style" to "Persistent" for maximum visibility
   - Enable "Sounds"
   - Enable "Lock Screen"

3. **Focus Modes:**
   - If using Focus modes (Do Not Disturb), add Rainbow Timer to allowed apps
   - Settings → Focus → [Your Focus] → Apps → Add → Rainbow Timer

### Android

1. **Grant Permission:**
   - Android 13+ will show a permission dialog on first timer start
   - Tap "Allow"

2. **Verify Channel Settings:**
   - Settings → Apps → Rainbow Timer → Notifications → Timer Alerts
   - Importance: High
   - Lock screen: Show

3. **Do Not Disturb:**
   - Go to Settings → Sound → Do Not Disturb → Apps
   - Add Rainbow Timer to exceptions

## Troubleshooting

### Notifications Don't Arrive

**iOS:**
- ✅ Check notification permissions (Settings → Notifications → Rainbow Timer)
- ✅ Verify sound is unmuted (toggle sound button in app)
- ✅ Check Focus mode settings
- ✅ Restart the device

**Android:**
- ✅ Check notification permissions granted
- ✅ Verify battery optimization is disabled
- ✅ Check notification channel importance (must be "High")
- ✅ Verify "Timer Alerts" channel is enabled
- ✅ Restart the device

### Sound Doesn't Play

**iOS:**
- ✅ Check if iPhone is on silent mode (use Ring/Silent switch)
- ✅ Increase volume
- ✅ Verify notification sound is enabled in Settings
- ✅ Check if sound file is in Xcode project (Build Phases → Copy Bundle Resources)

**Android:**
- ✅ Check notification volume (separate from media/ringer volume)
- ✅ Verify sound file exists in `android/app/src/main/res/raw/party_horn.mp3`
- ✅ Check if phone is in Do Not Disturb mode

### Timer Stops in Background (Android)

- ✅ **Battery optimization must be disabled** (see Battery Optimization Setup above)
- ✅ Verify foreground service is running (you should see a notification "Timer Running: XX:XX remaining")
- ✅ Check manufacturer-specific battery settings (Samsung, Xiaomi, Huawei have aggressive battery savers)

### Build Errors

**iOS:**
- ✅ Run `pod install` in `ios/App` directory
- ✅ Clean build folder: Xcode → Product → Clean Build Folder
- ✅ Delete derived data: `rm -rf ~/Library/Developer/Xcode/DerivedData`
- ✅ Verify sound file is added to Xcode project

**Android:**
- ✅ Run `./gradlew clean` in `android` directory
- ✅ Invalidate caches: Android Studio → File → Invalidate Caches and Restart
- ✅ Check Java version: `java -version` (should be 17+)
- ✅ Verify sound file exists in `res/raw` directory

### App Won't Install

**iOS:**
- ✅ Check signing certificate is valid
- ✅ Device is registered in developer portal (for non-free accounts)
- ✅ Trust developer certificate on device (Settings → General → VPN & Device Management)

**Android:**
- ✅ Enable installation from unknown sources
- ✅ Check storage space on device
- ✅ Try uninstalling previous version first

## Support

For issues specific to the Rainbow Timer app:
- Check the [GitHub Issues](https://github.com/your-repo/issues)
- Create a new issue with:
  - Device model and OS version
  - Steps to reproduce
  - Expected vs actual behavior
  - Logs (if available)

For Capacitor-specific issues:
- [Capacitor Documentation](https://capacitorjs.com/docs)
- [Capacitor Community](https://ionic.io/community)

## Additional Resources

- [iOS Human Interface Guidelines - Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)
- [Android Notifications Best Practices](https://developer.android.com/develop/ui/views/notifications)
- [Capacitor Local Notifications](https://capacitorjs.com/docs/apis/local-notifications)
