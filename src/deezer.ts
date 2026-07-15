// ============================================
// kmfs v3 - Deezer API Client
// ============================================

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { configManager } from './config';
import {
  Track,
  Album,
  Artist,
  Playlist,
  SearchOptions,
  Quality,
} from './types';

interface DeezerAPIResponse<T> {
  data: T;
}

interface DeezerTrack {
  id: string;
  title: string;
  duration: number;
  artist: {
    id: string;
    name: string;
  };
  album: {
    id: string;
    title: string;
    cover_big?: string;
  };
  release_date?: string;
}

interface DeezerAlbum {
  id: string;
  title: string;
  artist: {
    id: string;
    name: string;
  };
  tracks: {
    data: DeezerTrack[];
  };
  release_date?: string;
  cover_big?: string;
}

interface DeezerArtist {
  id: string;
  name: string;
}

interface DeezerPlaylist {
  id: string;
  title: string;
  creator: {
    id: string;
    name: string;
  };
  tracks: {
    data: DeezerTrack[];
  };
}

// Deezer's CDN endpoints
const DEEZER_API_BASE = 'https://api.deezer.com';
const DEEZER_CDN_BASE = 'https://e-cdns-proxy-f.dzcdn.net';

export class DeezerClient {
  private client: AxiosInstance;
  private arl: string;

  constructor() {
    this.arl = configManager.getARL();
    this.client = axios.create({
      baseURL: DEEZER_API_BASE,
      headers: {
        'User-Agent': 'kmfs-v3',
      },
    });
  }

  private async getRequestConfig(): Promise<AxiosRequestConfig> {
    if (!this.arl) {
      throw new Error('❌ ARL Token nicht gesetzt. Bitte mit kmfs -a <ARL> setzen.');
    }
    return {
      headers: {
        'Authorization': `Bearer ${this.arl}`,
      },
    };
  }

  private async refreshARL(): Promise<void> {
    this.arl = configManager.getARL();
  }

  // ============================================
  // Core API Methods
  // ============================================

  async search(options: SearchOptions): Promise<Track[] | Album[] | Artist[] | Playlist[]> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    try {
      const response = await this.client.get<DeezerAPIResponse<any>>(
        `/search?q=${encodeURIComponent(options.query)}&limit=${options.limit || 50}`,
        config
      );

      const results = response.data.data;

      switch (options.type) {
        case 'track':
          return results.map(this.mapToTrack);
        case 'album':
          return results.map(this.mapToAlbum);
        case 'artist':
          return results.map(this.mapToArtist);
        case 'playlist':
          return results.map(this.mapToPlaylist);
        default:
          return [];
      }
    } catch (error) {
      console.error('🔍 Suche fehlgeschlagen:', error);
      return [];
    }
  }

  async getArtistById(artistId: string): Promise<Artist> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<DeezerArtist>>(
      `/artist/${artistId}`,
      config
    );
    return this.mapToArtist(response.data.data);
  }

  async getArtistTopTracks(artistId: string, limit: number = 50): Promise<Track[]> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<{ data: DeezerTrack[] }>>(
      `/artist/${artistId}/top?limit=${limit}`,
      config
    );
    return response.data.data.data.map(this.mapToTrack);
  }

  async getArtistAlbums(artistId: string, limit: number = 50): Promise<Album[]> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<{ data: DeezerAlbum[] }>>(
      `/artist/${artistId}/albums?limit=${limit}`,
      config
    );
    return response.data.data.data.map(this.mapToAlbum);
  }

  async getAlbumById(albumId: string): Promise<Album> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<DeezerAlbum>>(
      `/album/${albumId}`,
      config
    );
    return this.mapToAlbum(response.data.data);
  }

  async getAlbumTracks(albumId: string): Promise<Track[]> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<{ data: DeezerTrack[] }>>(
      `/album/${albumId}/tracks`,
      config
    );
    return response.data.data.data.map(this.mapToTrack);
  }

  async getPlaylistById(playlistId: string): Promise<Playlist> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<DeezerPlaylist>>(
      `/playlist/${playlistId}`,
      config
    );
    return this.mapToPlaylist(response.data.data);
  }

  async getTrackById(trackId: string): Promise<Track> {
    await this.refreshARL();
    const config = await this.getRequestConfig();

    const response = await this.client.get<DeezerAPIResponse<DeezerTrack>>(
      `/track/${trackId}`,
      config
    );
    return this.mapToTrack(response.data.data);
  }

  // ============================================
  // URL Parsing Methods
  // ============================================

  parseDeezerUrl(url: string): { type: string; id: string } | null {
    const patterns = {
      track: /deezer\.com\/.*\/track\/(\d+)/,
      album: /deezer\.com\/.*\/album\/(\d+)/,
      artist: /deezer\.com\/.*\/artist\/(\d+)/,
      playlist: /deezer\.com\/.*\/playlist\/(\d+)/,
    };

    for (const [type, pattern] of Object.entries(patterns)) {
      const match = url.match(pattern);
      if (match) {
        return { type, id: match[1] };
      }
    }

    // Try to extract ID from any deezer URL
    const idMatch = url.match(/\/(\d{8,})/);
    if (idMatch) {
      return { type: 'track', id: idMatch[1] };
    }

    return null;
  }

  // ============================================
  // Download URL Methods - Using Deezer's CDN
  // ============================================

  async getTrackDownloadUrl(trackId: string, quality: Quality): Promise<string | null> {
    await this.refreshARL();

    try {
      // Deezer's CDN URL pattern for media files
      // Format: https://e-cdns-proxy-f.dzcdn.net/mobile/1/{track_id}.{format}
      
      const qualityMap = {
        '128': 'mp3',
        '320': 'mp3',
        flac: 'flac',
      };

      const format = qualityMap[quality];
      
      // Generate the CDN URL
      // For MP3 files, Deezer uses .mp3 extension for both 128 and 320
      // The quality is determined by the URL parameters or headers
      const cdnUrl = `${DEEZER_CDN_BASE}/mobile/1/${trackId}.${format}`;
      
      // For MP3, we need to specify the quality in the URL
      // Deezer uses different subdomains or parameters for quality
      // Based on reverse engineering, we can use:
      // - e-cdns-proxy-f.dzcdn.net for FLAC
      // - e-cdns-proxy-{quality}.dzcdn.net for MP3
      
      if (quality === 'flac') {
        // FLAC URL
        return `${DEEZER_CDN_BASE}/mobile/1/${trackId}.flac`;
      } else {
        // MP3 URL - Deezer uses different CDN endpoints for different qualities
        // We'll use the standard MP3 URL and let the ARL token handle the quality
        return `${DEEZER_CDN_BASE}/mobile/1/${trackId}.mp3`;
      }
    } catch (error) {
      console.error('⚠️  Download-URL konnte nicht generiert werden:', error);
      return null;
    }
  }

  // ============================================
  // Batch Methods
  // ============================================

  async getArtistAllTracks(artistId: string): Promise<Track[]> {
    const albums = await this.getArtistAlbums(artistId);
    const allTracks: Track[] = [];

    for (const album of albums) {
      const tracks = await this.getAlbumTracks(album.id);
      allTracks.push(...tracks);
    }

    return allTracks;
  }

  // ============================================
  // Data Mapping Methods
  // ============================================

  private mapToTrack(deezerTrack: DeezerTrack): Track {
    return {
      id: deezerTrack.id,
      title: deezerTrack.title,
      artist: {
        id: deezerTrack.artist.id,
        name: deezerTrack.artist.name,
      },
      album: {
        id: deezerTrack.album.id,
        title: deezerTrack.album.title,
        cover: deezerTrack.album.cover_big,
      },
      duration: deezerTrack.duration,
      releaseDate: deezerTrack.release_date,
      quality: {},
    };
  }

  private mapToAlbum(deezerAlbum: DeezerAlbum): Album {
    return {
      id: deezerAlbum.id,
      title: deezerAlbum.title,
      artist: {
        id: deezerAlbum.artist.id,
        name: deezerAlbum.artist.name,
      },
      tracks: deezerAlbum.tracks?.data?.map(this.mapToTrack) || [],
      releaseDate: deezerAlbum.release_date,
      cover: deezerAlbum.cover_big,
    };
  }

  private mapToArtist(deezerArtist: DeezerArtist): Artist {
    return {
      id: deezerArtist.id,
      name: deezerArtist.name,
    };
  }

  private mapToPlaylist(deezerPlaylist: DeezerPlaylist): Playlist {
    return {
      id: deezerPlaylist.id,
      title: deezerPlaylist.title,
      creator: {
        id: deezerPlaylist.creator.id,
        name: deezerPlaylist.creator.name,
      },
      tracks: deezerPlaylist.tracks?.data?.map(this.mapToTrack) || [],
    };
  }
}

export const deezerClient = new DeezerClient();
