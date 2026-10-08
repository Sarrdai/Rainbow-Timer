# Konfetti neu: Vorschlag

Stand: Oktober 2026 · Mockup: [`docs/mockups/confetti-mockup.html`](mockups/confetti-mockup.html) · Benchmark: [`docs/mockups/confetti-bench.mjs`](mockups/confetti-bench.mjs)

Das heutige Konfetti (`confetti.tsx`, `confetti-engine.ts`, `confetti.worker.ts`) wird komplett ersetzt. Dieser Vorschlag beschreibt Optik, Technik, API und den Einbau. Eingebaut wird erst nach Freigabe.

## Kurzfassung

- **Technik:** ein WebGL-Canvas auf dem Main-Thread. Jede Flugbahn ist eine geschlossene Formel der Zeit und wird im Vertex-Shader ausgewertet. JavaScript setzt pro Frame nur ein paar Uniforms und zwei Draw-Calls ab, egal wie viele Teilchen fliegen. Ohne WebGL (oder nur mit Software-WebGL) rechnet dieselbe Formel in JavaScript und zeichnet auf einen 2D-Canvas.
- **Kein Worker, keine OffscreenCanvas**, keine DOM-Partikel. Der Worker-Weg hat in Android-WebViews gehakt; DOM-/WAAPI-Partikel laufen zwar bei Hängern weiter, kosten aber beim Auslösen und beim Regen ein Vielfaches an Main-Thread-Zeit (Messwerte unten).
- **Optik:** Papierschnipsel mit Vorder- und Rückseite, Luftschlangen-Kringel, Punkte, Sterne und wenige Herzen in der Zweiton-Schattierung der Ballons. Im dunklen Theme leuchten Sterne und Punkte mit einem weichen Lichthof.
- **Sound:** Plopp nur beim Ballon, Tröte nur bei Timer-Ende, beim Party-Wechsel und beim Beenden der Feier kein Geräusch.

## Anlässe

| Anlass | Konfetti | Sound |
|---|---|---|
| Party an (Titel) | ca. 64 Schnipsel fallen gestaffelt (0,7 s) von oben ein, dazu ein kleiner Fächer (14) aus dem Titel | keiner |
| Party aus (Titel) | kein neues Konfetti; Titel-Konfetti in der Luft blendet in 0,6 s aus | keiner |
| Ballon platzt | 44 Schnipsel spritzen aus der Ballonmitte, 70 % in der Ballonfarbe | synthetischer Plopp (Web Audio, ~0,1 s) |
| Timer-Ende | 200 Schnipsel aus dem Ring des Ziffernblatts; im Party-Modus danach Regen (14/s) | Tröte (`party-horn.mp3`, Schleife bis zum Beenden) |
| Tippen während der Feier | Regen stoppt, ein Windstoß von der Tippstelle pustet das Feier-Konfetti in 0,6 s weg, kleiner Puff (16) an der Tippstelle | keiner (Tröte verstummt) |

Abweichung von heute: Titelklick und Abbruch spielen keinen „Bang“ mehr, und die Tröte startet gleichzeitig mit dem Ausbruch statt 200 ms nach dem Bang.

## Optik

Alle Formen werden einmal in eine Textur gezeichnet (8 Zellen à 64 px, mit Mipmaps). Die Textur speichert keine Farbe, sondern Schattierung (R), Glanzlicht (G) und Deckung (A); der Shader färbt pro Teilchen ein. So reicht eine Textur für alle Farben und beide Themes.

- **Zweiton wie die Ballons:** dunklere Sichel unten rechts, der helle Teil nach oben links versetzt (wie `Shade` in `balloon-shapes.tsx`), dazu ein weiches Glanzlicht.
- **Vorder- und Rückseite:** Das Flattern ist eine Stauchung `cos(flip)`. Bei negativem Wert sieht man die Rückseite: 26 % dunkler, fast ohne Glanz.
- **Formen (Variante B „Party-Mix“, empfohlen):** Papier 50 %, Kringel 17 %, Punkte 17 %, Sterne 11 %, Herzen 5 %. Jede Form hat eigene Fallgeschwindigkeit und Flattern: Kringel schweben, Punkte fallen schneller, Papier taumelt am stärksten.
- **Dunkles Theme:** Farben 14 % aufgehellt, Sterne und Punkte bekommen einen additiv gezeichneten, leicht pulsierenden Lichthof (zweiter Draw-Call), passend zu den Lichterketten der Dekoration. Theme-Wechsel wirkt sofort, auch auf fliegendes Konfetti.
- Varianten A („Papier“, nur Schnipsel) und C („Funkeln“, mehr Sterne und Punkte) sind im Mockup zum Vergleich umschaltbar.

## Technik

### Bewegungsmodell

Lineare Luftreibung `k` zieht die Startgeschwindigkeit zur Fallgeschwindigkeit `vt`. Damit ist die Position eine Formel der Zeit, nichts wird pro Frame integriert:

```
x(t) = x0 + vx · (1 − e^(−k t)) / k + A · sin(ω t + φ) · (1 − e^(−k t))
y(t) = y0 + vt · t + (vy − vt) · (1 − e^(−k t)) / k
```

Folgen:

- **60/120 Hz und gedrosselte Displays** laufen automatisch gleich schnell.
- **Hänger:** Das Konfetti steht kurz still und ist danach sofort wieder an der richtigen Stelle. Keine Zeitlupe (heute: `dt` auf 50 ms begrenzt) und kein Nachholen.
- **Lebensdauer** ist beim Erzeugen bekannt (Zeit bis unter den Bildschirmrand). Die Schleife läuft nur bis zum letzten Ende, danach wird der Canvas auf 1×1 verkleinert.
- **Regen ohne Arbeit pro Frame:** Regentropfen werden einmal pro Sekunde für die nächsten 1,5 s mit Startzeiten in der Zukunft eingeplant; der Shader blendet sie erst ab ihrer Startzeit ein. `setRaining(false)` setzt eine Abschnittszeit, später geplante Tropfen erscheinen nicht.
- **Ausblenden und Wegpusten** sind Uniforms (`dissolveAt`, `sweepAt`, `sweepOrigin`): Der Shader wendet sie auf alle Teilchen an, die vorher entstanden sind. Kein Durchlauf über die Teilchen in JavaScript.

### Renderer

**WebGL (Standard):** WebGL 1 + `ANGLE_instanced_arrays` (überall verfügbar, auch WKWebView). Ein Ringpuffer mit 2048 Teilchen à 96 Byte; beim Auslösen wird nur der neue Bereich per `bufferSubData` hochgeladen. Pro Frame: Canvas-Größe prüfen, 9 Uniforms, 1–2 `drawArraysInstanced`. DPR auf 2 begrenzt (der Füllaufwand liegt auf der GPU und ist bei kleinen Sprites gering). Kontext mit `failIfMajorPerformanceCaveat: true`, damit Geräte ohne GPU-Beschleunigung nicht in Software-WebGL landen, sondern im 2D-Pfad.

**Canvas 2D (Rückfallebene):** dieselbe Formel in JavaScript, vorab eingefärbte Sprites (32 px, je Form/Farbe/Seite/Theme gecacht), pro Teilchen `setTransform` + `drawImage`. DPR auf 1,5 begrenzt.

**Nicht gewählt:**

- *OffscreenCanvas im Worker:* in DuckDuckGo/Android-WebView ruckelig, weil Worker-Frames nicht zuverlässig präsentiert werden. Bei 0,1 ms Main-Thread-Zeit pro Frame bringt der Worker auch nichts mehr.
- *DOM + Web Animations:* Die Flugbahnen lassen sich vorab als Keyframes berechnen und laufen dann auf dem Compositor, auch während Hängern. Aber jedes Teilchen braucht drei Elemente und drei Animationen; das Auslösen kostet ein Vielfaches, jeder Main-Thread-Frame wird durch Hunderte Layer teurer, und Regen erzeugt laufend neue Elemente. Rückseiten-Schattierung und Leuchten wären nur mit noch mehr Elementen möglich.

## Messungen

Headless Chromium 1194 (Playwright 1.56), Viewport 412×915 bei DPR 2,625, **CPU 4× gedrosselt** (grob Mittelklasse-Android), WebGL über SwiftShader. Median aus 3 Durchläufen. „Main-Thread“ ist `TaskDuration` aus `Performance.getMetrics` (CDP) geteilt durch die Zahl der Frames; darin stecken auch Frame-Zähler und Seite (Leerlauf-Grundlast in der ersten Zeile). „JS“ ist nur die Zeit im Frame-Callback des Renderers.

MEASUREMENTS_TABLE

Einordnung:

MEASUREMENTS_NOTES

Grenzen der Messung: Headless hat keine echte GPU und keine WebView. Die Main-Thread-Zahlen sind übertragbar, GPU-Zeit und Präsentation nicht. Darum enthält das Mockup alle drei Techniken, einen Frame-Zähler und künstliche Last, um es direkt auf dem Handy, in DuckDuckGo und in der Capacitor-App zu prüfen.

## API

```ts
// src/components/confetti/index.ts
export const confetti: {
  /** Party mode on: shower from the top plus a small fan out of the title. */
  partyStart(titleRect: DOMRect): void;
  /** Party mode off: title confetti still in the air fades out. */
  partyEnd(): void;
  /** Balloon popped: pieces mostly in the balloon's color. */
  balloonPop(x: number, y: number, color: string): void;
  /** Timer end: burst out of the dial ring. Resolves when the burst has fallen (or was swept away). */
  timerEnd(dialRect: DOMRect): Promise<void>;
  /** Party rain during a celebration. */
  setRaining(raining: boolean): void;
  /** Tap during the celebration: stop the rain, blow the celebration confetti away from the tap. */
  interrupt(x: number, y: number): void;
};

/** Mount once in the page: owns the canvas, picks WebGL or 2D, follows theme and reduced motion. */
export function ConfettiLayer(): JSX.Element;
```

```ts
// src/lib/sounds.ts – shared AudioContext, independent of React state
export const sounds: {
  setMuted(muted: boolean): void;
  warmUp(): void;        // first pointerdown, as today
  pop(): void;           // balloon
  horn(on: boolean): void; // timer end, loops until off
  beep(): void;          // countdown, unchanged
};
```

Die Sounds wandern aus `useTimerAudio` in ein Modul, damit `page.tsx` beim Ballon direkt `sounds.pop()` aufrufen kann. Das Hin- und Herreichen über `titleBangTrigger` entfällt.

## Einbau

**Entfällt**

- `src/components/confetti.tsx`, `src/components/confetti-engine.ts`, `src/components/confetti.worker.ts`
- `.confetti-live` und `@keyframes confetti-live` in `src/app/globals.css`
- `titleBangTrigger` (State in `page.tsx`, Prop und Effekt in `rainbow-timer.tsx`), `playBang` in `use-timer-audio.ts`

**Neu**

| Datei | Inhalt | ca. Zeilen |
|---|---|---|
| `src/lib/palette.ts` | `RAINBOW_COLORS` (heute aus `confetti.tsx` exportiert; Importe in `balloon-shapes.tsx`, `decoration/kit.tsx`, `rainbow-timer.tsx` umstellen) | 5 |
| `src/components/confetti/model.ts` | Formen-Mix, Physik je Form, `makeParticle`, `evaluate` (CPU-Spiegel des Shaders) | 120 |
| `src/components/confetti/sprites.ts` | Formen zeichnen, Atlas für WebGL, gecachte Sprites für 2D | 110 |
| `src/components/confetti/gl-renderer.ts` | Shader, Ringpuffer, Frame | 150 |
| `src/components/confetti/canvas-renderer.ts` | Rückfallebene | 70 |
| `src/components/confetti/index.tsx` | `confetti` (die Anlässe, Regenplanung, Promises), `ConfettiLayer`, Theme- und Reduced-Motion-Beobachter | 150 |
| `src/lib/sounds.ts` | AudioContext, Plopp, Tröte, Beep | 90 |

**Anbindung**

- `page.tsx`
  - `handleTitleBurst`: `confetti.partyStart(titleRect)` bzw. `confetti.partyEnd()`, kein Sound.
  - `handleBalloonPop(x, y, color)`: `confetti.balloonPop(...)` + `sounds.pop()`. `PartyDecoration.onBalloonPop` reicht dafür die Farbe mit (`b.shape.fixedColor ?? b.color`).
  - `handleInterruptCelebration`: entfällt; der Abbruch ruft `confetti.interrupt(x, y)` in `rainbow-timer.tsx` mit der Tippstelle auf.
- `rainbow-timer.tsx`
  - `celebrate`: `confetti.timerEnd(dialRect).then(...)` wie heute `ringBurst`, `sounds.horn(true)` sofort (nicht still), Regen wie heute über `isRaining` → `confetti.setRaining`.
  - `stopCelebrationAndReset`: `confetti.interrupt(x, y)` (bei Tastatur oder Titelklick die Mitte des Ziffernblatts), `sounds.horn(false)`, kein Bang.
  - `isMuted` → `sounds.setMuted(isMuted)`.
- **Initialisierung:** `ConfettiLayer` erzeugt den WebGL-Kontext und den Atlas in `requestIdleCallback` (mit 2 s Timeout) nach dem ersten Rendern, nicht erst beim ersten Titelklick. Kontextverlust (`webglcontextlost`) schaltet auf den 2D-Pfad; nach `webglcontextrestored` zurück.
- **Theme:** `MutationObserver` auf `data-theme` wie in `party-decoration.tsx`, setzt ein Uniform.
- **Reduced Motion:** `matchMedia('(prefers-reduced-motion: reduce)')` mit Listener. Dann: 30 % der Teilchen, sie erscheinen an ihrem Zielort, stehen 1 s und blenden aus; kein Regen, kein Flattern.

Aufwand: etwa ein Arbeitstag inklusive Test auf Android (Chrome, DuckDuckGo, Capacitor) und iOS.

## Risiken

- **Android-WebViews:** Ein WebGL-Canvas auf dem Main-Thread wird wie jeder andere Canvas präsentiert, also wie der heutige `?confetti=main`-Pfad, der in DuckDuckGo flüssig lief. Prüfen: im Mockup „WebGL“ in DuckDuckGo und in der Capacitor-App, mit „Party-Start + Hänger“.
- **GPU-Sperrlisten / Software-WebGL:** `failIfMajorPerformanceCaveat` lehnt Software-WebGL ab, dann greift Canvas 2D. Bei 2D steigt die Main-Thread-Zeit mit der Teilchenzahl (siehe Messung), bleibt aber bei den geplanten Mengen klein.
- **Kontextverlust** (Android im Hintergrund, Speicherdruck): Ereignis abfangen, auf 2D wechseln, später neu aufbauen. Fliegendes Konfetti geht dabei verloren, das ist vertretbar.
- **iOS WKWebView:** WebGL 1 mit Instancing ist seit Jahren stabil. Im Stromsparmodus läuft `requestAnimationFrame` mit 30 Hz; die Zeitformel bleibt korrekt, es ruckelt nur gröber. Erster Shader-Compile kann auf älteren iPhones 20–50 ms dauern, darum die Initialisierung im Leerlauf.
- **Hänger beim Party-Start:** Während die Dekoration montiert wird, steht auch das WebGL-Konfetti (wie jeder Main-Thread-Canvas). Es springt danach an die richtige Stelle. Dass es selbst den Start nicht verlangsamt (Zuschlag pro Frame ≈ 0), ist der größere Gewinn. Falls das Stehen stört: den Schwall um ~150 ms verzögern (Startzeiten in der Zukunft kosten nichts), bis die gestaffelte Montage durch ist.
- **Reduced Motion:** Systemeinstellung wird live verfolgt. Ganz ohne Konfetti wäre auch möglich; der Vorschlag zeigt stattdessen ruhige, kurz sichtbare Schnipsel, damit das Timer-Ende erkennbar bleibt.
- **Sound auf iOS:** Der Plopp braucht einen laufenden AudioContext. Das heutige Vorwärmen beim ersten `pointerdown` bleibt; der Ballon-Klick ist selbst eine Nutzergeste.
