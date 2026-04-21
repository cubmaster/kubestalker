import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription, combineLatest } from 'rxjs';
import { KubernetesService } from '../../../services/kubernetes.service';
import { StateService } from '../../../services/state.service';
import { DrawerService } from '../../../services/drawer.service';
import { KubeCronJob } from '../../../models/kubernetes.models';

@Component({
  selector: 'app-cronjobs',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="resource-list">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h6 class="mb-0 text-muted">CronJobs <span class="badge bg-secondary">{{ filtered.length }}</span></h6>
        <div class="d-flex gap-2">
          <input type="text" class="form-control form-control-sm" style="width:200px" placeholder="Search..." [(ngModel)]="searchText">
          <button class="btn btn-sm btn-outline-secondary" (click)="load()" [disabled]="loading"><i class="bi bi-arrow-clockwise" [class.spin]="loading"></i></button>
        </div>
      </div>
      <div *ngIf="error" class="alert alert-danger py-2">{{ error }}</div>
      <div *ngIf="loading&&items.length===0" class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      <div class="table-responsive">
        <table class="table table-sm table-hover table-dark">
          <thead><tr><th>Name</th><th>Namespace</th><th>Schedule</th><th>Suspend</th><th>Active</th><th>Last Schedule</th><th>Age</th><th></th></tr></thead>
          <tbody>
            <tr *ngFor="let item of filtered" [class.table-danger]="item.hasError" (click)="openDrawer(item)" style="cursor:pointer">
              <td><i *ngIf="item.hasError" class="bi bi-exclamation-circle text-danger me-1"></i>{{ item.name }}</td>
              <td><span class="badge bg-secondary-subtle text-secondary-emphasis">{{ item.namespace }}</span></td>
              <td class="font-monospace small">{{ item.schedule }}</td>
              <td><span class="badge" [class.bg-warning]="item.suspend" [class.text-dark]="item.suspend" [class.bg-success]="!item.suspend">{{ item.suspend ? 'Suspended' : 'Active' }}</span></td>
              <td>{{ item.activeJobs||0 }}</td>
              <td class="text-muted small">{{ item.lastScheduleTime ? getAge(item.lastScheduleTime) + ' ago' : 'Never' }}</td>
              <td class="text-muted small">{{ getAge(item.creationTimestamp) }}</td>
              <td><button class="btn btn-sm btn-outline-danger p-1" (click)="deleteItem(item,$event)"><i class="bi bi-trash"></i></button></td>
            </tr>
            <tr *ngIf="filtered.length===0&&!loading"><td colspan="8" class="text-center text-muted py-4">No cronjobs found</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`]
})
export class CronJobsComponent implements OnInit, OnDestroy {
  items:KubeCronJob[]=[]; searchText=''; loading=false; error:string|null=null;
  private ctx=''; private ns:string[]=[]; private sub?:Subscription;
  constructor(private k8s:KubernetesService,private state:StateService,private drawer:DrawerService){}
  ngOnInit(){this.sub=combineLatest([this.state.selectedCluster,this.state.selectedNamespaces]).subscribe(([c,ns])=>{if(c){this.ctx=c.contextName;this.ns=ns;this.load();}})}
  ngOnDestroy(){this.sub?.unsubscribe()}
  async load(){this.loading=true;this.error=null;try{this.items=await this.k8s.getCronJobs(this.ctx,this.ns)}catch(e:any){this.error=e.message}finally{this.loading=false}}
  get filtered(){return this.searchText?this.items.filter(i=>i.name.toLowerCase().includes(this.searchText.toLowerCase())):this.items}
  getAge(ts?:string){if(!ts)return'-';const d=Math.floor((Date.now()-new Date(ts).getTime())/86400000);return d>0?`${d}d`:`${Math.floor((Date.now()-new Date(ts).getTime())/3600000)}h`}
  openDrawer(item:KubeCronJob){this.drawer.open({resource:item.raw||item,resourceType:'CronJob',contextName:this.ctx,namespace:item.namespace})}
  async deleteItem(item:KubeCronJob,e:Event){e.stopPropagation();if(!confirm(`Delete "${item.name}"?`))return;try{await this.k8s.deleteCronJob(this.ctx,item.namespace!,item.name);this.items=this.items.filter(i=>i!==item)}catch(err:any){this.error=err.message}}
}
