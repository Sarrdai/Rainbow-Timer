# Rainbow Timer

A beautiful, colorful timer application with native iOS and Android support.

## 🌈 Features

- **Visual Timer**: Beautiful rainbow-colored circular timer interface
- **Dual Modes**: Switch between minutes (1-60) and seconds (1-60) views
- **Native Apps**: Full iOS and Android native app support with Capacitor
- **Reliable Notifications**:
  - iOS: Time-sensitive notifications with custom alarm sound
  - Android: Foreground service ensures timer runs reliably in background
- **Custom Alarm Sound**: Party horn sound that plays when timer completes
- **Wake Lock**: Keeps screen awake while timer is running
- **Persistent Timers**: Timer continues even when app is closed (native apps)
- **Celebration Effects**: Confetti animation when timer completes
- **PWA Support**: Also works as a Progressive Web App in browsers

## 🚀 Quick Start

### Web Development

```bash
npm install
npm run dev
```

Visit `http://localhost:9002`

### Native App Development

See [INSTALL.md](./INSTALL.md) for detailed instructions on building and installing the iOS and Android apps.

Quick commands:
```bash
# Build web assets and sync to native
npm run build:native

# Open in Xcode (macOS only)
npm run ios:dev

# Open in Android Studio
npm run android:dev
```

## 📱 Platform Support

- **Web**: Works in all modern browsers as a PWA
- **iOS**: Native app with time-sensitive notifications
- **Android**: Native app with foreground service for reliable background timers

## 🔔 Notification Features

### iOS
- Time-sensitive notifications (iOS 15+)
- Custom alarm sound
- Works even when app is closed
- Notification permissions requested on first use

### Android
- Foreground service with live countdown notification
- High-priority notification channel for alarms
- Battery optimization bypass for reliability
- Full-screen wake-up on timer completion

## 🛠️ Technology Stack

- **Framework**: Next.js 15 with React 19
- **Native**: Capacitor 8
- **UI**: Tailwind CSS with custom components
- **Notifications**: Capacitor Local Notifications
- **Storage**: LocalStorage for timer state persistence

## 📖 Documentation

- [INSTALL.md](./INSTALL.md) - Comprehensive installation guide for iOS and Android
- [src/components/rainbow-timer.tsx](./src/components/rainbow-timer.tsx) - Main timer component
- [src/services/](./src/services/) - Native platform services

## 🔧 Build Commands

```bash
# Development
npm run dev              # Start Next.js dev server

# Web Build
npm run build:web        # Build static web app

# Native Build
npm run build:native     # Build and sync to iOS/Android
npm run ios:dev          # Open iOS project in Xcode
npm run android:dev      # Open Android project in Android Studio

# Utilities
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking
```

## 📝 License

See LICENSE file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
