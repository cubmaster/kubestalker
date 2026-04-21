import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface DrawerConfig {
  resource: any;
  resourceType: string;
  contextName: string;
  namespace?: string;
  readOnly?: boolean;
}

@Injectable({ providedIn: 'root' })
export class DrawerService {
  private drawerState$ = new BehaviorSubject<DrawerConfig | null>(null);
  drawerState = this.drawerState$.asObservable();

  open(config: DrawerConfig): void {
    this.drawerState$.next(config);
  }

  close(): void {
    this.drawerState$.next(null);
  }

  isOpen(): boolean {
    return this.drawerState$.getValue() !== null;
  }
}
