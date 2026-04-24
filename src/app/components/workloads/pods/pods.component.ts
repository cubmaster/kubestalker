import { Component, OnInit, OnDestroy, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { KubernetesService } from '../../../services/kubernetes.service';
import { StateService } from '../../../services/state.service';
import { DrawerService } from '../../../services/drawer.service';
import { KubePod } from '../../../models/kubernetes.models';
import { PodTerminalComponent } from '../../pod-terminal/pod-terminal.component';

@Component({
  selector: 'app-pods',
  standalone: true,
  imports: [CommonModule, FormsModule, PodTerminalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
            <tr *ngFor="let pod of filteredPods; trackBy: trackPod"
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
                <button class="btn btn-sm btn-outline-info p-1 me-1" (click)="openTerminal(pod, $event)" title="Shell into pod">
                  <i class="bi bi-cursor-text"></i>
                </button>
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

    <app-pod-terminal *ngIf="terminalPod"
      [isOpen]="terminalOpen"
      [podName]="terminalPod!.name"
      [namespace]="terminalPod!.namespace || ''"
      [contextName]="contextName"
      [containerNames]="terminalContainers"
      (closed)="closeTerminal()">
    </app-pod-terminal>
  `,
  styles: [`.spin { animation: spin 1s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`]
})
export class PodsComponent implements OnInit, OnDestroy {
  pods: KubePod[] = [];
  searchText = '';
  loading = false;
  error: string | null = null;
  contextName = '';
  terminalPod: KubePod | null = null;
  terminalOpen = false;
  terminalContainers: string[] = [];
  private namespaces: string[] = [];
  private sub?: Subscription;

  constructor(
    private k8s: KubernetesService,
    private state: StateService,
    private drawer: DrawerService,
    private cdr: ChangeDetectorRef
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

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async loadPods(): Promise<void> {
    if (!this.contextName) return;
    const isInitial = this.pods.length === 0;
    if (isInitial) { this.loading = true; this.cdr.markForCheck(); }
    this.error = null;
    try {
      const fresh = await this.k8s.getPods(this.contextName, this.namespaces);
      const changed = this.mergePods(fresh);
      if (changed || isInitial) this.cdr.markForCheck();
    } catch (e: any) {
      this.error = e.message;
      this.cdr.markForCheck();
    } finally {
      if (this.loading) { this.loading = false; this.cdr.markForCheck(); }
    }
  }

  /** Merge new data into existing array in-place. Returns true if anything changed. */
  private mergePods(fresh: KubePod[]): boolean {
    let changed = false;
    const freshMap = new Map<string, KubePod>();
    for (const p of fresh) freshMap.set(p.uid || p.name + '/' + p.namespace, p);

    // Update existing pods in-place, remove stale ones
    for (let i = this.pods.length - 1; i >= 0; i--) {
      const key = this.pods[i].uid || this.pods[i].name + '/' + this.pods[i].namespace;
      const updated = freshMap.get(key);
      if (updated) {
        const existing = this.pods[i];
        if (existing.phase !== updated.phase) { existing.phase = updated.phase; changed = true; }
        if (existing.ready !== updated.ready) { existing.ready = updated.ready; changed = true; }
        if (existing.restarts !== updated.restarts) { existing.restarts = updated.restarts; changed = true; }
        if (existing.ip !== updated.ip) { existing.ip = updated.ip; changed = true; }
        if (existing.nodeName !== updated.nodeName) { existing.nodeName = updated.nodeName; changed = true; }
        if (existing.hasError !== updated.hasError) { existing.hasError = updated.hasError; changed = true; }
        if (existing.resourceVersion !== updated.resourceVersion) {
          existing.resourceVersion = updated.resourceVersion;
          existing.raw = updated.raw;
          existing.conditions = updated.conditions;
          existing.containers = updated.containers;
          changed = true;
        }
        freshMap.delete(key);
      } else {
        this.pods.splice(i, 1);
        changed = true;
      }
    }

    // Append any new pods
    for (const p of freshMap.values()) {
      this.pods.push(p);
      changed = true;
    }
    return changed;
  }

  trackPod(_index: number, pod: KubePod): string {
    return pod.uid || pod.name + '/' + pod.namespace;
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
    this.cdr.markForCheck();
  }

  openTerminal(pod: KubePod, e: Event): void {
    e.stopPropagation();
    const containers: string[] = [];
    const raw = pod.raw || pod;
    if (raw?.spec?.initContainers) { for (const c of raw.spec.initContainers) containers.push(c.name); }
    if (raw?.spec?.containers) { for (const c of raw.spec.containers) containers.push(c.name); }
    this.terminalContainers = containers.length > 0 ? containers : [''];
    this.terminalPod = pod;
    this.terminalOpen = true;
    this.cdr.markForCheck();
  }

  closeTerminal(): void {
    this.terminalOpen = false;
    this.cdr.markForCheck();
    setTimeout(() => { this.terminalPod = null; this.cdr.markForCheck(); }, 300);
  }
}
