// ============================================
// kmfs v3 - Type Definitions
// ============================================

export interface Config {
  concurrency: number;
  saveLayout: {
    track: string;
    album: string;
    artist: string;
    playlist: string;
  };
  fallbackQuality: boolean;
  coverSize: {
    "128": number;
    "320": number;
    flac: number;
  };
  cookies: {
    arl: string;
  };
  downloadPath?: string; // Optional, wird zur Laufzeit gesetzt
}

export interface Track {
  id: string;
  title: string;
  artist: {
    id: string;
    name: string;
  };
  album: {
    id: string;
    title: string;
    cover?: string;
  };
  duration: number;
  quality: {
    flac?: string;
    mp3_320?: string;
    mp3_128?: string;
  };
  releaseDate?: string;
}

export interface Album {
  id: string;
  title: string;
  artist: {
    id: string;
    name: string;
  };
  tracks: Track[];
  releaseDate?: string;
  cover?: string;
}

export interface Artist {
  id: string;
  name: string;
  albums?: Album[];
  topTracks?: Track[];
}

export interface Playlist {
  id: string;
  title: string;
  creator?: {
    id: string;
    name: string;
  };
  tracks: Track[];
}

export type Quality = '128' | '320' | 'flac';

export interface DownloadOptions {
  quality: Quality;
  outputPath: string;
  template: string;
  coverSize?: number;
}

export interface SearchOptions {
  query: string;
  type: 'artist' | 'album' | 'track' | 'playlist';
  year?: number; // Optional: Release-Jahr Filter
  limit?: number;
}

export interface CLIArguments {
  quality?: Quality;
  arl?: string;
  search?: string;
  year?: number;
  help?: boolean;
  version?: boolean;
}
