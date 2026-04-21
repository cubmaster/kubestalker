import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { KubernetesService } from '../../services/kubernetes.service';
import { StateService } from '../../services/state.service';
import { DatabaseService } from '../../services/database.service';
import { KubeCluster } from '../../models/kubernetes.models';

@Component({
  selector: 'app-cluster-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="cluster-list d-flex flex-column h-100">
      <!-- Header -->
      <div class="cluster-list-header px-3 py-3 border-bottom border-secondary">
        <div class="d-flex align-items-center justify-content-between mb-2">
          <div class="d-flex align-items-center gap-2">
            <i class="bi bi-kubernetes text-primary fs-5"></i>
            <span class="fw-bold text-white">KubeStalker</span>
          </div>
          <button class="btn btn-sm btn-outline-secondary p-1" (click)="refresh()" [disabled]="loading"
            title="Refresh clusters">
            <i class="bi bi-arrow-clockwise" [class.spin]="loading"></i>
          </button>
        </div>
        <input type="text" class="form-control form-control-sm bg-dark text-light border-secondary"
          placeholder="Filter clusters..." [(ngModel)]="filterText">
      </div>

      <!-- Cluster list -->
      <div class="cluster-list-body flex-fill overflow-auto">
        <div *ngIf="loading && clusters.length === 0" class="text-center py-5">
          <div class="spinner-border spinner-border-sm text-primary"></div>
          <div class="text-muted small mt-2">Loading clusters...</div>
        </div>

        <div *ngIf="error" class="alert alert-danger alert-sm m-2 p-2 small">
          <i class="bi bi-exclamation-triangle me-1"></i>{{ error }}
        </div>

        <div *ngFor="let cluster of filteredClusters"
          class="cluster-item px-3 py-2 d-flex align-items-center gap-2"
          [class.active]="selectedCluster?.contextName === cluster.contextName"
          (click)="selectCluster(cluster)">
          <div class="cluster-icon">
            <i class="bi bi-cloud-fill text-primary"></i>
          </div>
          <div class="cluster-info flex-fill overflow-hidden">
            <div class="cluster-name text-truncate fw-medium" [title]="cluster.contextName">
              {{ cluster.contextName }}
            </div>
            <div class="cluster-server text-truncate text-muted" style="font-size: 0.7rem;" [title]="cluster.server">
              {{ cluster.server }}
            </div>
          </div>
          <i *ngIf="selectedCluster?.contextName === cluster.contextName"
            class="bi bi-chevron-right text-primary flex-shrink-0"></i>
        </div>

        <div *ngIf="!loading && filteredClusters.length === 0 && !error"
          class="text-center text-muted py-5 small">
          <i class="bi bi-inbox display-6 d-block mb-2 opacity-25"></i>
          No clusters found.<br>
          <span class="opacity-75">Add a kubeconfig to ~/.kube/config</span>
        </div>
      </div>

      <!-- Footer -->
      <div class="cluster-list-footer px-3 py-2 border-top border-secondary small text-muted">
        <i class="bi bi-files me-1"></i>{{ clusters.length }} cluster(s) from
        <span *ngIf="kubeconfigCount > 0"> {{ kubeconfigCount }} kubeconfig file(s)</span>
      </div>
    </div>
  `,
  styles: [`
    .cluster-list { background: #11111b; color: #cdd6f4; }
    .cluster-list-header { background: #11111b; }
    .cluster-item {
      cursor: pointer; transition: background 0.15s;
      border-left: 3px solid transparent;
    }
    .cluster-item:hover { background: #1e1e2e; }
    .cluster-item.active { background: #1e1e2e; border-left-color: #89b4fa; }
    .cluster-name { color: #cdd6f4; font-size: 0.875rem; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class ClusterListComponent implements OnInit, OnDestroy {
  clusters: KubeCluster[] = [];
  selectedCluster: KubeCluster | null = null;
  filterText = '';
  loading = false;
  error: string | null = null;
  kubeconfigCount = 0;
  private sub?: Subscription;

  constructor(
    private k8s: KubernetesService,
    private state: StateService,
    private db: DatabaseService
  ) {}

  ngOnInit(): void {
    this.sub = this.state.selectedCluster.subscribe(c => { this.selectedCluster = c; });
    this.loadClusters();
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  async loadClusters(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.clusters = await this.k8s.getClusters();
      this.state.setClusters(this.clusters);
      // Restore last selected cluster
      const lastCtx = await this.db.get<string>('selectedCluster');
      if (lastCtx) {
        const found = this.clusters.find(c => c.contextName === lastCtx);
        if (found) this.selectCluster(found);
      }
    } catch (e: any) {
      this.error = e.message || 'Failed to load clusters';
    } finally {
      this.loading = false;
    }
  }

  refresh(): void { this.loadClusters(); }

  selectCluster(cluster: KubeCluster): void {
    this.state.setSelectedCluster(cluster);
    this.db.set('selectedCluster', cluster.contextName).catch(() => {});
  }

  get filteredClusters(): KubeCluster[] {
    if (!this.filterText) return this.clusters;
    const f = this.filterText.toLowerCase();
    return this.clusters.filter(c =>
      c.contextName.toLowerCase().includes(f) ||
      c.server.toLowerCase().includes(f)
    );
  }
}
