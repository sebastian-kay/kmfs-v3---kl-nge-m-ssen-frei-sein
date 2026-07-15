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
  downloadPath?: string;
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
  releaseDate?: string;
  quality?: {
    flac?: string;
    mp3_320?: string;
    mp3_128?: string;
  };
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
  tracks?: Track[]; // For expanded artist view
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
  year?: number;
  limit?: number;
}
