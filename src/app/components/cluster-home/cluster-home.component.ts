import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { NamespaceFilterComponent } from '../namespace-filter/namespace-filter.component';
import { WorkloadsComponent } from '../workloads/workloads.component';
import { NetworkingComponent } from '../networking/networking.component';
import { StorageComponent } from '../storage/storage.component';
import { ConfigurationComponent } from '../configuration/configuration.component';
import { NodesComponent } from '../nodes/nodes.component';
import { KubeCluster } from '../../models/kubernetes.models';

type SidebarTab = 'workloads' | 'networking' | 'storage' | 'configuration' | 'nodes';

@Component({
  selector: 'app-cluster-home',
  standalone: true,
  imports: [CommonModule, NamespaceFilterComponent, WorkloadsComponent,
    NetworkingComponent, StorageComponent, ConfigurationComponent, NodesComponent],
  template: `
    <div class="cluster-home d-flex flex-column h-100" *ngIf="cluster; else noCluster">
      <!-- Top bar -->
      <div class="cluster-topbar d-flex align-items-center justify-content-between px-4 py-2 border-bottom border-secondary">
        <div class="d-flex align-items-center gap-3">
          <div>
            <i class="bi bi-cloud text-primary me-2 fs-5"></i>
            <span class="fw-semibold fs-6">{{ cluster.contextName }}</span>
            <span class="text-muted ms-2 small">{{ cluster.server }}</span>
          </div>
        </div>
        <div class="d-flex align-items-center gap-3">
          <app-namespace-filter></app-namespace-filter>
        </div>
      </div>

      <!-- Content area with side tabs -->
      <div class="d-flex flex-1 overflow-hidden" style="flex: 1; min-height: 0;">
        <!-- Left sidebar tabs -->
        <div class="sidebar-tabs d-flex flex-column border-end border-secondary" style="width: 200px; flex-shrink: 0;">
          <nav class="nav flex-column pt-2">
            <button *ngFor="let tab of tabs"
              class="nav-link sidebar-tab-btn text-start d-flex align-items-center gap-2 px-3 py-2"
              [class.active]="activeTab === tab.id"
              [class.text-danger]="tab.hasError"
              (click)="activeTab = tab.id">
              <i class="bi" [class]="tab.icon" [class.text-danger]="tab.hasError"></i>
              <span>{{ tab.label }}</span>
            </button>
          </nav>
        </div>

        <!-- Main content -->
        <div class="main-content flex-fill overflow-auto p-4">
          <app-workloads *ngIf="activeTab === 'workloads'"></app-workloads>
          <app-networking *ngIf="activeTab === 'networking'"></app-networking>
          <app-storage *ngIf="activeTab === 'storage'"></app-storage>
          <app-configuration *ngIf="activeTab === 'configuration'"></app-configuration>
          <app-nodes *ngIf="activeTab === 'nodes'"></app-nodes>
        </div>
      </div>
    </div>

    <ng-template #noCluster>
      <div class="d-flex flex-column align-items-center justify-content-center h-100 text-muted">
        <i class="bi bi-cloud-slash display-1 mb-4 opacity-25"></i>
        <h4>No Cluster Selected</h4>
        <p>Select a cluster from the left sidebar to get started.</p>
      </div>
    </ng-template>
  `,
  styles: [`
    .cluster-home { background: #1e1e2e; color: #cdd6f4; }
    .cluster-topbar { background: #181825; min-height: 56px; }
    .sidebar-tabs { background: #181825; }
    .sidebar-tab-btn {
      background: transparent; border: none; color: #a6adc8;
      border-radius: 0; font-size: 0.875rem; transition: background 0.15s, color 0.15s;
    }
    .sidebar-tab-btn:hover { background: #313244; color: #cdd6f4; }
    .sidebar-tab-btn.active { background: #313244; color: #89b4fa; border-left: 3px solid #89b4fa; }
    .main-content { background: #1e1e2e; }
  `]
})
export class ClusterHomeComponent implements OnInit, OnDestroy {
  cluster: KubeCluster | null = null;
  activeTab: SidebarTab = 'workloads';
  private sub?: Subscription;

  tabs = [
    { id: 'workloads' as SidebarTab, label: 'Workloads', icon: 'bi-box-seam', hasError: false },
    { id: 'networking' as SidebarTab, label: 'Networking', icon: 'bi-diagram-3', hasError: false },
    { id: 'storage' as SidebarTab, label: 'Storage', icon: 'bi-hdd-stack', hasError: false },
    { id: 'configuration' as SidebarTab, label: 'Configuration', icon: 'bi-gear', hasError: false },
    { id: 'nodes' as SidebarTab, label: 'Nodes', icon: 'bi-server', hasError: false },
  ];

  constructor(private state: StateService) {}

  ngOnInit(): void {
    this.sub = this.state.selectedCluster.subscribe(c => { this.cluster = c; });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }
}
