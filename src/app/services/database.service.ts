import { Injectable } from '@angular/core';
import { ElectronService } from './electron.service';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  constructor(private electron: ElectronService) {}

  async get<T>(key: string): Promise<T | null> {
    const response = await this.electron.invoke<T>('db:get', key);
    return response.success ? (response.data ?? null) : null;
  }

  async set(key: string, value: any): Promise<void> {
    await this.electron.invoke('db:set', key, value);
  }

  async delete(key: string): Promise<void> {
    await this.electron.invoke('db:delete', key);
  }

  async getAll(): Promise<Record<string, any>> {
    const response = await this.electron.invoke<Record<string, any>>('db:getAll');
    return response.success ? (response.data ?? {}) : {};
  }
}
