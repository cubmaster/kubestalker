import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { KubernetesService } from '../../../services/kubernetes.service';
import { StateService } from '../../../services/state.service';
import { DrawerService } from '../../../services/drawer.service';
import { KubeStorageClass } from '../../../models/kubernetes.models';

@Component({
  selector: 'app-storage-classes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-list">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-muted">Storage Classes <span class="badge bg-secondary">{{ filtered.length }}</span></h6>
        <div class="d-flex gap-2">
          <input type="text" class="form-control form-control-sm" style="width:200px" placeholder="Search..." [(ngModel)]="searchText">
          <button class="btn btn-sm btn-outline-secondary" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise" [class.spin]="loading"></i></button>
        </div>
      </div>
      <div *ngIf="error" class="alert alert-danger py-2">{{ error }}</div>
      <div *ngIf="loading&&items.length===0" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div class="table-responsive">
        <table class="table table-sm table-hover table-dark">
          <thead><tr><th>Name</th><th>Provisioner</th><th>Reclaim Policy</th><th>Volume Binding Mode</th><th>Default</th><th>Age</th></tr></thead>
          <tbody>
            <tr *ngFor="let item of filtered" [class.table-danger]="item.hasError" (click)="openDrawer(item)" style="cursor:pointer">
              <td>{{ item.name }}</td>
              <td class="small">{{ item.provisioner }}</td>
              <td class="text-muted small">{{ item.reclaimPolicy }}</td>
              <td class="text-muted small">{{ item.volumeBindingMode }}</td>
              <td><span *ngIf="item.isDefault" class="badge bg-success">Default</span></td>
              <td class="text-muted small">{{ getAge(item.creationTimestamp) }}</td>
            </tr>
            <tr *ngIf="filtered.length===0&&!loading"><td colspan="6" class="text-center text-muted py-4">No storage classes found</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`]
})
export class StorageClassesComponent implements OnInit, OnDestroy {
  items:KubeStorageClass[]=[]; searchText=''; loading=false; error:string|null=null;
  private ctx=''; private sub?:Subscription;
  constructor(private k8s:KubernetesService,private state:StateService,private drawer:DrawerService){}
  ngOnInit(){this.sub=this.state.selectedCluster.subscribe(c=>{if(c){this.ctx=c.contextName;this.load();}})}
  ngOnDestroy(){this.sub?.unsubscribe()}
  async load(){this.loading=true;this.error=null;try{this.items=await this.k8s.getStorageClasses(this.ctx)}catch(e:any){this.error=e.message}finally{this.loading=false}}
  get filtered(){return this.searchText?this.items.filter(i=>i.name.toLowerCase().includes(this.searchText.toLowerCase())):this.items}
  getAge(ts?:string){if(!ts)return'-';const d=Math.floor((Date.now()-new Date(ts).getTime())/86400000);return d>0?`${d}d`:`${Math.floor((Date.now()-new Date(ts).getTime())/3600000)}h`}
  openDrawer(item:KubeStorageClass){this.drawer.open({resource:item.raw||item,resourceType:'StorageClass',contextName:this.ctx,readOnly:true})}
}
