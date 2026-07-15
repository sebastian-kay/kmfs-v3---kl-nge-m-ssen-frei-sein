# 🚀 Erster Start - kmfs v3

Herzlichen Glückwunsch zu deiner neuen kmfs v3 Installation! Hier ist eine kurze Anleitung für den ersten Start.

## 1️⃣ ARL Token besorgen

Um kmfs v3 zu nutzen, benötigst du dein **Deezer Premium ARL Token**. So bekommst du es:

### Methode 1: Über Browser (empfohlen)
1. Öffne Deezer in deinem Browser und melde dich an
2. Öffne die Entwicklertools (F12 oder Rechtsklick → "Untersuchen")
3. Gehe zum Tab "Application" → "Cookies"
4. Suche nach dem Cookie namens `arl`
5. Kopiere den Wert (beginnt meist mit Zahlen und Buchstaben)

### Methode 2: Über Mobile App
1. Öffne die Deezer App auf deinem Handy
2. Aktiviere den Flugmodus
3. Versuche einen Song abzuspielen - es erscheint ein Fehler
4. In der Fehler-URL findest du das ARL Token

## 2️⃣ ARL Token speichern

Führe folgenden Befehl aus, um dein ARL Token zu speichern:

```bash
kmfs -a "DEIN_ARL_TOKEN_HIER"
```

Beispiel:
```bash
kmfs -a "49abcdef1234567890abcdef1234567890"
```

Das Token wird in der `config.json` gespeichert.

## 3️⃣ Ersten Download starten

### Einfache Suche:
```bash
kmfs "ARTIST: Drake"
```

### Mit Qualität:
```bash
kmfs -q flac "ALBUM: Views"
```

### Mit Jahr-Filter:
```bash
kmfs -q 320 "ALBUM: Thriller" --year 1982
```

### Playlist herunterladen:
```bash
kmfs "PLAYLIST: https://www.deezer.com/de/playlist/123456789"
```

## 4️⃣ Interaktive Auswahl

Wenn mehrere Ergebnisse gefunden werden:
- Du siehst eine Liste mit allen gefundenen Elementen
- Wähle mit den Pfeiltasten ein Element aus
- Oder wähle "✅ Alle auswählen" für Batch-Download
- Bestätige mit Enter

## 5️⃣ Speicherort

Beim ersten Start wirst du gefragt:
```
📁 Speicherort für diese Session: /pfad/zum/aktuellen/verzeichnis
```

- Drücke **Enter**, um das aktuelle Verzeichnis zu verwenden
- Oder gib einen **anderen Pfad** ein

## 💡 Tipps

### Qualitätspriorität
kmfs v3 versucht immer die beste verfügbare Qualität:
1. FLAC (wenn verfügbar)
2. 320 kbps MP3 (Fallback)
3. 128 kbps MP3 (letzter Fallback)

### Dateinamen anpassen
Du kannst die Dateistruktur in der `config.json` anpassen:
```json
"saveLayout": {
  "track": "{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})",
  "album": "{ALB_TITLE}/{ART_NAME} - {SNG_TITLE}",
  ...
}
```

### Parallelisierte Downloads
Standardmäßig werden 4 Downloads gleichzeitig durchgeführt. Du kannst dies in der `config.json` ändern:
```json
"concurrency": 8
```

## ❓ Hilfe

Für die vollständige Hilfe:
```bash
kmfs --help
```

Oder schau in die [README.md](README.md) für detaillierte Informationen.

---

**Viel Spaß mit deiner Musik! 🎧**
