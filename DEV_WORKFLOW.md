# Entwicklungs-Workflow für Rainbow Timer

## 🚀 Schnellstart

```bash
# Dev-Server starten
npm run dev

# App öffnet sich auf: http://localhost:9002
```

---

## 📝 Standard-Entwicklungsablauf

### 1. Lokale Entwicklung starten

```bash
# Development-Server mit Turbopack (schnell!)
npm run dev
```

Die App läuft dann auf: **http://localhost:9002**

**Features im Dev-Modus:**
- ✅ Hot Reload (Änderungen werden sofort sichtbar)
- ✅ Turbopack (super schnell)
- ✅ TypeScript-Fehler werden im Browser angezeigt
- ✅ Detaillierte Error-Messages

### 2. Code schreiben & testen

- Ändern Sie Ihre Dateien in `src/`
- Browser aktualisiert automatisch
- Testen Sie alle Funktionen lokal

**Tipp:** Öffnen Sie auch die Browser-DevTools:
- `F12` oder `Ctrl+Shift+I`
- Console für Logs
- Application-Tab für PWA/Manifest-Checks

### 3. Build lokal testen (optional, aber empfohlen)

Vor dem Deployment sollten Sie einen Production-Build testen:

```bash
# Production-Build erstellen
npm run build

# Build lokal testen (falls benötigt)
npx serve out
```

Der Build-Ordner `out/` enthält alle statischen Dateien.

### 4. Änderungen committen

```bash
# Status überprüfen
git status

# Dateien stagen
git add .

# Committen mit aussagekräftiger Message
git commit -m "Beschreibung Ihrer Änderungen"

# Optional: Pushen zu GitHub
git push
```

**Commit-Message Tipps:**
- Kurz und präzise
- Beschreiben Sie WAS und WARUM
- Beispiele:
  - `feat: Add pause button to timer`
  - `fix: Timer notification sound not playing`
  - `style: Update rainbow colors for better visibility`

### 5. Auf Firebase deployen

```bash
# Build erstellen
npm run build

# Auf Firebase Hosting deployen
firebase deploy
```

**Deployment dauert ca. 30-60 Sekunden.**

Nach erfolgreichem Deploy:
- ✅ Neue Version ist live
- ✅ URL: https://studio-4946943459-ee9a8.web.app
- ✅ Custom Domain (falls eingerichtet)

---

## 🔄 Kompletter Workflow (Schritt für Schritt)

```bash
# 1. Dev-Server starten
npm run dev

# 2. Code ändern und testen
# (Browser zeigt Änderungen automatisch)

# 3. Dev-Server stoppen (Ctrl+C)

# 4. Production-Build testen
npm run build

# 5. Git-Änderungen committen
git add .
git commit -m "Beschreibung der Änderungen"

# 6. Auf Firebase deployen
firebase deploy

# 7. Live-App testen
# Öffnen: https://studio-4946943459-ee9a8.web.app

# 8. Optional: Pushen zu GitHub
git push
```

---

## 📱 Mobile Apps (iOS/Android) updaten

Wenn Sie auch die nativen Apps aktualisieren wollen:

```bash
# Web-Build erstellen und zu Capacitor syncen
npm run build:native

# iOS App öffnen (in Xcode)
npm run ios:dev

# Android App öffnen (in Android Studio)
npm run android:dev
```

Dann in Xcode/Android Studio:
1. Build & Run auf Simulator/Gerät
2. Testen
3. Für Production archivieren/signieren

---

## 🛠️ Nützliche Commands

```bash
# Dev-Server starten
npm run dev

# Production-Build
npm run build

# Web-only Build
npm run build:web

# Native Apps Build & Sync
npm run build:native

# TypeScript-Checks
npm run typecheck

# Linting
npm run lint
```

---

## 🐛 Troubleshooting

### Build-Fehler

```bash
# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install

# Cache löschen
rm -rf .next out
npm run build
```

### Port bereits belegt

```bash
# Anderen Port verwenden
npm run dev -- -p 3000
```

### Firebase Deploy schlägt fehl

```bash
# Neu anmelden
firebase login --reauth

# Projekt-Status prüfen
firebase projects:list
```

---

## 📊 Best Practices

### ✅ Vor jedem Deployment:

1. [ ] Lokal testen (`npm run dev`)
2. [ ] Production-Build testen (`npm run build`)
3. [ ] TypeScript-Checks laufen durch (`npm run typecheck`)
4. [ ] Committen mit aussagekräftiger Message
5. [ ] Firebase deployen
6. [ ] Live-App testen

### ✅ Regelmäßig:

- Dependencies updaten: `npm update`
- Security-Checks: `npm audit`
- Git-History sauber halten (aussagekräftige Commits)

### ✅ Performance:

- Bilder optimieren (WebP nutzen)
- Icons sind bereits optimiert
- Firebase Hosting hat Caching aktiviert

---

## 🎯 Typischer Tagesablauf

**Morgens:**
```bash
git pull          # Neueste Änderungen holen
npm run dev       # Dev-Server starten
```

**Entwicklung:**
- Code schreiben
- Im Browser testen
- Iterieren

**Abends:**
```bash
npm run build     # Finalen Build testen
git add .
git commit -m "Feature XYZ fertig"
firebase deploy   # Live deployen
git push          # Auf GitHub sichern
```

---

## 🔗 Wichtige URLs

- **Dev-Server:** http://localhost:9002
- **Live-App:** https://studio-4946943459-ee9a8.web.app
- **Firebase Console:** https://console.firebase.google.com/project/studio-4946943459-ee9a8
- **GitHub:** (Ihr Repository)

---

## 📚 Weitere Ressourcen

- **Next.js Docs:** https://nextjs.org/docs
- **Firebase Hosting Docs:** https://firebase.google.com/docs/hosting
- **Capacitor Docs:** https://capacitorjs.com/docs

---

Viel Erfolg beim Entwickeln! 🎨⏱️
