import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { KubernetesService } from '../../../services/kubernetes.service';
import { StateService } from '../../../services/state.service';
import { DrawerService } from '../../../services/drawer.service';
import { KubePod } from '../../../models/kubernetes.models';

@Component({
  selector: 'app-pods',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-list">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-muted">Pods <span class="badge bg-secondary">{{ filteredPods.length }}</span></h6>
        <div class="d-flex gap-2">
          <input type="text" class="form-control form-control-sm" style="width:200px"
            placeholder="Search pods..." [(ngModel)]="searchText">
          <button class="btn btn-sm btn-outline-secondary" (click)="refresh()" [disabled]="loading">
            <i class="bi bi-arrow-clockwise" [class.spin]="loading"></i>
          </button>
        </div>
      </div>

      <div *ngIf="error" class="alert alert-danger py-2">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
      </div>

      <div *ngIf="loading && pods.length === 0" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
      </div>

      <div class="table-responsive" *ngIf="!loading || pods.length > 0">
        <table class="table table-sm table-hover table-dark">
          <thead>
            <tr>
              <th>Name</th>
              <th>Namespace</th>
              <th>Status</th>
              <th>Ready</th>
              <th>Restarts</th>
              <th>Node</th>
              <th>IP</th>
              <th>Age</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let pod of filteredPods"
              [class.table-danger]="pod.hasError"
              (click)="openDrawer(pod)" style="cursor:pointer">
              <td>
                <i *ngIf="pod.hasError" class="bi bi-exclamation-circle text-danger me-1"></i>
                <span [class.text-danger]="pod.hasError">{{ pod.name }}</span>
              </td>
              <td><span class="badge bg-secondary-subtle text-secondary-emphasis">{{ pod.namespace }}</span></td>
              <td>
                <span class="badge" [ngClass]="getStatusClass(pod.phase)">{{ pod.phase }}</span>
              </td>
              <td>{{ pod.ready }}</td>
              <td>
                <span [class.text-danger]="(pod.restarts || 0) > 0"
                  [class.fw-bold]="(pod.restarts || 0) > 0">{{ pod.restarts || 0 }}</span>
              </td>
              <td class="text-muted small">{{ pod.nodeName }}</td>
              <td class="text-muted small font-monospace">{{ pod.ip }}</td>
              <td class="text-muted small">{{ getAge(pod.creationTimestamp) }}</td>
              <td>
                <button class="btn btn-sm btn-outline-danger p-1" (click)="deletePod(pod, $event)">
                  <i class="bi bi-trash"></i>
                </button>
              </td>
            </tr>
            <tr *ngIf="filteredPods.length === 0 && !loading">
              <td colspan="9" class="text-center text-muted py-4">No pods found</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`]
})
export class PodsComponent implements OnInit, OnDestroy {
  pods: KubePod[] = [];
  searchText = '';
  loading = false;
  error: string | null = null;
  private contextName = '';
  private namespaces: string[] = [];
  private sub?: Subscription;

  constructor(
    private k8s: KubernetesService,
    private state: StateService,
    private drawer: DrawerService
  ) {}

  ngOnInit(): void {
    this.sub = combineLatest([this.state.selectedCluster, this.state.selectedNamespaces])
      .subscribe(([cluster, ns]) => {
        if (cluster) {
          this.contextName = cluster.contextName;
          this.namespaces = ns;
          this.loadPods();
        }
      });
  }

  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  async loadPods(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      this.pods = await this.k8s.getPods(this.contextName, this.namespaces);
    } catch (e: any) {
      this.error = e.message;
    } finally { this.loading = false; }
  }

  refresh(): void { this.loadPods(); }

  get filteredPods(): KubePod[] {
    if (!this.searchText) return this.pods;
    return this.pods.filter(p =>
      p.name.toLowerCase().includes(this.searchText.toLowerCase()) ||
      p.namespace?.toLowerCase().includes(this.searchText.toLowerCase())
    );
  }

  getStatusClass(phase?: string): string {
    switch (phase) {
      case 'Running': return 'bg-success';
      case 'Pending': return 'bg-warning text-dark';
      case 'Failed': return 'bg-danger';
      case 'Succeeded': return 'bg-info text-dark';
      default: return 'bg-secondary';
    }
  }

  getAge(ts?: string): string {
    if (!ts) return '-';
    const diff = Date.now() - new Date(ts).getTime();
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (d > 0) return `${d}d`;
    if (h > 0) return `${h}h`;
    return `${m}m`;
  }

  openDrawer(pod: KubePod): void {
    this.drawer.open({
      resource: pod.raw || pod, resourceType: 'Pod',
      contextName: this.contextName, namespace: pod.namespace, readOnly: true
    });
  }

  async deletePod(pod: KubePod, e: Event): Promise<void> {
    e.stopPropagation();
    if (!confirm(`Delete pod "${pod.name}"?`)) return;
    try {
      await this.k8s.deletePod(this.contextName, pod.namespace!, pod.name);
      this.pods = this.pods.filter(p => p !== pod);
    } catch (err: any) { this.error = err.message; }
  }
}
