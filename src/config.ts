// ============================================
// kmfs v3 - Config Management
// ============================================

import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Config } from './types';

const DEFAULT_CONFIG: Config = {
  concurrency: 4,
  saveLayout: {
    track: '{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})',
    album: '{ALB_TITLE}/{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})',
    artist: '{ART_NAME} - {ALB_TITLE}/{ART_NAME} - {SNG_TITLE}',
    playlist: 'Playlist/{TITLE}/{ART_NAME} - {SNG_TITLE} ({ALB_TITLE})',
  },
  fallbackQuality: true,
  coverSize: {
    '128': 500,
    '320': 500,
    flac: 500,
  },
  cookies: {
    arl: '',
  },
};

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

export class ConfigManager {
  private config: Config;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  async load(): Promise<Config> {
    try {
      const data = await fs.readFile(CONFIG_PATH, 'utf-8');
      this.config = { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    } catch (error) {
      // Config existiert nicht - erstelle Standard-Config
      await this.save();
    }
    return this.config;
  }

  async save(): Promise<void> {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(this.config, null, 2));
  }

  get(): Config {
    return this.config;
  }

  set(key: keyof Config, value: any): void {
    (this.config as any)[key] = value;
  }

  async setARL(arl: string): Promise<void> {
    this.config.cookies.arl = arl;
    await this.save();
  }

  async setDownloadPath(outputPath: string): Promise<void> {
    this.config.downloadPath = outputPath;
    await this.save();
  }

  getARL(): string {
    return this.config.cookies.arl;
  }

  getTemplate(type: 'track' | 'album' | 'artist' | 'playlist'): string {
    return this.config.saveLayout[type];
  }

  getConcurrency(): number {
    return this.config.concurrency;
  }

  getCoverSize(quality: string): number {
    return this.config.coverSize[quality as keyof typeof this.config.coverSize] || 500;
  }

  getFallbackQuality(): boolean {
    return this.config.fallbackQuality;
  }
}

export const configManager = new ConfigManager();
