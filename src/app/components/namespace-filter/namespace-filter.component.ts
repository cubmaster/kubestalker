import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { StateService } from '../../services/state.service';
import { KubernetesService } from '../../services/kubernetes.service';
import { KubeNamespace } from '../../models/kubernetes.models';

@Component({
  selector: 'app-namespace-filter',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="namespace-filter dropdown" #dropdownContainer>
      <button class="btn btn-outline-secondary btn-sm dropdown-toggle d-flex align-items-center gap-2"
        type="button" (click)="toggleDropdown()" [class.active]="isOpen">
        <i class="bi bi-layers"></i>
        <span>{{ getLabel() }}</span>
        <span *ngIf="selectedNamespaces.length > 0" class="badge bg-primary">{{ selectedNamespaces.length }}</span>
      </button>

      <div class="dropdown-menu namespace-dropdown p-2" [class.show]="isOpen">
        <div class="mb-2">
          <input type="text" class="form-control form-control-sm"
            placeholder="Filter namespaces..." [(ngModel)]="filterText">
        </div>

        <div class="dropdown-item-wrapper" style="max-height: 300px; overflow-y: auto;">
          <div class="form-check mb-1">
            <input class="form-check-input" type="checkbox" id="ns-all"
              [checked]="selectedNamespaces.length === 0"
              (change)="selectAll()">
            <label class="form-check-label" for="ns-all">All Namespaces</label>
          </div>
          <hr class="my-1">
          <div *ngFor="let ns of filteredNamespaces" class="form-check mb-1">
            <input class="form-check-input" type="checkbox"
              [id]="'ns-' + ns.name"
              [checked]="isSelected(ns.name)"
              [class.text-danger]="ns.hasError"
              (change)="toggleNamespace(ns.name)">
            <label class="form-check-label d-flex align-items-center gap-1"
              [for]="'ns-' + ns.name"
              [class.text-danger]="ns.hasError">
              <i *ngIf="ns.hasError" class="bi bi-exclamation-circle text-danger"></i>
              {{ ns.name }}
              <span class="badge bg-secondary ms-1" style="font-size: 0.65rem;">{{ ns.status }}</span>
            </label>
          </div>

          <div *ngIf="loading" class="text-center py-2">
            <div class="spinner-border spinner-border-sm text-primary"></div>
          </div>
          <div *ngIf="!loading && namespaces.length === 0" class="text-muted small text-center py-2">
            No namespaces found
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .namespace-filter { position: relative; }
    .namespace-dropdown { position: absolute; top: 100%; left: 0; z-index: 1000;
      min-width: 250px; background: #1e1e2e; border: 1px solid #313244; border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
    .form-check-label { cursor: pointer; }
  `]
})
export class NamespaceFilterComponent implements OnInit, OnDestroy {
  namespaces: KubeNamespace[] = [];
  selectedNamespaces: string[] = [];
  filterText = '';
  isOpen = false;
  loading = false;
  private sub?: Subscription;
  private clusterSub?: Subscription;

  constructor(private state: StateService, private k8s: KubernetesService) {}

  ngOnInit(): void {
    this.sub = this.state.selectedNamespaces.subscribe(ns => {
      this.selectedNamespaces = [...ns];
    });
    this.clusterSub = this.state.selectedCluster.subscribe(cluster => {
      if (cluster) this.loadNamespaces(cluster.contextName);
      else this.namespaces = [];
    });
    document.addEventListener('click', this.onDocumentClick);
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.clusterSub?.unsubscribe();
    document.removeEventListener('click', this.onDocumentClick);
  }

  private onDocumentClick = (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.namespace-filter')) this.isOpen = false;
  };

  private async loadNamespaces(contextName: string): Promise<void> {
    this.loading = true;
    try {
      this.namespaces = await this.k8s.getNamespaces(contextName);
    } catch {
      this.namespaces = [];
    } finally {
      this.loading = false;
    }
  }

  get filteredNamespaces(): KubeNamespace[] {
    if (!this.filterText) return this.namespaces;
    return this.namespaces.filter(ns =>
      ns.name.toLowerCase().includes(this.filterText.toLowerCase())
    );
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
  }

  isSelected(name: string): boolean {
    return this.selectedNamespaces.includes(name);
  }

  toggleNamespace(name: string): void {
    const idx = this.selectedNamespaces.indexOf(name);
    if (idx >= 0) {
      this.selectedNamespaces = this.selectedNamespaces.filter(n => n !== name);
    } else {
      this.selectedNamespaces = [...this.selectedNamespaces, name];
    }
    this.state.setSelectedNamespaces(this.selectedNamespaces);
  }

  selectAll(): void {
    this.selectedNamespaces = [];
    this.state.setSelectedNamespaces([]);
  }

  getLabel(): string {
    if (this.selectedNamespaces.length === 0) return 'All Namespaces';
    if (this.selectedNamespaces.length === 1) return this.selectedNamespaces[0];
    return `${this.selectedNamespaces.length} Namespaces`;
  }
}
