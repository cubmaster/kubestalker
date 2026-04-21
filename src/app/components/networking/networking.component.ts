import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ServicesComponent } from './services/services.component';
import { EndpointsComponent } from './endpoints/endpoints.component';
import { IngressComponent } from './ingress/ingress.component';

type NetTab = 'services' | 'endpoints' | 'ingress';

@Component({
  selector: 'app-networking',
  standalone: true,
  imports: [CommonModule, ServicesComponent, EndpointsComponent, IngressComponent],
  template: `
    <div>
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item" *ngFor="let tab of tabs">
          <button class="nav-link" [class.active]="activeTab === tab.id" (click)="activeTab = tab.id">
            <i class="bi me-1" [class]="tab.icon"></i>{{ tab.label }}
          </button>
        </li>
      </ul>
      <app-services *ngIf="activeTab==='services'"></app-services>
      <app-endpoints *ngIf="activeTab==='endpoints'"></app-endpoints>
      <app-ingress *ngIf="activeTab==='ingress'"></app-ingress>
    </div>
  `
})
export class NetworkingComponent {
  activeTab: NetTab = 'services';
  tabs = [
    { id: 'services' as NetTab, label: 'Services', icon: 'bi-diagram-3' },
    { id: 'endpoints' as NetTab, label: 'Endpoints', icon: 'bi-link-45deg' },
    { id: 'ingress' as NetTab, label: 'Ingress', icon: 'bi-cloud-arrow-in' },
  ];
}
