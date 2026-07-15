# kmfs v3 🎵

**Deezer Song Downloader CLI** - Lade Songs, Alben, Playlists und Künstler von Deezer für Offline-Hören

![kmfs v3](https://img.shields.io/badge/version-3.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/node-%3E%3D18.x-green.svg)
![License](https://img.shields.io/badge/license-MIT-orange.svg)

## 📖 Beschreibung

kmfs v3 ist eine moderne CLI-Anwendung zum Herunterladen von Musik von Deezer. Mit deinem **Deezer Premium ARL Token** kannst du Songs, Alben, Playlists und Künstler herunterladen und offline hören.

## ✨ Features

- 🎵 **Mehrere Download-Typen**: Einzelne Tracks, ganze Alben, Künstler-Diskografien oder Playlists
- 🎚️ **Qualitätsauswahl**: FLAC (Lossless), 320 kbps MP3 oder 128 kbps MP3
- 🔍 **Flexible Suche**: Nach Namen oder direkt mit Deezer-IDs/URLs
- 📅 **Jahr-Filter**: Filtere Ergebnisse nach Release-Jahr
- 🎨 **Anpassbare Dateinamen**: Templates für individuelle Dateistruktur
- 📁 **Parallelisierte Downloads**: Schnellere Downloads mit einstellbarer Concurrency
- 💾 **Konfiguration**: Speichere deine Einstellungen in `config.json`
- 🌈 **Schöne CLI**: Farbige Ausgabe mit Emojis und Ladeanimationen

## 🚀 Installation

### Voraussetzungen
- Node.js >= 18.x
- npm oder yarn
- Deezer Premium Account mit ARL Token

### Installation

```bash
# Repository klonen
git clone https://github.com/sebastian-kay/kmfs-v3---kl-nge-m-ssen-frei-sein.git
cd kmfs-v3---kl-nge-m-ssen-frei-sein

# Abhängigkeiten installieren
npm install

# Builden
npm run build

# Global installieren (optional)
npm link
```

## 📖 Verwendung

### Erster Start - ARL Token speichern

```bash
kmfs -a "DEIN_ARL_TOKEN"
```

Dein ARL Token wird in der `config.json` gespeichert.

### Einfache Suche und Download

```bash
# Track suchen und herunterladen
kmfs "ARTIST: Drake"

# Album suchen
kmfs "ALBUM: Views"

# Mit Qualität und Jahr filter
kmfs -q flac "ALBUM: Views" --year 2016

# Playlist herunterladen
kmfs "PLAYLIST: https://www.deezer.com/de/playlist/12345"

# Mit spezifischer Qualität
kmfs -q 320 "ARTIST: The Weeknd"
```

### Qualitätsoptionen
- `-q flac` - FLAC (Lossless, bevorzugt)
- `-q 320` - 320 kbps MP3
- `-q 128` - 128 kbps MP3

### Suchbefehle
- `ARTIST: Name` oder `ARTIST: ID` - Künstler suchen
- `ALBUM: Name` oder `ALBUM: ID` - Album suchen
- `TRACK: Name` oder `TRACK: ID` - Einzelnen Track suchen
- `PLAYLIST: Name` oder `PLAYLIST: URL/ID` - Playlist suchen

### Interaktive Auswahl

Wenn mehrere Ergebnisse gefunden werden, kannst du interaktiv auswählen:
- Einzelne Elemente auswählen
- "Alle auswählen" für Batch-Download

### Speicherort

Beim Start wird das aktuelle Verzeichnis als Speicherort vorgeschlagen. Du kannst:
- Mit Enter bestätigen
- Einen anderen Pfad eingeben

## ⚙️ Konfiguration

Die `config.json` enthält alle Einstellungen:

```json
{
  "concurrency": 4,
  "saveLayout": {
    "track": "{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})",
    "album": "{ALB_TITLE}/{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})",
    "artist": "{ART_NAME} - {ALB_TITLE}/{ART_NAME} - {SNG_TITLE}",
    "playlist": "Playlist/{TITLE}/{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})"
  },
  "fallbackQuality": true,
  "coverSize": {
    "128": 500,
    "320": 500,
    "flac": 500
  },
  "cookies": {
    "arl": "DEIN_ARL_TOKEN"
  }
}
```

### Template-Variablen

| Variable | Beschreibung | Verfügbar für |
|----------|--------------|---------------|
| `{ART_NAME}` | Künstlername | track, album, artist, playlist |
| `{SNG_TITLE}` | Track-Titel | track, album, artist, playlist |
| `{ALB_TITLE}` | Album-Titel | track, album, artist |
| `{TITLE}` | Playlist-Titel | playlist |
| `{YEAR}` | Release-Jahr | track, album |

## 📦 Beispiele

### Beispiel 1: Künstler-Diskografie herunterladen
```bash
kmfs -q flac "ARTIST: Drake"
```

### Beispiel 2: Spezifisches Album mit Jahr-Filter
```bash
kmfs -q 320 "ALBUM: Thriller" --year 1982
```

### Beispiel 3: Playlist von URL
```bash
kmfs "PLAYLIST: https://www.deezer.com/de/playlist/123456789"
```

### Beispiel 4: Mit Künstler-ID (präziser)
```bash
kmfs "ARTIST: 12345"
```

## 🎨 CLI-Interface

kmfs v3 bietet ein farbenfrohes CLI-Interface mit:
- 🎨 **Farben** - Unterschiedliche Farben für verschiedene Informationen
- 🎭 **Emojis** - Visuelle Unterstützung
- 🌀 **Ladeanimationen** - Fortschrittsanzeige
- ✨ **ASCII-Art Header** - Schönes Logo beim Start

## 🔧 Technische Details

### Architektur
- **TypeScript** - Typsichere Entwicklung
- **Axios** - HTTP-Requests an Deezer API
- **Chalk** - Farbige Konsolenausgabe
- **Figlet** - ASCII-Art Header
- **Inquirer** - Interaktive Eingaben
- **Ora** - Ladeanimationen
- **p-limit** - Concurrency-Control für parallele Downloads

### Deezer API
Die Anwendung nutzt die offizielle Deezer API mit ARL-Token-Authentifizierung.

## 📝 Changelog

### v3.0.0 (2024)
- Komplett neu geschrieben in TypeScript
- Neue CLI mit interaktiven Features
- Unterstützung für Playlists
- Jahr-Filter für präzisere Suche
- Verbesserte Template-Engine
- Parallelisierte Downloads
- Schöne farbige Ausgabe

## 🤝 Mitwirken

Pull Requests sind willkommen! Bitte halte dich an den bestehenden Code-Stil.

## 📄 Lizenz

MIT License - Siehe [LICENSE](LICENSE) für Details.

## 🙏 Danke

- An die Deezer Community für die API-Dokumentation
- An alle Mitwirkenden und Nutzer

---

**Genieße deine Musik offline! 🎧**
