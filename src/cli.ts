// ============================================
// kmfs v3 - CLI Interface (Interactive Mode)
// ============================================

import chalk from 'chalk';
import figlet from 'figlet';
import readline from 'readline';
import { configManager } from './config';
import { deezerClient } from './deezer';
import { downloader } from './downloader';
import {
  Track,
  Album,
  Artist,
  Playlist,
  Quality,
} from './types';
import { isDeezerUrl } from './utils';

// ============================================
// CLI State
// ============================================

interface CLIState {
  quality: Quality;
  outputPath: string;
  selectedItems: Set<string>;
  currentResults: Array<{ id: string; [key: string]: any }>;
  currentType: 'track' | 'album' | 'playlist' | 'artist' | 'mixed';
  inSelectionMode: boolean;
  selectionIndex: number;
}

const state: CLIState = {
  quality: 'flac',
  outputPath: process.cwd(),
  selectedItems: new Set(),
  currentResults: [],
  currentType: 'mixed',
  inSelectionMode: false,
  selectionIndex: 0,
};

// ============================================
// Readline Interface
// ============================================

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  completer: lineCompleter,
});

function lineCompleter(line: string): [string[], string] {
  const commands = [
    'ARTIST:',
    'ALBUM:',
    'TRACK:',
    'PLAYLIST:',
    'exit',
    'quit',
    'clear',
    'help',
    'quality',
    'path',
    'arl',
  ];

  const hits = commands.filter((c) => c.startsWith(line.toUpperCase()));
  return [hits.length ? hits : commands, line];
}

// ============================================
// CLI Constants
// ============================================

const HEADER = chalk.bold(
  figlet.textSync('kmfs v3', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default',
    width: 80,
    whitespaceBreak: true,
  })
);

const HELP_TEXT = `
${chalk.bold('📖 BEFEHLE')}

${chalk.cyan('SUCHE:')}
  ${chalk.yellow('ARTIST:')} <Name|ID>     - Künstler suchen
  ${chalk.yellow('ALBUM:')} <Name|ID>      - Album suchen
  ${chalk.yellow('TRACK:')} <Name|ID>      - Track suchen
  ${chalk.yellow('PLAYLIST:')} <Name|URL|ID> - Playlist suchen

${chalk.cyan('URL:')}
  Einfache Deezer-URLs werden automatisch erkannt
  Beispiel: ${chalk.green('https://www.deezer.com/de/artist/12345')}

${chalk.cyan('AUSWAHL (nach Suche):')}
  ${chalk.green('1-9')}   - Nummer eingeben zum Markieren
  ${chalk.green('a')}     - Alle markieren
  ${chalk.green('d')}     - Markierte herunterladen
  ${chalk.green('c')}     - Abbrechen (zurück zur Eingabe)

${chalk.cyan('EINSTELLUNGEN:')}
  ${chalk.yellow('quality')} <flac|320|128> - Qualität ändern
  ${chalk.yellow('path')} <pfad>          - Speicherort ändern
  ${chalk.yellow('arl')} <token>          - ARL Token setzen

${chalk.cyan('SONSTIGES:')}
  ${chalk.yellow('help')}    - Diese Hilfe anzeigen
  ${chalk.yellow('clear')}   - Bildschirm löschen
  ${chalk.yellow('exit')}    - Beenden
  ${chalk.yellow('quit')}    - Beenden
`;

// ============================================
// CLI Helper Functions
// ============================================

function printHeader(): void {
  console.log(chalk.magenta(HEADER));
  console.log(chalk.gray('═'.repeat(80)));
}

function printPrompt(): void {
  process.stdout.write(chalk.cyan('\nkmfs> '));
}

function printInfo(message: string): void {
  console.log(chalk.blue('ℹ️  ') + message);
}

function printSuccess(message: string): void {
  console.log(chalk.green('✅ ') + message);
}

function printWarning(message: string): void {
  console.log(chalk.yellow('⚠️  ') + message);
}

function printError(message: string): void {
  console.log(chalk.red('❌ ') + message);
}

function clearScreen(): void {
  console.log('\x1Bc');
  printHeader();
  printInfo(`Aktuelle Qualität: ${chalk.green(state.quality)} | Speicherort: ${chalk.green(state.outputPath)}`);
}

function formatTrack(track: Track, index: number, selected: boolean): string {
  const marker = selected ? chalk.green('✓') : chalk.gray('⊠');
  const prefix = `${marker} ${index + 1}.`;
  return `${prefix} ${chalk.cyan(track.title.padEnd(35))} ${chalk.white(track.artist.name.padEnd(20))} ${chalk.gray(track.album.title)}`;
}

function formatAlbum(album: Album, index: number, selected: boolean): string {
  const marker = selected ? chalk.green('✓') : chalk.gray('⊠');
  const prefix = `${marker} ${index + 1}.`;
  return `${prefix} ${chalk.cyan(album.title.padEnd(35))} ${chalk.white(album.artist.name.padEnd(20))} ${chalk.gray(album.releaseDate?.split('-')[0] || '')}`;
}

function formatPlaylist(playlist: Playlist, index: number, selected: boolean): string {
  const marker = selected ? chalk.green('✓') : chalk.gray('⊠');
  const prefix = `${marker} ${index + 1}.`;
  return `${prefix} ${chalk.cyan(playlist.title.padEnd(35))} ${chalk.white(playlist.creator?.name || 'Unknown')}`;
}

function formatArtist(artist: Artist, index: number, selected: boolean): string {
  const marker = selected ? chalk.green('✓') : chalk.gray('⊠');
  const prefix = `${marker} ${index + 1}.`;
  return `${prefix} ${chalk.cyan(artist.name)}`;
}

// ============================================
// Selection Management
// ============================================

function isSelected(id: string): boolean {
  return state.selectedItems.has(id);
}

function toggleSelection(id: string): void {
  if (state.selectedItems.has(id)) {
    state.selectedItems.delete(id);
  } else {
    state.selectedItems.add(id);
  }
}

function selectAll(): void {
  state.currentResults.forEach((item) => {
    if (item && item.id) {
      state.selectedItems.add(item.id);
    }
  });
}

function clearSelection(): void {
  state.selectedItems.clear();
}

function getSelectedCount(): number {
  return state.selectedItems.size;
}

// ============================================
// Display Results
// ============================================

function displayResults(results: Array<{ id: string; [key: string]: any }>, type: 'track' | 'album' | 'playlist' | 'artist' | 'mixed'): void {
  state.currentResults = results;
  state.currentType = type;
  clearSelection();

  if (results.length === 0) {
    printWarning('Keine Ergebnisse gefunden');
    return;
  }

  console.log(chalk.bold(`\n📋 ${results.length} Ergebnisse gefunden:`));
  console.log(chalk.gray('-'.repeat(80)));

  results.forEach((item: any, index: number) => {
    if (!item || !item.id) return;
    
    if (type === 'track' || (type === 'mixed' && 'duration' in item)) {
      console.log(formatTrack(item, index, false));
    } else if (type === 'album' || (type === 'mixed' && 'tracks' in item)) {
      console.log(formatAlbum(item, index, false));
    } else if (type === 'playlist' || (type === 'mixed' && 'creator' in item)) {
      console.log(formatPlaylist(item, index, false));
    } else if (type === 'artist' || (type === 'mixed' && 'name' in item && !('tracks' in item) && !('creator' in item))) {
      console.log(formatArtist(item, index, false));
    }
  });

  console.log(chalk.gray('-'.repeat(80)));
  console.log(chalk.yellow('💡 Auswahl:') + ' ' + chalk.green('1-9') + ' markieren, ' + chalk.green('a') + ' alle, ' + chalk.green('d') + ' download, ' + chalk.green('c') + ' abbrechen');
}

function displaySelection(): void {
  console.log('\x1B[2J\x1B[H'); // Clear screen
  printHeader();
  printInfo(`Aktuelle Qualität: ${chalk.green(state.quality)} | Speicherort: ${chalk.green(state.outputPath)} | ${chalk.green(getSelectedCount() + ' markiert')}`);

  if (state.currentResults.length === 0) {
    printWarning('Keine Ergebnisse zum Anzeigen');
    state.inSelectionMode = false;
    printPrompt();
    return;
  }

  console.log(chalk.bold(`\n📋 ${state.currentResults.length} Ergebnisse:`));
  console.log(chalk.gray('-'.repeat(80)));

  state.currentResults.forEach((item: any, index: number) => {
    if (!item || !item.id) return;
    
    const isSelectedMark = state.selectedItems.has(item.id);
    const marker = isSelectedMark ? chalk.green('✓') : chalk.gray('⊠');
    const prefix = `${marker} ${index + 1}.`;

    if (state.currentType === 'track' || ('duration' in item)) {
      console.log(`${prefix} ${chalk.cyan(item.title.padEnd(35))} ${chalk.white(item.artist.name.padEnd(20))} ${chalk.gray(item.album.title)}`);
    } else if (state.currentType === 'album' || ('tracks' in item)) {
      console.log(`${prefix} ${chalk.cyan(item.title.padEnd(35))} ${chalk.white(item.artist.name.padEnd(20))} ${chalk.gray(item.releaseDate?.split('-')[0] || '')}`);
    } else if (state.currentType === 'playlist' || ('creator' in item)) {
      console.log(`${prefix} ${chalk.cyan(item.title.padEnd(35))} ${chalk.white(item.creator?.name || 'Unknown')}`);
    } else if (state.currentType === 'artist' || ('name' in item && !('tracks' in item) && !('creator' in item))) {
      console.log(`${prefix} ${chalk.cyan(item.name)}`);
    }
  });

  console.log(chalk.gray('-'.repeat(80)));
  console.log(chalk.yellow('💡 Auswahl:') + ' ' + chalk.green('1-9') + ' markieren, ' + chalk.green('a') + ' alle, ' + chalk.green('d') + ' download, ' + chalk.green('c') + ' abbrechen');
  printPrompt();
}

function enterSelectionMode(): void {
  state.inSelectionMode = true;
  displaySelection();
}

function exitSelectionMode(): void {
  state.inSelectionMode = false;
  clearSelection();
  clearScreen();
  printPrompt();
}

// ============================================
// Search & Resolution Functions
// ============================================

interface ResolvedResult {
  type: 'track' | 'album' | 'artist' | 'playlist' | 'mixed';
  data: Array<{ id: string; [key: string]: any }>;
}

async function resolveInput(input: string): Promise<ResolvedResult | null> {
  if (!input || input.trim() === '') {
    return null;
  }

  const trimmedInput = input.trim();

  // Check for commands
  if (trimmedInput.toLowerCase() === 'help') {
    console.log(HELP_TEXT);
    return null;
  }

  if (trimmedInput.toLowerCase() === 'clear') {
    clearScreen();
    return null;
  }

  if (trimmedInput.toLowerCase() === 'exit' || trimmedInput.toLowerCase() === 'quit') {
    printInfo('Beende kmfs v3...');
    rl.close();
    process.exit(0);
  }

  // Check for settings
  if (trimmedInput.toLowerCase().startsWith('quality ')) {
    const quality = trimmedInput.split(' ')[1] as Quality;
    if (['flac', '320', '128'].includes(quality)) {
      state.quality = quality;
      printSuccess(`Qualität geändert auf: ${chalk.green(quality)}`);
    } else {
      printError('Ungültige Qualität. Nutze: flac, 320 oder 128');
    }
    return null;
  }

  if (trimmedInput.toLowerCase().startsWith('path ')) {
    const newPath = trimmedInput.split(' ').slice(1).join(' ');
    state.outputPath = newPath;
    printSuccess(`Speicherort geändert auf: ${chalk.green(newPath)}`);
    return null;
  }

  if (trimmedInput.toLowerCase().startsWith('arl ')) {
    const arl = trimmedInput.split(' ').slice(1).join(' ');
    await configManager.setARL(arl);
    printSuccess(`ARL Token gespeichert: ${chalk.green(arl.substring(0, 10))}...`);
    return null;
  }

  // Parse search commands
  const searchType = trimmedInput.split(':')[0].toLowerCase();
  const searchQuery = trimmedInput.split(':').slice(1).join(':').trim();

  // Check if it's a URL or ID
  if (isDeezerUrl(trimmedInput) || trimmedInput.match(/^\d+$/)) {
    const parsed = deezerClient.parseDeezerUrl(trimmedInput);
    if (parsed) {
      const { type, id } = parsed;

      try {
        switch (type) {
          case 'track':
            const track = await deezerClient.getTrackById(id);
            if (!track || !track.id) {
              printError('Track nicht gefunden');
              return null;
            }
            return { type: 'track', data: [track] };

          case 'album':
            const album = await deezerClient.getAlbumById(id);
            if (!album || !album.id) {
              printError('Album nicht gefunden');
              return null;
            }
            const albumTracks = await deezerClient.getAlbumTracks(id);
            (album as Album).tracks = albumTracks;
            return { type: 'album', data: [album as Album] };

          case 'artist':
            const artist = await deezerClient.getArtistById(id);
            if (!artist || !artist.id) {
              printError('Künstler nicht gefunden');
              return null;
            }
            const artistAlbums = await deezerClient.getArtistAlbums(id);
            const allTracks: Track[] = [];
            for (const album of artistAlbums) {
              const tracks = await deezerClient.getAlbumTracks(album.id);
              allTracks.push(...tracks);
            }
            return { type: 'artist', data: [{ ...artist, tracks: allTracks } as Artist & { tracks: Track[] }] };

          case 'playlist':
            const playlist = await deezerClient.getPlaylistById(id);
            if (!playlist || !playlist.id) {
              printError('Playlist nicht gefunden');
              return null;
            }
            return { type: 'playlist', data: [playlist] };

          default:
            printError('Unbekannter Typ');
            return null;
        }
      } catch (error: any) {
        printError(`Fehler beim Laden: ${error.message || error}`);
        return null;
      }
    }
  }

  // Search by query
  if (searchQuery && ['artist', 'album', 'track', 'playlist'].includes(searchType)) {
    try {
      const type = searchType as 'artist' | 'album' | 'track' | 'playlist';
      const results = (await deezerClient.search({
        query: searchQuery,
        type,
        limit: 20,
      })) as any;

      // Filter out any undefined or invalid results
      const validResults = results.filter((r: any) => r && r.id);
      
      if (validResults.length === 0) {
        printWarning('Keine gültigen Ergebnisse gefunden');
        return null;
      }

      return { type, data: validResults };
    } catch (error: any) {
      printError(`Suche fehlgeschlagen: ${error.message || error}`);
      return null;
    }
  }

  // Default: search for everything
  try {
    const [artists, albums, tracks, playlists] = await Promise.all([
      deezerClient.search({ query: trimmedInput, type: 'artist', limit: 5 }),
      deezerClient.search({ query: trimmedInput, type: 'album', limit: 5 }),
      deezerClient.search({ query: trimmedInput, type: 'track', limit: 5 }),
      deezerClient.search({ query: trimmedInput, type: 'playlist', limit: 5 }),
    ]);

    // Filter and combine results
    const results = [
      ...(artists as any[]).filter(r => r && r.id),
      ...(albums as any[]).filter(r => r && r.id),
      ...(tracks as any[]).filter(r => r && r.id),
      ...(playlists as any[]).filter(r => r && r.id),
    ];

    if (results.length === 0) {
      printWarning('Keine Ergebnisse gefunden');
      return null;
    }

    return { type: 'mixed', data: results };
  } catch (error: any) {
    printError(`Suche fehlgeschlagen: ${error.message || error}`);
    return null;
  }
}

// ============================================
// Download Functions
// ============================================

async function downloadSelectedItems(): Promise<void> {
  if (state.selectedItems.size === 0) {
    printWarning('Keine Elemente zum Herunterladen markiert');
    return;
  }

  const selectedIds = Array.from(state.selectedItems);
  const itemsToDownload: Track[] = [];

  // Collect all tracks from selected items
  for (const id of selectedIds) {
    const item = state.currentResults.find((i) => i && i.id === id);
    if (item) {
      if ('duration' in item) {
        // Direct track
        itemsToDownload.push(item as Track);
      } else if ('tracks' in item) {
        // Album or Playlist - add all tracks
        const tracks = (item as Album | Playlist).tracks;
        if (tracks && Array.isArray(tracks)) {
          itemsToDownload.push(...tracks.filter((t: any) => t && t.id));
        }
      } else if ('name' in item && !('tracks' in item) && !('creator' in item)) {
        // Artist
        const artist = item as Artist;
        if ((artist as any).tracks) {
          itemsToDownload.push(...(artist as any).tracks.filter((t: any) => t && t.id));
        }
      }
    }
  }

  if (itemsToDownload.length === 0) {
    printWarning('Keine Tracks zum Herunterladen gefunden');
    return;
  }

  printInfo(`🚀 Starte Download von ${itemsToDownload.length} Tracks...`);

  const template = configManager.getTemplate('track');
  const options = {
    quality: state.quality,
    outputPath: state.outputPath,
    template,
    coverSize: configManager.getCoverSize(state.quality),
  };

  try {
    const results = await downloader.downloadTracks(itemsToDownload, options);

    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        printWarning(`Fehler: ${result.track.title}: ${result.error}`);
      }
    }

    printSuccess(`✅ ${successCount} Tracks erfolgreich heruntergeladen` + (errorCount > 0 ? ` (${errorCount} Fehler)` : ''));
    
    // Clear selection after download
    clearSelection();
    exitSelectionMode();
  } catch (error: any) {
    printError(`Download fehlgeschlagen: ${error.message || error}`);
    exitSelectionMode();
  }
}

// ============================================
// Main Interactive Loop
// ============================================

async function startInteractiveMode(): Promise<void> {
  // Load config
  await configManager.load();

  // Check ARL
  if (!configManager.getARL()) {
    console.log(HELP_TEXT);
    printWarning('⚠️  ARL Token nicht gesetzt. Bitte mit: arl <DEIN_TOKEN>');
  }

  clearScreen();
  printPrompt();

  rl.on('line', async (input) => {
    try {
      // Handle empty input
      if (!input.trim()) {
        if (!state.inSelectionMode) {
          printPrompt();
        }
        return;
      }

      // Check if we're in selection mode
      if (state.inSelectionMode) {
        handleSelectionInput(input);
        return;
      }

      // Resolve input
      const resolved = await resolveInput(input);

      if (resolved) {
        const { type, data } = resolved;
        
        if (data.length === 1) {
          // Single result - download directly
          const item = data[0];
          
          if (!item || !item.id) {
            printError('Ungültiges Element');
            printPrompt();
            return;
          }
          
          if ('duration' in item) {
            // Single track
            state.selectedItems.add(item.id);
            await downloadSelectedItems();
          } else if ('tracks' in item) {
            // Album or Playlist - show tracks for selection
            const tracks = (item as Album | Playlist).tracks;
            if (tracks && Array.isArray(tracks) && tracks.length > 0) {
              state.currentResults = tracks.filter((t: any) => t && t.id);
              state.currentType = 'track';
              enterSelectionMode();
            } else {
              printWarning('Keine Tracks in diesem Element gefunden');
              printPrompt();
            }
          } else if ('name' in item && !('tracks' in item) && !('creator' in item)) {
            // Artist - show all tracks
            const allTracks = (item as any).tracks || [];
            if (allTracks.length > 0) {
              state.currentResults = allTracks.filter((t: any) => t && t.id);
              state.currentType = 'track';
              enterSelectionMode();
            } else {
              // Need to fetch tracks
              const artist = item as Artist;
              const artistAlbums = await deezerClient.getArtistAlbums(artist.id);
              const allArtistTracks: Track[] = [];
              for (const album of artistAlbums) {
                const tracks = await deezerClient.getAlbumTracks(album.id);
                allArtistTracks.push(...tracks);
              }
              state.currentResults = allArtistTracks.filter((t: Track) => t && t.id);
              state.currentType = 'track';
              enterSelectionMode();
            }
          }
        } else {
          // Multiple results - enter selection mode
          displayResults(data, type);
          enterSelectionMode();
        }
      }

      // If not in selection mode, show prompt
      if (!state.inSelectionMode) {
        printPrompt();
      }
    } catch (error: any) {
      printError(`Fehler: ${error.message || error}`);
      if (!state.inSelectionMode) {
        printPrompt();
      }
    }
  });

  rl.on('close', () => {
    printInfo('Auf Wiedersehen! 👋');
    process.exit(0);
  });
}

function handleSelectionInput(input: string): void {
  const lowerInput = input.toLowerCase();

  switch (lowerInput) {
    case 'a':
      selectAll();
      displaySelection();
      break;

    case 'd':
      downloadSelectedItems();
      break;

    case 'c':
      exitSelectionMode();
      break;

    default:
      // Check for number input
      const num = parseInt(input);
      if (!isNaN(num) && num > 0 && num <= state.currentResults.length) {
        const item = state.currentResults[num - 1];
        if (item && item.id) {
          toggleSelection(item.id);
          displaySelection();
        }
      } else {
        printError('Ungültige Eingabe. Nutze: 1-9 (markieren), a (alle), d (download), c (abbrechen)');
        displaySelection();
      }
      break;
  }
}

// ============================================
// Main Entry Point
// ============================================

export async function runCLI(args: string[]): Promise<void> {
  // Check for initial ARL argument
  if (args.length > 0 && args[0] === '-a' && args[1]) {
    await configManager.setARL(args[1]);
    printSuccess(`ARL Token gespeichert: ${chalk.green(args[1].substring(0, 10))}...`);
    process.exit(0);
  }

  if (args.length > 0 && (args[0] === '--help' || args[0] === '-h')) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  if (args.length > 0 && (args[0] === '--version' || args[0] === '-v')) {
    console.log(chalk.bold('kmfs v3.0.0'));
    process.exit(0);
  }

  // Start interactive mode
  printHeader();
  printInfo('Willkommen bei kmfs v3! Tippe "help" für alle Befehle.');
  
  // Start interactive loop
  await startInteractiveMode();
}

export default runCLI;
