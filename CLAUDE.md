# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server on port 9002 (Turbopack)
npm run build        # Production build
npm run lint         # ESLint via Next.js
npm run typecheck    # TypeScript check (tsc --noEmit)
npm run genkit:dev   # Start Genkit AI dev environment
```

Note: `next.config.ts` is configured to ignore TypeScript and ESLint errors during `build`, so always run `typecheck` and `lint` separately.

## Architecture

**Stack**: Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui (Radix UI primitives)

**Path alias**: `@/*` maps to `./src/*`

### Core Timer Logic (`src/components/rainbow-timer.tsx`)

This is the central component and where most complexity lives:

- **Drag interaction**: Tracks mouse/touch events to set timer duration by rotating the dial. Uses refs (`isDragging`, `lastAngle`, `accumulatedAngle`) to manage drag state without re-renders.
- **SVG dial**: A circular gauge rendered with SVG `stroke-dasharray`/`stroke-dashoffset` to animate the rainbow arc disappearing as time elapses.
- **Countdown loop**: `requestAnimationFrame`-based loop stored in a ref (`animationFrameId`). The elapsed time is computed from `Date.now()` deltas to stay accurate regardless of frame rate.
- **Auto-transition**: When remaining time drops below 60 seconds in minutes mode, the timer automatically switches to seconds mode (`time-unit-switch.tsx`).
- **Snap behavior**: Dial snaps to full-minute or full-second increments with a 200ms debounce after drag ends.
- **Audio**: Web Audio API for tick beeps; `party-horn.mp3` (via `<audio>` element) on completion.
- **Wake Lock**: Requests `navigator.wakeLock` to prevent screen sleep during active countdown.
- **Service Worker**: Sends messages to `public/sw.js` to schedule background notifications.
- **Persistence**: Timer state (remaining time, mode) is saved to `localStorage` and recovered on reload.

### Page Orchestration (`src/app/page.tsx`)

Client component that owns top-level state: fullscreen toggle, confetti trigger, UI panel visibility. Passes callbacks into `rainbow-timer.tsx` for completion events.

### Confetti (`src/components/confetti.tsx`)

Canvas-based particle animation. Triggered by `page.tsx` on timer completion. Also used in `title-confetti.tsx` for the animated page title.

### UI Components (`src/components/ui/`)

Standard shadcn/ui components — do not modify these directly; regenerate via `npx shadcn@latest add <component>`.

## Key Constants (in `rainbow-timer.tsx`)

- `MAX_TIME_MIN_MS` = 3,600,000 ms (60 minutes)
- `MAX_TIME_SEC_MS` = 60,000 ms (60 seconds)

## PWA / Service Worker

`public/sw.js` handles background push notifications. The timer communicates with it via `postMessage`. `public/manifest.json` defines the PWA metadata (theme color `#46378a`, standalone display).

## Internationalization

The app supports English and German. Translation strings are inlined in the components (no external i18n library).

## Deployment

Configured for Firebase App Hosting (`apphosting.yaml`, `maxInstances: 1`).
