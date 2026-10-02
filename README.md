# Rainbow Timer für Pebble Round 2

Visueller Regenbogen-Timer für die Pebble Round 2 (Plattform `gabbro`, 260×260, Touch).
Gedacht, um Kindern zu zeigen, wie lange etwas noch dauert: Der Regenbogen schrumpft im
Uhrzeigersinn Richtung 12 Uhr, bis er weg ist. Konzept übernommen aus der
[Rainbow-Timer Web-App](https://github.com/Sarrdai/Rainbow-Timer).

## Bedienung

| Aktion | Touch | Buttons |
| --- | --- | --- |
| Timer aufziehen | Finger am Ziffernblatt im Kreis ziehen, loslassen startet | **Oben** / **Unten** (halten = schneller), startet nach 1,5 s automatisch |
| Schnellwahl | Zahl am Rand antippen (z. B. 15 → 15 min) | – |
| Start / Pause | Mitte antippen | **Select** kurz |
| Menü (Start/Pause, Stopp, Modus) | – | **Select** lang |
| Alarm beenden | Antippen | beliebiger Button |

## Modi

| Modus | Ziffernblatt | Aufzieh-Schritt | Aktualisierung |
| --- | --- | --- | --- |
| Minuten (Standard) | 60 min | 1 min | jede Minute |
| Stunden | 12 h | 5 min | alle 12 min (= 6°, Winkel einer Minute im 60-min-Modus) |
| Sekunden | 60 s | 1 s | jede Sekunde |

Wie in der Web-App wechselt die Anzeige automatisch auf die feinere Skala:
Stundenmodus → Minutenskala in der letzten Stunde, Minuten-/Stundenmodus → Sekundenskala
in der letzten Minute. In dieser letzten Minute füllt sich das ganze Ziffernblatt mit dem
Regenbogen (abgelaufene Zeit) und wird sekündlich aktualisiert.

Der Bildschirm wird nur zu diesen Zeitpunkten neu gezeichnet (ein `AppTimer` auf die nächste
sichtbare Änderung, kein Sekunden-Tick), um Akku zu sparen.

## Verhalten im Hintergrund

Der Timer läuft weiter, wenn die App geschlossen wird. Zum Ende startet ein Wakeup die App,
die Uhr vibriert (3×) und zeigt „Fertig!“. Pausierte Timer bleiben erhalten.

## Bauen

```sh
pebble sdk install latest
pebble build
pebble install --emulator gabbro   # oder --phone <IP>
```

## Struktur

- `src/c/main.c` – Fenster, Touch- und Button-Eingabe, Redraw-Planung, Alarm
- `src/c/timer.c` – Timer-Zustand, Modi, Update-Schritte, Persistenz, Wakeup
- `src/c/dial.c` – Zeichnen von Ziffernblatt, Regenbogen, Knopf und Mitte
- `src/c/menu.c` – Menü (Start/Pause, Stopp, Modus)
