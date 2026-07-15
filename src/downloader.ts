// ============================================
// kmfs v3 - Download Manager
// ============================================

import fs from 'fs';
import { createWriteStream } from 'fs';
import path from 'path';
import axios from 'axios';
import { configManager } from './config';
import { deezerClient } from './deezer';
import {
  Track,
  Album,
  Artist,
  Playlist,
  Quality,
  DownloadOptions,
} from './types';
import {
  ensureDirectoryExists,
  sanitizeFilename,
  getFileExtension,
  getQualityPriority,
  getTrackFilename,
  getAlbumFilename,
  getArtistFilename,
  getPlaylistFilename,
} from './utils';
import pLimit from 'p-limit';

interface DownloadResult {
  track: Track;
  filePath: string;
  success: boolean;
  error?: string;
  size?: number;
}

// Deezer's CDN base URL
const DEEZER_CDN_BASE = 'https://e-cdns-proxy-f.dzcdn.net';

export class Downloader {
  private concurrency: number;

  constructor() {
    this.concurrency = configManager.getConcurrency();
  }

  // ============================================
  // Main Download Methods
  // ============================================

  async downloadTrack(
    track: Track,
    options: DownloadOptions
  ): Promise<DownloadResult> {
    const qualityPriority = getQualityPriority(options.quality);
    let downloadUrl: string | null = null;
    let usedQuality: Quality | null = null;

    // Try qualities in priority order
    for (const quality of qualityPriority) {
      downloadUrl = await deezerClient.getTrackDownloadUrl(track.id, quality);
      if (downloadUrl) {
        usedQuality = quality;
        break;
      }
    }

    if (!downloadUrl || !usedQuality) {
      return {
        track,
        filePath: '',
        success: false,
        error: 'Keine Download-URL verfügbar',
      };
    }

    // Generate filename
    const filename = getTrackFilename(track, options.template);
    const sanitizedFilename = await sanitizeFilename(filename);
    const extension = getFileExtension(usedQuality);
    const filePath = path.join(options.outputPath, `${sanitizedFilename}${extension}`);

    // Create directory
    await ensureDirectoryExists(filePath);

    try {
      // Get ARL token for authentication
      const arl = configManager.getARL();
      
      // Start download with ARL token in headers
      const response = await axios.get(downloadUrl, {
        responseType: 'stream',
        headers: {
          'User-Agent': 'kmfs-v3',
          'Authorization': `Bearer ${arl}`,
          'Accept': 'audio/*',
        },
        timeout: 60000, // 60 seconds timeout
      });

      // Save file
      const writer = createWriteStream(filePath);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on('finish', () => {
          writer.close();
          resolve(null);
        });
        writer.on('error', (err: Error) => {
          writer.close();
          reject(err);
        });
      });

      // Get file size
      const stats = await fs.promises.stat(filePath);

      return {
        track,
        filePath,
        success: true,
        size: stats.size,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';
      
      // Try alternative CDN URL if first attempt fails
      if (usedQuality === 'flac') {
        // Try MP3 as fallback
        const mp3Url = `${DEEZER_CDN_BASE}/mobile/1/${track.id}.mp3`;
        try {
          const arl = configManager.getARL();
          const response = await axios.get(mp3Url, {
            responseType: 'stream',
            headers: {
              'User-Agent': 'kmfs-v3',
              'Authorization': `Bearer ${arl}`,
              'Accept': 'audio/*',
            },
            timeout: 60000,
          });

          const writer = createWriteStream(filePath.replace('.flac', '.mp3'));
          response.data.pipe(writer);

          await new Promise((resolve, reject) => {
            writer.on('finish', () => {
              writer.close();
              resolve(null);
            });
            writer.on('error', (err: Error) => {
              writer.close();
              reject(err);
            });
          });

          const stats = await fs.promises.stat(filePath.replace('.flac', '.mp3'));
          return {
            track,
            filePath: filePath.replace('.flac', '.mp3'),
            success: true,
            size: stats.size,
          };
        } catch {
          // Fallback failed
        }
      }

      return {
        track,
        filePath,
        success: false,
        error: errorMessage,
      };
    }
  }

  async downloadAlbum(
    album: Album,
    options: DownloadOptions
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const limit = pLimit(this.concurrency);

    const albumPath = getAlbumFilename(album, options.template);
    const albumOutputPath = path.join(options.outputPath, albumPath);

    // Create album directory
    await ensureDirectoryExists(albumOutputPath);

    // Options for individual tracks
    const trackOptions: DownloadOptions = {
      ...options,
      outputPath: albumOutputPath,
    };

    const promises = album.tracks.map((track) =>
      limit(() => this.downloadTrack(track, trackOptions))
    );

    const downloadResults = await Promise.all(promises);
    results.push(...downloadResults);

    return results;
  }

  async downloadArtist(
    artist: Artist,
    options: DownloadOptions,
    includeAlbums: boolean = true
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];

    if (includeAlbums && (artist as any).albums) {
      // Download all albums
      for (const album of (artist as any).albums) {
        const albumResults = await this.downloadAlbum(album, options);
        results.push(...albumResults);
      }
    } else if ((artist as any).tracks) {
      // Download all tracks directly
      const limit = pLimit(this.concurrency);

      const artistPath = getArtistFilename(artist, options.template);
      const artistOutputPath = path.join(options.outputPath, artistPath);

      await ensureDirectoryExists(artistOutputPath);

      const trackOptions: DownloadOptions = {
        ...options,
        outputPath: artistOutputPath,
      };

      const promises = (artist as any).tracks.map((track: Track) =>
        limit(() => this.downloadTrack(track, trackOptions))
      );

      const downloadResults = await Promise.all(promises);
      results.push(...downloadResults);
    }

    return results;
  }

  async downloadPlaylist(
    playlist: Playlist,
    options: DownloadOptions
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const limit = pLimit(this.concurrency);

    const playlistPath = getPlaylistFilename(playlist, options.template);
    const playlistOutputPath = path.join(options.outputPath, playlistPath);

    // Create playlist directory
    await ensureDirectoryExists(playlistOutputPath);

    // Options for individual tracks
    const trackOptions: DownloadOptions = {
      ...options,
      outputPath: playlistOutputPath,
    };

    const promises = playlist.tracks.map((track) =>
      limit(() => this.downloadTrack(track, trackOptions))
    );

    const downloadResults = await Promise.all(promises);
    results.push(...downloadResults);

    return results;
  }

  // ============================================
  // Batch Download Methods
  // ============================================

  async downloadTracks(
    tracks: Track[],
    options: DownloadOptions
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];
    const limit = pLimit(this.concurrency);

    const promises = tracks.map((track) =>
      limit(() => this.downloadTrack(track, options))
    );

    const downloadResults = await Promise.all(promises);
    results.push(...downloadResults);

    return results;
  }

  async downloadAlbums(
    albums: Album[],
    options: DownloadOptions
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];

    for (const album of albums) {
      const albumResults = await this.downloadAlbum(album, options);
      results.push(...albumResults);
    }

    return results;
  }

  async downloadPlaylists(
    playlists: Playlist[],
    options: DownloadOptions
  ): Promise<DownloadResult[]> {
    const results: DownloadResult[] = [];

    for (const playlist of playlists) {
      const playlistResults = await this.downloadPlaylist(playlist, options);
      results.push(...playlistResults);
    }

    return results;
  }
}

export const downloader = new Downloader();
