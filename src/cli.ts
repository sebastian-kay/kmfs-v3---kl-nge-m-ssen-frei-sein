// ============================================
// kmfs v3 - CLI Interface
// ============================================

import chalk from 'chalk';
import figlet from 'figlet';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import inquirer from 'inquirer';
import ora from 'ora';
import path from 'path';
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
import { filterByYear, isDeezerUrl } from './utils';

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

const USAGE = `
${chalk.bold('📖 EINFACHER START')}
  ${chalk.cyan('kmfs [-q QUALITÄT] [SUCHBEFEHL]')}

${chalk.bold('🎵 QUALITÄT')}
  ${chalk.green('128')} | ${chalk.green('320')} | ${chalk.green('FLAC')}

${chalk.bold('🔍 SUCHBEFEHLE')}
  ${chalk.yellow('ARTIST:')} NAME DES INTERPRETEN | ID
  ${chalk.yellow('ALBUM:')} NAME DES ALBUMS | ID
  ${chalk.yellow('TRACK:')} NAME DES SONGS | ID
  ${chalk.yellow('PLAYLIST:')} NAME DER PLAYLIST | URL | ID

${chalk.bold('⚙️  ERSTER START')}
  ${chalk.cyan('kmfs [-a ARL]')} ${chalk.gray('- ARL Token speichern')}

${chalk.bold('💡 BEISPIELE')}
  ${chalk.cyan('kmfs -q flac "ARTIST: Drake"')}
  ${chalk.cyan('kmfs -q 320 "ALBUM: Views" --year 2016')}
  ${chalk.cyan('kmfs "PLAYLIST: https://www.deezer.com/de/playlist/12345"')}
  ${chalk.cyan('kmfs -a "mein_arl_token"')}
`;

// ============================================
// CLI Helper Functions
// ============================================

function printHeader(): void {
  console.log(chalk.magenta(HEADER));
  console.log(chalk.gray('═'.repeat(80)));
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

function formatTrackInfo(track: Track): string {
  return `${chalk.cyan(track.title)} ${chalk.gray('-')} ${chalk.white(track.artist.name)} ${chalk.gray('(' + track.album.title + ')')}`;
}

// ============================================
// Type Guards
// ============================================

function isTrack(item: any): item is Track {
  return 'duration' in item && 'album' in item;
}

function isAlbum(item: any): item is Album {
  return 'tracks' in item && 'artist' in item;
}

function isArtist(item: any): item is Artist {
  return 'name' in item && !('tracks' in item) && !('duration' in item) && !('creator' in item);
}

function isPlaylist(item: any): item is Playlist {
  return 'creator' in item && 'tracks' in item;
}

// ============================================
// Interactive Prompts
// ============================================

async function promptForARL(): Promise<string> {
  const questions = [
    {
      type: 'password',
      name: 'arl',
      message: chalk.yellow('🔑 Bitte gib dein Deezer Premium ARL Token ein:'),
      validate: (input: string) => {
        if (!input || input.length < 10) {
          return '❌ Bitte gib ein gültiges ARL Token ein (mind. 10 Zeichen)';
        }
        return true;
      },
    },
  ];

  const answers = await inquirer.prompt(questions);
  return answers.arl as string;
}

async function promptForDownloadPath(currentPath: string): Promise<string> {
  const questions = [
    {
      type: 'input',
      name: 'path',
      message: chalk.yellow(`📁 Speicherort für diese Session:`),
      default: currentPath,
    },
  ];

  const answers = await inquirer.prompt(questions);
  return (answers.path as string) || currentPath;
}

async function promptForQuality(): Promise<Quality> {
  const questions = [
    {
      type: 'list',
      name: 'quality',
      message: chalk.yellow('🎵 Wähle die Download-Qualität:'),
      choices: [
        { name: 'FLAC (Lossless)', value: 'flac' as const },
        { name: '320 kbps MP3', value: '320' as const },
        { name: '128 kbps MP3', value: '128' as const },
      ],
      default: 'flac',
    },
  ];

  const answers = await inquirer.prompt(questions);
  return answers.quality as Quality;
}

async function promptForSelection<T extends Track | Album | Artist | Playlist>(
  items: T[],
  itemToString: (item: T) => string,
  message: string
): Promise<T | null | 'ALL'> {
  if (items.length === 0) {
    printWarning('Keine Ergebnisse gefunden');
    return null;
  }

  if (items.length === 1) {
    return items[0];
  }

  const choices: Array<{ name: string; value: T | 'ALL' }> = items.map((item) => ({
    name: itemToString(item),
    value: item,
  }));

  // Füge "Alle auswählen" Option hinzu
  choices.unshift({
    name: chalk.green('✅ Alle auswählen'),
    value: 'ALL' as const,
  });

  const questions = [
    {
      type: 'list',
      name: 'selection',
      message,
      choices,
      pageSize: 20,
    },
  ];

  const answers = await inquirer.prompt(questions);
  return answers.selection as T | null | 'ALL';
}

async function promptForYear(): Promise<number | undefined> {
  const questions = [
    {
      type: 'input',
      name: 'year',
      message: chalk.yellow('📅 Release Jahr (optional, nur Jahr eingeben):'),
      validate: (input: string) => {
        if (!input) return true; // Optional
        const year = parseInt(input);
        if (isNaN(year) || year < 1900 || year > new Date().getFullYear()) {
          return '❌ Bitte gib ein gültiges Jahr ein (1900-' + new Date().getFullYear() + ')';
        }
        return true;
      },
    },
  ];

  const answers = await inquirer.prompt(questions);
  return answers.year ? parseInt(answers.year as string) : undefined;
}

// ============================================
// Search & Resolution Functions
// ============================================

interface ResolvedResult {
  type: 'track' | 'album' | 'artist' | 'playlist' | 'mixed';
  data: (Track | Album | Artist | Playlist)[];
}

async function resolveInput(
  input: string,
  year?: number
): Promise<ResolvedResult | null> {
  const spinner = ora(chalk.blue('🔍 Suche läuft...')).start();

  try {
    // Prüfe ob es eine URL ist
    if (isDeezerUrl(input)) {
      const parsed = deezerClient.parseDeezerUrl(input);
      if (!parsed) {
        spinner.fail('❌ Ungültige Deezer URL');
        return null;
      }

      const { type, id } = parsed;

      switch (type) {
        case 'track':
          const track = await deezerClient.getTrackById(id);
          spinner.succeed(chalk.green(`✅ Track gefunden: ${track.title}`));
          return { type: 'track', data: [track] };

        case 'album':
          const album = await deezerClient.getAlbumById(id);
          spinner.succeed(chalk.green(`✅ Album gefunden: ${album.title}`));
          return { type: 'album', data: [album] };

        case 'artist':
          const artist = await deezerClient.getArtistById(id);
          spinner.succeed(chalk.green(`✅ Künstler gefunden: ${artist.name}`));
          return { type: 'artist', data: [artist] };

        case 'playlist':
          const playlist = await deezerClient.getPlaylistById(id);
          spinner.succeed(chalk.green(`✅ Playlist gefunden: ${playlist.title}`));
          return { type: 'playlist', data: [playlist] };

        default:
          spinner.fail('❌ Unbekannter Typ');
          return null;
      }
    }

    // Prüfe ob es eine ID ist
    const idMatch = input.match(/^\d+$/);
    if (idMatch) {
      // Versuche als Track, Album, Artist, Playlist zu resolven
      try {
        const track = await deezerClient.getTrackById(input);
        spinner.succeed(chalk.green(`✅ Track gefunden: ${track.title}`));
        return { type: 'track', data: [track] };
      } catch {
        try {
          const album = await deezerClient.getAlbumById(input);
          spinner.succeed(chalk.green(`✅ Album gefunden: ${album.title}`));
          return { type: 'album', data: [album] };
        } catch {
          try {
            const artist = await deezerClient.getArtistById(input);
            spinner.succeed(chalk.green(`✅ Künstler gefunden: ${artist.name}`));
            return { type: 'artist', data: [artist] };
          } catch {
            try {
              const playlist = await deezerClient.getPlaylistById(input);
              spinner.succeed(chalk.green(`✅ Playlist gefunden: ${playlist.title}`));
              return { type: 'playlist', data: [playlist] };
            } catch {
              spinner.fail('❌ ID nicht gefunden');
              return null;
            }
          }
        }
      }
    }

    // Suche nach Begriff
    const searchType = input.split(':')[0].toLowerCase();
    const searchQuery = input.split(':').slice(1).join(':').trim();

    if (!searchQuery) {
      spinner.fail('❌ Ungültige Suchanfrage');
      return null;
    }

    let results: (Track | Album | Artist | Playlist)[] = [];
    let type: 'track' | 'album' | 'artist' | 'playlist' | 'mixed' = 'mixed';

    switch (searchType) {
      case 'artist':
        results = (await deezerClient.search({
          query: searchQuery,
          type: 'artist',
          limit: 10,
        })) as Artist[];
        type = 'artist';
        break;

      case 'album':
        results = (await deezerClient.search({
          query: searchQuery,
          type: 'album',
          limit: 10,
        })) as Album[];
        type = 'album';
        break;

      case 'track':
        results = (await deezerClient.search({
          query: searchQuery,
          type: 'track',
          limit: 10,
        })) as Track[];
        type = 'track';
        break;

      case 'playlist':
        results = (await deezerClient.search({
          query: searchQuery,
          type: 'playlist',
          limit: 10,
        })) as Playlist[];
        type = 'playlist';
        break;

      default:
        // Standard: Suche nach allem
        const [artists, albums, tracks, playlists] = await Promise.all([
          deezerClient.search({ query: input, type: 'artist', limit: 5 }),
          deezerClient.search({ query: input, type: 'album', limit: 5 }),
          deezerClient.search({ query: input, type: 'track', limit: 5 }),
          deezerClient.search({ query: input, type: 'playlist', limit: 5 }),
        ]);

        results = [
          ...(artists as Artist[]),
          ...(albums as Album[]),
          ...(tracks as Track[]),
          ...(playlists as Playlist[]),
        ];
        type = 'mixed';
    }

    if (!results || results.length === 0) {
      spinner.fail('❌ Keine Ergebnisse gefunden');
      return null;
    }

    // Filter nach Jahr wenn angegeben
    if (year) {
      const filteredResults = results.filter((item) => {
        if (isTrack(item) || isAlbum(item)) {
          const date = new Date(item.releaseDate as string);
          return date.getFullYear() === year;
        }
        return false;
      });
      if (filteredResults.length === 0) {
        spinner.fail(`❌ Keine Ergebnisse für Jahr ${year} gefunden`);
        return null;
      }
      results = filteredResults;
    }

    spinner.succeed(chalk.green(`✅ ${results.length} Ergebnisse gefunden`));
    return { type, data: results };
  } catch (error) {
    spinner.fail('❌ Fehler bei der Suche');
    console.error(error);
    return null;
  }
}

// ============================================
// Download Functions
// ============================================

async function downloadTracks(
  tracks: Track[],
  outputPath: string,
  quality: Quality
): Promise<void> {
  const spinner = ora(chalk.blue(`🎵 Lade ${tracks.length} Tracks herunter...`)).start();

  const template = configManager.getTemplate('track');
  const options = {
    quality,
    outputPath,
    template,
    coverSize: configManager.getCoverSize(quality),
  };

  try {
    const results = await downloader.downloadTracks(tracks, options);

    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.success) {
        successCount++;
        spinner.text = chalk.green(`✅ ${successCount}/${tracks.length} Tracks heruntergeladen`);
      } else {
        errorCount++;
        printWarning(`Fehler beim Download von ${result.track.title}: ${result.error}`);
      }
    }

    spinner.succeed(
      chalk.green(`✅ ${successCount} Tracks erfolgreich heruntergeladen`) +
        (errorCount > 0 ? chalk.yellow(` (${errorCount} Fehler)`) : '')
    );
  } catch (error) {
    spinner.fail('❌ Fehler beim Download');
    console.error(error);
  }
}

async function downloadAlbums(
  albums: Album[],
  outputPath: string,
  quality: Quality
): Promise<void> {
  const spinner = ora(chalk.blue(`💿 Lade ${albums.length} Alben herunter...`)).start();

  const template = configManager.getTemplate('album');
  const options = {
    quality,
    outputPath,
    template,
    coverSize: configManager.getCoverSize(quality),
  };

  try {
    const results = await downloader.downloadAlbums(albums, options);

    let successCount = 0;
    let errorCount = 0;

    for (const result of results) {
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        printWarning(`Fehler beim Download von ${result.track.title}: ${result.error}`);
      }
    }

    spinner.succeed(
      chalk.green(`✅ ${successCount} Tracks aus ${albums.length} Alben heruntergeladen`) +
        (errorCount > 0 ? chalk.yellow(` (${errorCount} Fehler)`) : '')
    );
  } catch (error) {
    spinner.fail('❌ Fehler beim Download');
    console.error(error);
  }
}

async function downloadArtists(
  artists: Artist[],
  outputPath: string,
  quality: Quality
): Promise<void> {
  const spinner = ora(chalk.blue(`👤 Lade ${artists.length} Künstler herunter...`)).start();

  const template = configManager.getTemplate('artist');
  const options = {
    quality,
    outputPath,
    template,
    coverSize: configManager.getCoverSize(quality),
  };

  try {
    for (const artist of artists) {
      spinner.text = chalk.blue(`🎵 Lade Künstler: ${artist.name}`);
      const results = await downloader.downloadArtist(artist, options, true);

      let successCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      spinner.text = chalk.green(
        `✅ ${successCount} Tracks von ${artist.name} heruntergeladen` +
          (errorCount > 0 ? chalk.yellow(` (${errorCount} Fehler)`) : '')
      );
    }

    spinner.succeed(chalk.green(`✅ Alle Künstler heruntergeladen`));
  } catch (error) {
    spinner.fail('❌ Fehler beim Download');
    console.error(error);
  }
}

async function downloadPlaylists(
  playlists: Playlist[],
  outputPath: string,
  quality: Quality
): Promise<void> {
  const spinner = ora(chalk.blue(`📋 Lade ${playlists.length} Playlists herunter...`)).start();

  const template = configManager.getTemplate('playlist');
  const options = {
    quality,
    outputPath,
    template,
    coverSize: configManager.getCoverSize(quality),
  };

  try {
    for (const playlist of playlists) {
      spinner.text = chalk.blue(`🎵 Lade Playlist: ${playlist.title}`);
      const results = await downloader.downloadPlaylist(playlist, options);

      let successCount = 0;
      let errorCount = 0;

      for (const result of results) {
        if (result.success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      spinner.text = chalk.green(
        `✅ ${successCount} Tracks aus ${playlist.title} heruntergeladen` +
          (errorCount > 0 ? chalk.yellow(` (${errorCount} Fehler)`) : '')
      );
    }

    spinner.succeed(chalk.green(`✅ Alle Playlists heruntergeladen`));
  } catch (error) {
    spinner.fail('❌ Fehler beim Download');
    console.error(error);
  }
}

// ============================================
// Main CLI Logic
// ============================================

export async function runCLI(args: string[]): Promise<void> {
  // Argument Parsing
  const argv = yargs(hideBin(args))
    .usage(USAGE)
    .option('q', {
      alias: 'quality',
      describe: 'Download-Qualität (128, 320, flac)',
      type: 'string',
      choices: ['128', '320', 'flac'],
    })
    .option('a', {
      alias: 'arl',
      describe: 'Deezer ARL Token speichern',
      type: 'string',
    })
    .option('year', {
      describe: 'Release Jahr Filter',
      type: 'number',
    })
    .option('help', {
      alias: 'h',
      describe: 'Hilfe anzeigen',
      type: 'boolean',
    })
    .option('version', {
      alias: 'v',
      describe: 'Version anzeigen',
      type: 'boolean',
    })
    .epilog('🎵 kmfs v3 - Deezer Song Downloader')
    .parseSync();

  // Header anzeigen
  printHeader();

  // Version
  if (argv.version) {
    console.log(chalk.bold('kmfs v3.0.0'));
    process.exit(0);
  }

  // Hilfe
  if (argv.help || argv._.length === 0) {
    console.log(USAGE);
    process.exit(0);
  }

  // ARL speichern
  if (argv.arl) {
    await configManager.setARL(argv.arl as string);
    printSuccess(`ARL Token gespeichert: ${(argv.arl as string).substring(0, 10)}...`);
    process.exit(0);
  }

  // Config laden
  await configManager.load();

  // Prüfe ob ARL gesetzt ist
  if (!configManager.getARL()) {
    printWarning('⚠️  ARL Token nicht gesetzt. Bitte mit kmfs -a <ARL> setzen.');
    const arl = await promptForARL();
    if (arl) {
      await configManager.setARL(arl);
      printSuccess('ARL Token gespeichert');
    } else {
      printError('ARL Token ist erforderlich');
      process.exit(1);
    }
  }

  // Qualität abfragen
  let quality: Quality = (argv.quality as Quality) || 'flac';
  if (!argv.quality) {
    quality = await promptForQuality();
  }

  // Download-Pfad abfragen
  const currentPath = process.cwd();
  printInfo(`Aktuelles Verzeichnis: ${chalk.cyan(currentPath)}`);
  const outputPath = await promptForDownloadPath(currentPath);
  await configManager.setDownloadPath(outputPath);
  printInfo(`Speicherort: ${chalk.cyan(outputPath)}`);

  // Input verarbeiten
  const input = argv._.join(' ');
  const year = argv.year || (await promptForYear());

  // Suche/Resolution
  const resolved = await resolveInput(input, year);
  if (!resolved) {
    printError('Konnte Input nicht verarbeiten');
    process.exit(1);
  }

  const { type, data } = resolved;

  // Ergebnisse anzeigen und Auswahl treffen
  let selectedItems: (Track | Album | Artist | Playlist)[] = [];

  if (type === 'mixed') {
    // Gemischte Ergebnisse - nach Typ gruppieren
    const artists = data.filter(isArtist);
    const albums = data.filter(isAlbum);
    const tracks = data.filter(isTrack);
    const playlists = data.filter(isPlaylist);

    if (artists.length > 0) {
      console.log(chalk.bold('\n👤 Künstler:'));
      artists.forEach((artist) => console.log(`  - ${artist.name}`));
    }
    if (albums.length > 0) {
      console.log(chalk.bold('\n💿 Alben:'));
      albums.forEach((album) => console.log(`  - ${album.title} (${album.artist.name})`));
    }
    if (tracks.length > 0) {
      console.log(chalk.bold('\n🎵 Tracks:'));
      tracks.forEach((track) => console.log(`  - ${track.title} (${track.artist.name})`));
    }
    if (playlists.length > 0) {
      console.log(chalk.bold('\n📋 Playlists:'));
      playlists.forEach((playlist) => console.log(`  - ${playlist.title}`));
    }

    // Auswahl treffen
    const selected = await promptForSelection(
      data,
      (item) => {
        if (isTrack(item)) return formatTrackInfo(item);
        if (isAlbum(item)) return `${item.title} (${item.artist?.name || 'Various'})`;
        if (isPlaylist(item)) return `${item.title} (Playlist)`;
        if (isArtist(item)) return item.name;
        return (item as any).name || (item as any).title;
      },
      'Wähle ein Ergebnis aus oder wähle "Alle auswählen"'
    );

    if (selected === null) {
      selectedItems = data;
    } else if (selected !== 'ALL') {
      selectedItems = [selected];
    } else {
      selectedItems = data;
    }
  } else {
    // Einfacher Typ
    selectedItems = data;

    if (selectedItems.length > 1) {
      const selected = await promptForSelection(
        selectedItems,
        (item) => {
          if (type === 'track' && isTrack(item)) return formatTrackInfo(item);
          if (type === 'album' && isAlbum(item)) return `${item.title} (${item.artist?.name || 'Various'})`;
          if (type === 'artist' && isArtist(item)) return item.name;
          if (type === 'playlist' && isPlaylist(item)) return `${item.title} (Playlist)`;
          return (item as any).name || (item as any).title;
        },
        `Wähle ein ${type} aus oder wähle "Alle auswählen"`
      );

      if (selected === null || selected === 'ALL') {
        // Alle auswählen
      } else if (selected) {
        selectedItems = [selected];
      } else {
        selectedItems = [];
      }
    }
  }

  if (selectedItems.length === 0) {
    printWarning('Keine Elemente zum Download ausgewählt');
    process.exit(0);
  }

  // Download starten
  printInfo(`🚀 Starte Download von ${selectedItems.length} Elementen...`);

  // Bestimme den Typ des ersten Elements für die Download-Funktion
  const firstItem = selectedItems[0];
  if (isTrack(firstItem)) {
    await downloadTracks(selectedItems as Track[], outputPath, quality);
  } else if (isAlbum(firstItem)) {
    await downloadAlbums(selectedItems as Album[], outputPath, quality);
  } else if (isPlaylist(firstItem)) {
    await downloadPlaylists(selectedItems as Playlist[], outputPath, quality);
  } else if (isArtist(firstItem)) {
    await downloadArtists(selectedItems as Artist[], outputPath, quality);
  }

  printSuccess('✅ Download abgeschlossen!');
}

export default runCLI;
