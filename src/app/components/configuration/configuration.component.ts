import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfigMapsComponent } from './configmaps/configmaps.component';
import { SecretsComponent } from './secrets/secrets.component';

type ConfigTab = 'configmaps' | 'secrets';

@Component({
  selector: 'app-configuration',
  standalone: true,
  imports: [CommonModule, ConfigMapsComponent, SecretsComponent],
  template: `
    <div>
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item" *ngFor="let tab of tabs">
          <button class="nav-link" [class.active]="activeTab === tab.id" (click)="activeTab = tab.id">
            <i class="bi me-1" [class]="tab.icon"></i>{{ tab.label }}
          </button>
        </li>
      </ul>
      <app-configmaps *ngIf="activeTab==='configmaps'"></app-configmaps>
      <app-secrets *ngIf="activeTab==='secrets'"></app-secrets>
    </div>
  `
})
export class ConfigurationComponent {
  activeTab: ConfigTab = 'configmaps';
  tabs = [
    { id: 'configmaps' as ConfigTab, label: 'ConfigMaps', icon: 'bi-file-earmark-code' },
    { id: 'secrets' as ConfigTab, label: 'Secrets', icon: 'bi-lock' },
  ];
}
