import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { KubernetesService } from '../../../services/kubernetes.service';
import { StateService } from '../../../services/state.service';
import { DrawerService } from '../../../services/drawer.service';
import { KubePVC } from '../../../models/kubernetes.models';

@Component({
  selector: 'app-pvc',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-list">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-muted">Persistent Volume Claims <span class="badge bg-secondary">{{ filtered.length }}</span></h6>
        <div class="d-flex gap-2">
          <input type="text" class="form-control form-control-sm" style="width:200px" placeholder="Search..." [(ngModel)]="searchText">
          <button class="btn btn-sm btn-outline-secondary" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise" [class.spin]="loading"></i></button>
        </div>
      </div>
      <div *ngIf="error" class="alert alert-danger py-2">{{ error }}</div>
      <div *ngIf="loading&&items.length===0" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div class="table-responsive">
        <table class="table table-sm table-hover table-dark">
          <thead><tr><th>Name</th><th>Namespace</th><th>Status</th><th>Volume</th><th>Capacity</th><th>Access Modes</th><th>Storage Class</th><th>Age</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let item of filtered" [class.table-danger]="item.hasError" (click)="openDrawer(item)" style="cursor:pointer">
              <td>{{ item.name }}</td>
              <td><span class="badge bg-secondary-subtle text-secondary-emphasis">{{ item.namespace }}</span></td>
              <td><span class="badge" [ngClass]="getStatusClass(item.status)">{{ item.status }}</span></td>
              <td class="text-muted small">{{ item.volumeName }}</td>
              <td>{{ item.capacity }}</td>
              <td class="small">{{ item.accessModes?.join(', ') }}</td>
              <td class="text-muted small">{{ item.storageClass }}</td>
              <td class="text-muted small">{{ getAge(item.creationTimestamp) }}</td>
              <td><button class="btn btn-sm btn-outline-danger p-1" (click)="deleteItem(item,$event)"><i class="bi bi-trash"></i></button></td>
            </tr>
            <tr *ngIf="filtered.length===0&&!loading"><td colspan="9" class="text-center text-muted py-4">No PVCs found</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`]
})
export class PvcComponent implements OnInit, OnDestroy {
  items:KubePVC[]=[]; searchText=''; loading=false; error:string|null=null;
  private ctx=''; private ns:string[]=[]; private sub?:Subscription;
  constructor(private k8s:KubernetesService,private state:StateService,private drawer:DrawerService){}
  ngOnInit(){this.sub=combineLatest([this.state.selectedCluster,this.state.selectedNamespaces]).subscribe(([c,ns])=>{if(c){this.ctx=c.contextName;this.ns=ns;this.load();}})}
  ngOnDestroy(){this.sub?.unsubscribe()}
  async load(){this.loading=true;this.error=null;try{this.items=await this.k8s.getPersistentVolumeClaims(this.ctx,this.ns)}catch(e:any){this.error=e.message}finally{this.loading=false}}
  get filtered(){return this.searchText?this.items.filter(i=>i.name.toLowerCase().includes(this.searchText.toLowerCase())):this.items}
  getAge(ts?:string){if(!ts)return'-';const d=Math.floor((Date.now()-new Date(ts).getTime())/86400000);return d>0?`${d}d`:`${Math.floor((Date.now()-new Date(ts).getTime())/3600000)}h`}
  getStatusClass(s?:string){switch(s){case'Bound':return'bg-success';case'Pending':return'bg-warning text-dark';default:return'bg-secondary'}}
  openDrawer(item:KubePVC){this.drawer.open({resource:item.raw||item,resourceType:'PersistentVolumeClaim',contextName:this.ctx,namespace:item.namespace})}
  async deleteItem(item:KubePVC,e:Event){e.stopPropagation();if(!confirm(`Delete PVC "${item.name}"?`))return;try{await this.k8s.deletePersistentVolumeClaim(this.ctx,item.namespace!,item.name);this.items=this.items.filter(i=>i!==item)}catch(err:any){this.error=err.message}}
}
