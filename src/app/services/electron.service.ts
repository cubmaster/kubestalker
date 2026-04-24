import { Injectable } from '@angular/core';
import { IpcResponse } from '../models/kubernetes.models';

declare global {
  interface Window {
    electronAPI?: {
      invoke: (channel: string, ...args: any[]) => Promise<IpcResponse>;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      send: (channel: string, ...args: any[]) => void;
    };
  }
}

@Injectable({ providedIn: 'root' })
export class ElectronService {
  private isElectron = typeof window !== 'undefined' && !!window.electronAPI;

  async invoke<T = any>(channel: string, ...args: any[]): Promise<IpcResponse<T>> {
    if (this.isElectron && window.electronAPI) {
      return window.electronAPI.invoke(channel, ...args);
    }
    // Browser fallback for development
    return this.browserFallback<T>(channel, args);
  }

  private async browserFallback<T>(channel: string, args: any[]): Promise<IpcResponse<T>> {
    console.warn(`[ElectronService] No Electron context. Channel: ${channel}`, args);
    return { success: false, error: 'Not running in Electron' };
  }

  isRunningInElectron(): boolean {
    return this.isElectron;
  }

  on(channel: string, callback: (...args: any[]) => void): void {
    if (this.isElectron && window.electronAPI) {
      window.electronAPI.on(channel, callback);
    }
  }

  removeAllListeners(channel: string): void {
    if (this.isElectron && window.electronAPI) {
      window.electronAPI.removeAllListeners(channel);
    }
  }
}
