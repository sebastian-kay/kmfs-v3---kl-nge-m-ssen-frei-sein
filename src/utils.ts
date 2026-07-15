// ============================================
// kmfs v3 - Utility Functions
// ============================================

import fs from 'fs/promises';
import path from 'path';
import { Track, Album, Artist, Playlist, Quality } from './types';
import { configManager } from './config';

// ============================================
// Template Engine
// ============================================

interface TemplateVariables {
  ART_NAME?: string;
  SNG_TITLE?: string;
  ALB_TITLE?: string;
  TITLE?: string;
  YEAR?: string;
}

export function parseTemplate(template: string, variables: TemplateVariables): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => {
    return variables[key as keyof TemplateVariables] || match;
  });
}

export function getTrackFilename(track: Track, template: string): string {
  const variables: TemplateVariables = {
    ART_NAME: track.artist.name,
    SNG_TITLE: track.title,
    ALB_TITLE: track.album.title,
    YEAR: track.releaseDate?.split('-')[0] || '',
  };
  return parseTemplate(template, variables);
}

export function getAlbumFilename(album: Album, template: string): string {
  const variables: TemplateVariables = {
    ART_NAME: album.artist.name,
    ALB_TITLE: album.title,
    YEAR: album.releaseDate?.split('-')[0] || '',
  };
  return parseTemplate(template, variables);
}

export function getArtistFilename(artist: Artist, template: string): string {
  const variables: TemplateVariables = {
    ART_NAME: artist.name,
  };
  return parseTemplate(template, variables);
}

export function getPlaylistFilename(playlist: Playlist, template: string): string {
  const variables: TemplateVariables = {
    TITLE: playlist.title,
  };
  return parseTemplate(template, variables);
}

// ============================================
// File System Utilities
// ============================================

export async function ensureDirectoryExists(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  try {
    await fs.access(dir);
  } catch {
    await fs.mkdir(dir, { recursive: true });
  }
}

export async function sanitizeFilename(filename: string): Promise<string> {
  // Entferne ungültige Zeichen für Dateinamen
  return filename
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function getFileExtension(quality: Quality): string {
  return quality === 'flac' ? '.flac' : '.mp3';
}

// ============================================
// Quality Utilities
// ============================================

export function getQualityPriority(quality: Quality): Quality[] {
  // FLAC > 320 > 128
  const priority: Quality[] = ['flac', '320', '128'];
  const index = priority.indexOf(quality);
  return priority.slice(index);
}

export function getNextQuality(current: Quality): Quality | null {
  const priority: Quality[] = ['flac', '320', '128'];
  const index = priority.indexOf(current);
  return index < priority.length - 1 ? priority[index + 1] : null;
}

// ============================================
// String Utilities
// ============================================

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ============================================
// URL Utilities
// ============================================

export function isDeezerUrl(url: string): boolean {
  return url.includes('deezer.com');
}

export function extractIdFromUrl(url: string): string | null {
  const match = url.match(/\/(\d+)(?:\/|$)/);
  return match ? match[1] : null;
}

// ============================================
// Date Utilities
// ============================================

export function getYearFromDate(dateString: string | undefined): number | null {
  if (!dateString) return null;
  const date = new Date(dateString);
  return date.getFullYear();
}

export function filterByYear<T extends { releaseDate?: string }>(
  items: T[],
  year: number
): T[] {
  return items.filter((item) => {
    const itemYear = getYearFromDate(item.releaseDate);
    return itemYear === year;
  });
}
