import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { KubernetesService } from '../../services/kubernetes.service';
import { StateService } from '../../services/state.service';
import { DrawerService } from '../../services/drawer.service';
import { KubeNode } from '../../models/kubernetes.models';

@Component({
  selector: 'app-nodes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-list">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-muted">Nodes <span class="badge bg-secondary">{{ filtered.length }}</span></h6>
        <div class="d-flex gap-2">
          <input type="text" class="form-control form-control-sm" style="width:200px" placeholder="Search..." [(ngModel)]="searchText">
          <button class="btn btn-sm btn-outline-secondary" (click)="load()" [disabled]="loading">
            <i class="bi bi-arrow-clockwise" [class.spin]="loading"></i>
          </button>
        </div>
      </div>
      <div *ngIf="error" class="alert alert-danger py-2">{{ error }}</div>
      <div *ngIf="loading&&items.length===0" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div class="table-responsive">
        <table class="table table-sm table-hover table-dark">
          <thead>
            <tr>
              <th>Name</th><th>Status</th><th>Roles</th><th>Version</th>
              <th>CPU</th><th>Memory</th><th>OS</th><th>Kernel</th><th>Runtime</th><th>Age</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let node of filtered" [class.table-danger]="node.hasError"
              (click)="openDrawer(node)" style="cursor:pointer">
              <td>
                <i *ngIf="node.hasError" class="bi bi-exclamation-circle text-danger me-1"></i>
                {{ node.name }}
                <span *ngFor="let role of node.roles" class="badge bg-primary-subtle text-primary-emphasis ms-1">{{ role }}</span>
              </td>
              <td>
                <span class="badge" [ngClass]="getStatusClass(node.status)">{{ node.status }}</span>
              </td>
              <td class="small">{{ node.roles?.join(', ') || '-' }}</td>
              <td class="small font-monospace">{{ node.version }}</td>
              <td class="text-muted small">{{ node.cpu }}</td>
              <td class="text-muted small">{{ node.memory }}</td>
              <td class="text-muted small">{{ node.osImage }}</td>
              <td class="text-muted small">{{ node.kernelVersion }}</td>
              <td class="text-muted small">{{ node.containerRuntime }}</td>
              <td class="text-muted small">{{ getAge(node.creationTimestamp) }}</td>
            </tr>
            <tr *ngIf="filtered.length===0&&!loading">
              <td colspan="10" class="text-center text-muted py-4">No nodes found</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Node conditions detail -->
      <div *ngIf="selectedNode" class="mt-3">
        <h6 class="text-muted">Conditions for {{ selectedNode.name }}</h6>
        <table class="table table-sm table-dark">
          <thead><tr><th>Type</th><th>Status</th><th>Reason</th><th>Message</th></tr></thead>
          <tbody>
            <tr *ngFor="let cond of selectedNode.conditions"
              [class.table-danger]="cond.status !== 'True' && cond.type !== 'MemoryPressure' && cond.type !== 'DiskPressure' && cond.type !== 'PIDPressure'">
              <td>{{ cond.type }}</td>
              <td><span class="badge" [class.bg-success]="cond.status==='True'" [class.bg-secondary]="cond.status!=='True'">{{ cond.status }}</span></td>
              <td class="text-muted small">{{ cond.reason }}</td>
              <td class="text-muted small">{{ cond.message }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`]
})
export class NodesComponent implements OnInit, OnDestroy {
  items: KubeNode[] = [];
  searchText = '';
  loading = false;
  error: string | null = null;
  selectedNode: KubeNode | null = null;
  private ctx = '';
  private sub?: Subscription;

  constructor(private k8s: KubernetesService, private state: StateService, private drawer: DrawerService) {}

  ngOnInit(): void {
    this.sub = this.state.selectedCluster.subscribe(c => {
      if (c) { this.ctx = c.contextName; this.load(); }
    });
  }
  ngOnDestroy(): void { this.sub?.unsubscribe(); }

  async load(): Promise<void> {
    this.loading = true; this.error = null;
    try { this.items = await this.k8s.getNodes(this.ctx); }
    catch (e: any) { this.error = e.message; }
    finally { this.loading = false; }
  }

  get filtered(): KubeNode[] {
    if (!this.searchText) return this.items;
    return this.items.filter(n => n.name.toLowerCase().includes(this.searchText.toLowerCase()));
  }

  getAge(ts?: string): string {
    if (!ts) return '-';
    const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
    return d > 0 ? `${d}d` : `${Math.floor((Date.now() - new Date(ts).getTime()) / 3600000)}h`;
  }

  getStatusClass(status?: string): string {
    return status === 'Ready' ? 'bg-success' : 'bg-danger';
  }

  openDrawer(node: KubeNode): void {
    this.selectedNode = node;
    this.drawer.open({ resource: node.raw || node, resourceType: 'Node', contextName: this.ctx });
  }
}
