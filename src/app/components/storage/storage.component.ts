import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PvComponent } from './pv/pv.component';
import { PvcComponent } from './pvc/pvc.component';
import { StorageClassesComponent } from './storage-classes/storage-classes.component';

type StorageTab = 'pv' | 'pvc' | 'storageclasses';

@Component({
  selector: 'app-storage',
  standalone: true,
  imports: [CommonModule, PvComponent, PvcComponent, StorageClassesComponent],
  template: `
    <div>
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item" *ngFor="let tab of tabs">
          <button class="nav-link" [class.active]="activeTab === tab.id" (click)="activeTab = tab.id">
            <i class="bi me-1" [class]="tab.icon"></i>{{ tab.label }}
          </button>
        </li>
      </ul>
      <app-pv *ngIf="activeTab==='pv'"></app-pv>
      <app-pvc *ngIf="activeTab==='pvc'"></app-pvc>
      <app-storage-classes *ngIf="activeTab==='storageclasses'"></app-storage-classes>
    </div>
  `
})
export class StorageComponent {
  activeTab: StorageTab = 'pv';
  tabs = [
    { id: 'pv' as StorageTab, label: 'Persistent Volumes', icon: 'bi-hdd' },
    { id: 'pvc' as StorageTab, label: 'PV Claims', icon: 'bi-hdd-fill' },
    { id: 'storageclasses' as StorageTab, label: 'Storage Classes', icon: 'bi-layers' },
  ];
}
