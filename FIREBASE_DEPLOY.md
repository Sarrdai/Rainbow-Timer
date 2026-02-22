# Firebase Hosting Deployment Anleitung

## Was wurde geändert?

✅ Von **Firebase App Hosting** zu **Firebase Hosting** gewechselt
✅ `firebase.json` für static export konfiguriert
✅ `apphosting.yaml` entfernt
✅ Kompatibilität mit Capacitor bleibt erhalten
✅ PWA-Funktionalität bleibt vollständig erhalten

---

## Deployment Schritte

### 1. Firebase CLI installieren

Falls noch nicht installiert:

```bash
npm install -g firebase-tools
```

### 2. Bei Firebase anmelden

```bash
firebase login
```

→ Browser öffnet sich, mit Google-Konto anmelden

### 3. Firebase-Projekt initialisieren

```bash
firebase init
```

**Auswahl bei den Prompts:**

- **Features:** Nur `Hosting` auswählen (Leertaste zum Markieren, Enter zum Bestätigen)
- **Project Setup:** `Use an existing project` wählen
- **Select project:** `studio-4946943459-ee9a8` auswählen
- **Public directory:** `out` eingeben (wichtig!)
- **Configure as single-page app:** `Yes` (y)
- **Set up automatic builds with GitHub:** `No` (n)
- **File out/index.html already exists. Overwrite?** `No` (n)

### 4. App bauen

```bash
npm run build
```

→ Erstellt den `out/` Ordner mit allen statischen Dateien

### 5. Deployen

```bash
firebase deploy
```

→ App wird hochgeladen und deployed

**Ihre Web-App ist dann verfügbar unter:**
- `https://studio-4946943459-ee9a8.web.app`
- `https://studio-4946943459-ee9a8.firebaseapp.com`

---

## Custom Domain einrichten

### Schritt 1: Firebase Console öffnen

1. Gehen Sie zu: https://console.firebase.google.com/
2. Wählen Sie Ihr Projekt: `studio-4946943459-ee9a8`

### Schritt 2: Zur Hosting-Sektion

1. Im linken Menü: **Hosting** (unter "Build")
2. Klicken Sie auf **"Add custom domain"**

### Schritt 3: Domain verbinden

1. Ihre Custom Domain eingeben (z.B. `ihre-domain.com`)
2. Bestätigungsschritte folgen:
   - **DNS-Verifizierung:** TXT-Record bei Ihrem Domain-Provider hinzufügen
   - **Domain-Verbindung:** A-Records bei Ihrem Domain-Provider aktualisieren

Firebase zeigt Ihnen genau, welche DNS-Einträge Sie wo hinzufügen müssen.

### Schritt 4: Warten auf SSL-Zertifikat

- Firebase erstellt automatisch ein SSL-Zertifikat (Let's Encrypt)
- Dauert ca. 15-60 Minuten
- Status wird in Firebase Console angezeigt

---

## PWA Installation testen

Nach dem Deployment:

1. Öffnen Sie Ihre Web-App im Browser (Chrome/Edge)
2. In der Adressleiste erscheint ein **"Installieren"**-Icon
3. Klicken Sie darauf → App wird installierbar
4. Die App verhält sich wie eine native App

---

## Zukünftige Deployments

Für alle weiteren Updates:

```bash
npm run build
firebase deploy
```

Das war's! 🎉

---

## Troubleshooting

### "Firebase not found"
```bash
npm install -g firebase-tools
```

### "Permission denied"
```bash
firebase login --reauth
```

### "Build failed"
- Überprüfen Sie `npm run build` lokal
- Stellen Sie sicher, dass `out/` Ordner erstellt wurde

### Custom Domain zeigt alte Seite
- DNS-Propagierung kann bis zu 48h dauern (meist aber nur 15-30 Min)
- Cache leeren: Ctrl+Shift+R (Chrome/Edge)

---

## Unterschied: Firebase Hosting vs. App Hosting

| Feature | Firebase Hosting | Firebase App Hosting |
|---------|------------------|----------------------|
| **Typ** | Statische Files | Next.js SSR |
| **Next.js Output** | `export` | `standalone` |
| **Capacitor** | ✅ Kompatibel | ❌ Inkompatibel |
| **PWA** | ✅ Vollständig | ✅ Vollständig |
| **Custom Domain** | ✅ Ja | ✅ Ja |
| **Deploy** | Firebase CLI | Firebase Studio |
| **Ihr Setup** | ✅ **Jetzt aktiv** | ⚠️ War vorher |

---

## Fragen?

- Firebase Hosting Docs: https://firebase.google.com/docs/hosting
- Firebase CLI Reference: https://firebase.google.com/docs/cli
