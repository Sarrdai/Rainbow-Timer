# CLAUDE.md — Rainbow Timer

This file provides guidance for AI assistants working in this repository.

---

## Project Overview

**Rainbow Timer** is a PWA (Progressive Web App) countdown timer with a draggable rainbow-gradient dial, confetti celebrations, and audio/notification support. It is built with Next.js 15 (App Router), React 19, and TypeScript, styled with Tailwind CSS and Shadcn/ui, and deployed via Firebase App Hosting.

---

## Tech Stack

| Concern | Tool |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5 (strict mode) |
| UI Library | Shadcn/ui (Radix UI primitives) |
| Styling | Tailwind CSS 3 + CSS custom properties |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| AI (configured) | Google Genkit + Gemini 2.5 Flash |
| Deployment | Firebase App Hosting (`apphosting.yaml`) |
| Package Manager | npm |

---

## Directory Structure

```
Rainbow-Timer/
├── src/
│   ├── ai/                         # Google Genkit AI setup (dev.ts entry)
│   ├── app/
│   │   ├── layout.tsx              # Root layout: metadata, PWA manifest, fonts, Toaster
│   │   ├── page.tsx                # Home page — orchestrates fullscreen, title, footer
│   │   └── globals.css             # CSS custom properties (HSL theme tokens) + base styles
│   ├── components/
│   │   ├── ui/                     # Auto-generated Shadcn/ui primitives (do not hand-edit)
│   │   ├── rainbow-timer.tsx       # Core timer component (~1 270 lines) — all timer logic
│   │   ├── confetti.tsx            # Canvas-based confetti: burst + rain modes (~276 lines)
│   │   ├── rainbow-word.tsx        # SVG animated rainbow text
│   │   ├── title-confetti.tsx      # Title-click confetti wrapper
│   │   ├── toggling-word.tsx       # Animated word toggle component
│   │   ├── time-unit-switch.tsx    # Minutes ↔ Seconds toggle
│   │   ├── footer.tsx              # Footer bar
│   │   └── impressum-modal.tsx     # Legal/impressum modal (German law)
│   ├── hooks/
│   │   ├── use-mobile.tsx          # Responsive breakpoint hook
│   │   └── use-toast.ts            # Toast notification hook
│   └── lib/
│       ├── utils.ts                # cn() — Tailwind class merging utility
│       └── placeholder-images.ts   # Placeholder image URLs
├── public/
│   ├── sw.js                       # Service Worker — background timer notifications
│   ├── party-horn.mp3              # Alarm sound played on timer completion
│   ├── manifest.json               # PWA Web App Manifest
│   └── icons/                      # App icons (192×192, 512×512, favicon, apple-touch)
├── docs/
│   └── blueprint.md                # Original design spec (style guide, feature list)
├── next.config.ts                  # Next.js config (image domains, build error suppression)
├── tailwind.config.ts              # Tailwind theme (HSL tokens, dark mode: class)
├── tsconfig.json                   # TypeScript config (path alias @/* → ./src/*)
├── components.json                 # Shadcn CLI config
└── apphosting.yaml                 # Firebase App Hosting deployment config
```

---

## Development Workflow

### Start the dev server
```bash
npm run dev
# Runs on http://localhost:9002 with Turbopack
```

### Type-check without building
```bash
npm run typecheck
# tsc --noEmit
```

### Lint
```bash
npm run lint
# next lint
```

### Production build
```bash
npm run build   # NODE_ENV=production next build
npm run start   # Production server
```

### Genkit AI development (optional)
```bash
npm run genkit:dev    # Start Genkit dev server
npm run genkit:watch  # Watch mode
```

> **Note:** There is no test suite. If adding tests, use Vitest (compatible with Vite/Next.js) or Jest.

---

## Key Conventions

### TypeScript
- Strict mode is on. Do not add `// @ts-ignore` without a clear justification.
- Path alias `@/*` maps to `src/*`. Always use this for imports, never relative `../../`.
- `next.config.ts` currently suppresses TS build errors and ESLint during `next build`. Fix underlying issues rather than relying on this.

### React / Components
- All interactive components use `"use client"` — this is a client-heavy app with no server components beyond the root layout.
- Prefer `useCallback` for event handlers passed as props or used in `useEffect` dependency arrays.
- Use `useRef` for animation loop handles (`requestAnimationFrame` IDs), mutable values that shouldn't re-render, and DOM nodes.
- Avoid introducing new global state managers (Redux, Zustand, etc.). The app uses local `useState`/`useRef` plus `localStorage`.

### Naming
- Components: `PascalCase` filenames and exports.
- Hooks: `use-kebab-case.ts` filenames, `useCamelCase` exports.
- Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_TIME_MIN_MS`, `CENTER`, `SIZE`).
- Event handlers: prefix with `handle` (e.g., `handleInteractionStart`).

### Styling
- Use Tailwind utility classes as the default. Do not add arbitrary CSS unless strictly necessary.
- Theme tokens are HSL custom properties defined in `globals.css`. Reference them via Tailwind's `bg-background`, `text-foreground`, etc., not raw hex values.
- Dark mode is class-based (`dark:` prefix). Do not hardcode colours that ignore the theme.
- `cn()` from `@/lib/utils` combines Tailwind classes safely — always use it in components that accept a `className` prop.

### Shadcn/ui Components
- Components live in `src/components/ui/`. They are generated by the Shadcn CLI and should **not** be manually edited unless there is no other option.
- To add a new Shadcn component: `npx shadcn-ui@latest add <component-name>`.

### SVG & Canvas
- The timer dial is rendered in SVG using `stroke-dasharray`/`stroke-dashoffset` for the arc.
- Confetti uses a `<canvas>` element with direct 2D context drawing inside `requestAnimationFrame` loops.
- Helper `polarToCartesian(cx, cy, r, angleDeg)` converts polar coordinates to Cartesian for SVG path math.

### Audio
- Audio is managed through the Web Audio API (`AudioContext`) inside `rainbow-timer.tsx`.
- Always resume the `AudioContext` on a user gesture before playing sounds (browser autoplay policy).
- The alarm file is `public/party-horn.mp3` — keep it under 1 MB.

### PWA / Service Worker
- `public/sw.js` handles background timer notification dispatch. Any changes to notification logic must be reflected here.
- The Web App Manifest is `public/manifest.json`. Icons live in `public/icons/`.
- Wake Lock API is used in `rainbow-timer.tsx` to prevent screen sleep during an active countdown.

### Persistence
- Timer state (remaining time, mode, mute preference) is persisted to `localStorage`. Keys are defined near the top of `rainbow-timer.tsx`.
- Do not store sensitive data in `localStorage`.

### Localisation
- The app detects browser locale to switch between English and German strings. Language detection is handled in `src/app/page.tsx` using `navigator.language`.
- Keep both EN and DE strings in sync when adding user-visible text.

---

## Architecture Notes

- **No API routes**: The app has no Next.js API routes. All logic is client-side.
- **No SSR content**: Pages do not fetch server-side data. `page.tsx` is effectively a shell that mounts client components.
- **Genkit AI**: The `src/ai/` directory wires up Genkit with Gemini 2.5 Flash. It is configured but not yet exposed in the UI. New AI features should go here.
- **Firebase App Hosting**: Deployment is configured in `apphosting.yaml`. Do not change the output directory or build command without updating this file.

---

## Important Files at a Glance

| File | Purpose |
|---|---|
| `src/app/page.tsx` | App shell, fullscreen logic, locale detection |
| `src/components/rainbow-timer.tsx` | All timer state, dial interaction, audio, notifications |
| `src/components/confetti.tsx` | Canvas confetti burst + rain |
| `src/app/globals.css` | Theme tokens (HSL variables) |
| `public/sw.js` | Service Worker for background notifications |
| `docs/blueprint.md` | Original design spec and colour palette |

---

## Common Pitfalls

1. **`requestAnimationFrame` leaks**: Always cancel animation frame IDs in `useEffect` cleanup or when stopping a loop. Ref IDs (`animFrameRef.current`) are used for this purpose throughout `rainbow-timer.tsx`.
2. **AudioContext suspended state**: Browsers suspend `AudioContext` until a user gesture. Call `audioCtx.resume()` inside click/touch handlers before playing sound.
3. **SVG arc edge case**: An SVG arc path with a sweep angle of exactly 360° collapses to nothing. The timer logic clamps to 359.99° at full scale.
4. **TypeScript errors suppressed at build**: `next.config.ts` ignores TS errors during `next build`. Run `npm run typecheck` explicitly to catch type errors.
5. **Shadcn component edits lost**: Shadcn components in `src/components/ui/` may be regenerated by the CLI. Prefer wrapping them rather than editing directly.
