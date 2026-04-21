import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { DrawerService, DrawerConfig } from '../../services/drawer.service';
import { KubernetesService } from '../../services/kubernetes.service';
import { YamlEditorComponent } from './yaml-editor.component';

@Component({
  selector: 'app-object-drawer',
  standalone: true,
  imports: [CommonModule, YamlEditorComponent],
  template: `
    <div class="drawer-overlay" [class.show]="isOpen" (click)="onOverlayClick($event)">
      <div class="drawer-panel" [class.open]="isOpen" (click)="$event.stopPropagation()">
        <div class="drawer-header d-flex align-items-center justify-content-between">
          <div>
            <span class="badge bg-secondary me-2">{{ config?.resourceType }}</span>
            <span class="fw-semibold">{{ config?.resource?.metadata?.name }}</span>
            <span *ngIf="config?.namespace" class="text-muted ms-2 small">
              <i class="bi bi-folder2 me-1"></i>{{ config?.namespace }}
            </span>
          </div>
          <div class="d-flex align-items-center gap-2">
            <button *ngIf="!config?.readOnly" class="btn btn-sm btn-outline-danger"
              (click)="onDelete()" [disabled]="saving">
              <i class="bi bi-trash me-1"></i>Delete
            </button>
            <button class="btn-close btn-close-white" (click)="close()"></button>
          </div>
        </div>

        <div class="drawer-body">
          <div *ngIf="loading" class="d-flex justify-content-center align-items-center h-100">
            <div class="spinner-border text-primary"></div>
          </div>

          <div *ngIf="error" class="alert alert-danger m-3">
            <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
          </div>

          <div *ngIf="saveSuccess" class="alert alert-success m-3">
            <i class="bi bi-check-circle me-2"></i>Saved successfully
          </div>

          <app-yaml-editor *ngIf="!loading && fullResource"
            [resource]="fullResource"
            [resourceType]="config?.resourceType || ''"
            [readOnly]="config?.readOnly || false"
            (save)="onSave($event)">
          </app-yaml-editor>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .drawer-overlay {
      position: fixed; inset: 0; z-index: 1050;
      background: rgba(0,0,0,0.4);
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s;
    }
    .drawer-overlay.show { opacity: 1; pointer-events: all; }

    .drawer-panel {
      position: fixed; top: 0; right: 0; bottom: 0;
      width: 680px; max-width: 100vw;
      background: var(--bs-body-bg, #1e1e2e);
      color: var(--bs-body-color, #cdd6f4);
      transform: translateX(100%);
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      display: flex; flex-direction: column;
      box-shadow: -4px 0 24px rgba(0,0,0,0.5);
    }
    .drawer-panel.open { transform: translateX(0); }

    .drawer-header {
      padding: 1rem 1.25rem;
      background: #181825;
      border-bottom: 1px solid #313244;
      flex-shrink: 0;
    }

    .drawer-body {
      flex: 1; overflow-y: auto;
      padding: 1.25rem;
    }
  `]
})
export class ObjectDrawerComponent implements OnInit, OnDestroy {
  isOpen = false;
  config: DrawerConfig | null = null;
  fullResource: any = null;
  loading = false;
  saving = false;
  error: string | null = null;
  saveSuccess = false;

  private sub?: Subscription;

  constructor(
    private drawerService: DrawerService,
    private k8s: KubernetesService
  ) {}

  ngOnInit(): void {
    this.sub = this.drawerService.drawerState.subscribe(config => {
      if (config) {
        this.config = config;
        this.isOpen = true;
        this.error = null;
        this.saveSuccess = false;
        this.loadFullResource();
      } else {
        this.isOpen = false;
        setTimeout(() => { this.fullResource = null; this.config = null; }, 300);
      }
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  private async loadFullResource(): Promise<void> {
    if (!this.config) return;
    this.loading = true;
    this.error = null;
    try {
      const { contextName, namespace, resource, resourceType } = this.config;
      const name = resource?.metadata?.name;
      this.fullResource = await this.fetchResource(resourceType, contextName, namespace, name);
    } catch (e: any) {
      this.error = e.message || 'Failed to load resource';
      this.fullResource = this.config.resource;
    } finally {
      this.loading = false;
    }
  }

  private fetchResource(type: string, ctx: string, ns: string | undefined, name: string): Promise<any> {
    switch (type) {
      case 'Pod': return this.k8s.getPod(ctx, ns!, name);
      case 'Deployment': return this.k8s.getDeployment(ctx, ns!, name);
      case 'StatefulSet': return this.k8s.getStatefulSet(ctx, ns!, name);
      case 'DaemonSet': return this.k8s.getDaemonSet(ctx, ns!, name);
      case 'Job': return this.k8s.getJob(ctx, ns!, name);
      case 'CronJob': return this.k8s.getCronJob(ctx, ns!, name);
      case 'Service': return this.k8s.getService(ctx, ns!, name);
      case 'Ingress': return this.k8s.getIngress(ctx, ns!, name);
      case 'PersistentVolume': return this.k8s.getPersistentVolume(ctx, name);
      case 'PersistentVolumeClaim': return this.k8s.getPersistentVolumeClaim(ctx, ns!, name);
      case 'StorageClass': return this.k8s.getStorageClass(ctx, name);
      case 'ConfigMap': return this.k8s.getConfigMap(ctx, ns!, name);
      case 'Secret': return this.k8s.getSecret(ctx, ns!, name);
      case 'Node': return this.k8s.getNode(ctx, name);
      default: return Promise.resolve(this.config?.resource);
    }
  }

  async onSave(patch: any): Promise<void> {
    if (!this.config) return;
    this.saving = true;
    this.error = null;
    this.saveSuccess = false;
    try {
      const { contextName, namespace, resourceType } = this.config;
      const name = this.fullResource?.metadata?.name;
      await this.patchResource(resourceType, contextName, namespace, name, patch);
      this.saveSuccess = true;
      setTimeout(() => { this.saveSuccess = false; }, 3000);
      await this.loadFullResource();
    } catch (e: any) {
      this.error = e.message || 'Failed to save';
    } finally {
      this.saving = false;
    }
  }

  private patchResource(type: string, ctx: string, ns: string | undefined, name: string, patch: any): Promise<any> {
    switch (type) {
      case 'Deployment': return this.k8s.patchDeployment(ctx, ns!, name, patch);
      case 'StatefulSet': return this.k8s.patchStatefulSet(ctx, ns!, name, patch);
      case 'DaemonSet': return this.k8s.patchDaemonSet(ctx, ns!, name, patch);
      case 'CronJob': return this.k8s.patchCronJob(ctx, ns!, name, patch);
      case 'Service': return this.k8s.patchService(ctx, ns!, name, patch);
      case 'Ingress': return this.k8s.patchIngress(ctx, ns!, name, patch);
      case 'ConfigMap': return this.k8s.patchConfigMap(ctx, ns!, name, patch);
      case 'Secret': return this.k8s.patchSecret(ctx, ns!, name, patch);
      case 'Node': return this.k8s.patchNode(ctx, name, patch);
      default: return Promise.reject(new Error(`Patching ${type} is not supported`));
    }
  }

  async onDelete(): Promise<void> {
    if (!this.config || !confirm('Are you sure you want to delete this resource?')) return;
    this.saving = true;
    try {
      const { contextName, namespace, resourceType } = this.config;
      const name = this.fullResource?.metadata?.name;
      await this.deleteResource(resourceType, contextName, namespace, name);
      this.close();
    } catch (e: any) {
      this.error = e.message || 'Failed to delete';
    } finally {
      this.saving = false;
    }
  }

  private deleteResource(type: string, ctx: string, ns: string | undefined, name: string): Promise<any> {
    switch (type) {
      case 'Pod': return this.k8s.deletePod(ctx, ns!, name);
      case 'Deployment': return this.k8s.deleteDeployment(ctx, ns!, name);
      case 'StatefulSet': return this.k8s.deleteStatefulSet(ctx, ns!, name);
      case 'DaemonSet': return this.k8s.deleteDaemonSet(ctx, ns!, name);
      case 'Job': return this.k8s.deleteJob(ctx, ns!, name);
      case 'CronJob': return this.k8s.deleteCronJob(ctx, ns!, name);
      case 'Service': return this.k8s.deleteService(ctx, ns!, name);
      case 'Ingress': return this.k8s.deleteIngress(ctx, ns!, name);
      case 'PersistentVolume': return this.k8s.deletePersistentVolume(ctx, name);
      case 'PersistentVolumeClaim': return this.k8s.deletePersistentVolumeClaim(ctx, ns!, name);
      case 'ConfigMap': return this.k8s.deleteConfigMap(ctx, ns!, name);
      case 'Secret': return this.k8s.deleteSecret(ctx, ns!, name);
      default: return Promise.reject(new Error(`Deleting ${type} is not supported`));
    }
  }

  close(): void {
    this.drawerService.close();
  }

  onOverlayClick(event: MouseEvent): void {
    this.close();
  }
}
