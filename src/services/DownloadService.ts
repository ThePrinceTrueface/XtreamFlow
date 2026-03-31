import { db } from '../../db';
import { DownloadItem } from '../../types';

export class DownloadService {
  private static instance: DownloadService;
  private controllers: Map<string, AbortController> = new Map();

  private constructor() {}

  static getInstance() {
    if (!DownloadService.instance) {
      DownloadService.instance = new DownloadService();
    }
    return DownloadService.instance;
  }

  async addDownload(item: Omit<DownloadItem, 'progress' | 'status' | 'addedAt'>) {
    const existing = await db.downloads.get(item.id);
    if (existing) {
      if (existing.status === 'completed') return;
      await this.resumeDownload(item.id);
      return;
    }

    const newItem: DownloadItem = {
      ...item,
      progress: 0,
      status: 'queued',
      addedAt: Date.now(),
    };
    await db.downloads.add(newItem);
    this.processQueue();
  }

  async processQueue() {
    // Limit parallel downloads to 2
    const downloadingCount = await db.downloads.where('status').equals('downloading').count();
    if (downloadingCount >= 2) return;

    const queued = await db.downloads.where('status').equals('queued').first();
    if (queued) {
      this.startDownload(queued.id);
    }
  }

  async startDownload(id: string) {
    const item = await db.downloads.get(id);
    if (!item || item.status === 'downloading') return;

    const controller = new AbortController();
    this.controllers.set(id, controller);

    try {
      await db.downloads.update(id, { status: 'downloading', error: undefined });

      if (!item.fileHandle) {
        throw new Error('No file handle available. Please select a location to save.');
      }

      // Verify permission
      const permission = await (item.fileHandle as any).queryPermission({ mode: 'readwrite' });
      if (permission !== 'granted') {
        const request = await (item.fileHandle as any).requestPermission({ mode: 'readwrite' });
        if (request !== 'granted') {
          throw new Error('Permission denied to access file system.');
        }
      }

      const file = await item.fileHandle.getFile();
      const startByte = file.size;

      const response = await fetch(item.url, {
        signal: controller.signal,
        headers: startByte > 0 ? { 'Range': `bytes=${startByte}-` } : {},
      });

      if (!response.ok && response.status !== 206) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalSize = (contentLength ? parseInt(contentLength, 10) : 0) + startByte;
      
      if (totalSize > startByte) {
        await db.downloads.update(id, { totalSize });
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Failed to get reader from response body');

      const writable = await item.fileHandle.createWritable({ keepExistingData: true });
      if (startByte > 0) {
        await writable.seek(startByte);
      }

      let downloaded = startByte;
      let lastUpdate = Date.now();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          await writable.write(value);
          downloaded += value.length;

          // Throttle DB updates
          if (Date.now() - lastUpdate > 1000) {
            const progress = totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0;
            await db.downloads.update(id, { progress, downloadedSize: downloaded });
            lastUpdate = Date.now();
          }
        }
      } finally {
        await writable.close();
        reader.releaseLock();
      }

      await db.downloads.update(id, { status: 'completed', progress: 100, completedAt: Date.now(), downloadedSize: downloaded });
      this.controllers.delete(id);
      this.processQueue();

    } catch (err: any) {
      if (err.name === 'AbortError') {
        await db.downloads.update(id, { status: 'paused' });
      } else {
        console.error('Download error:', err);
        await db.downloads.update(id, { status: 'error', error: err.message });
      }
      this.controllers.delete(id);
      this.processQueue();
    }
  }

  async pauseDownload(id: string) {
    const controller = this.controllers.get(id);
    if (controller) {
      controller.abort();
    } else {
      await db.downloads.update(id, { status: 'paused' });
    }
  }

  async resumeDownload(id: string) {
    await db.downloads.update(id, { status: 'queued' });
    this.processQueue();
  }

  async removeDownload(id: string) {
    this.pauseDownload(id);
    await db.downloads.delete(id);
  }

  async getDownload(id: string) {
    return await db.downloads.get(id);
  }

  async getAllDownloads() {
    return await db.downloads.toArray();
  }
}

export const downloadService = DownloadService.getInstance();
