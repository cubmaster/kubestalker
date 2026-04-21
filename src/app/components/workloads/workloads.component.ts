import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PodsComponent } from './pods/pods.component';
import { DeploymentsComponent } from './deployments/deployments.component';
import { StatefulSetsComponent } from './statefulsets/statefulsets.component';
import { DaemonSetsComponent } from './daemonsets/daemonsets.component';
import { JobsComponent } from './jobs/jobs.component';
import { CronJobsComponent } from './cronjobs/cronjobs.component';

type WorkloadTab = 'pods' | 'deployments' | 'statefulsets' | 'daemonsets' | 'jobs' | 'cronjobs';

@Component({
  selector: 'app-workloads',
  standalone: true,
  imports: [CommonModule, PodsComponent, DeploymentsComponent, StatefulSetsComponent,
    DaemonSetsComponent, JobsComponent, CronJobsComponent],
  template: `
    <div class="workloads-container">
      <ul class="nav nav-tabs mb-3">
        <li class="nav-item" *ngFor="let tab of tabs">
          <button class="nav-link" [class.active]="activeTab === tab.id" (click)="activeTab = tab.id">
            <i class="bi me-1" [class]="tab.icon"></i>{{ tab.label }}
          </button>
        </li>
      </ul>
      <div class="tab-content">
        <app-pods *ngIf="activeTab === 'pods'"></app-pods>
        <app-deployments *ngIf="activeTab === 'deployments'"></app-deployments>
        <app-statefulsets *ngIf="activeTab === 'statefulsets'"></app-statefulsets>
        <app-daemonsets *ngIf="activeTab === 'daemonsets'"></app-daemonsets>
        <app-jobs *ngIf="activeTab === 'jobs'"></app-jobs>
        <app-cronjobs *ngIf="activeTab === 'cronjobs'"></app-cronjobs>
      </div>
    </div>
  `
})
export class WorkloadsComponent {
  activeTab: WorkloadTab = 'pods';
  tabs = [
    { id: 'pods' as WorkloadTab, label: 'Pods', icon: 'bi-box' },
    { id: 'deployments' as WorkloadTab, label: 'Deployments', icon: 'bi-stack' },
    { id: 'statefulsets' as WorkloadTab, label: 'StatefulSets', icon: 'bi-database' },
    { id: 'daemonsets' as WorkloadTab, label: 'DaemonSets', icon: 'bi-hdd-network' },
    { id: 'jobs' as WorkloadTab, label: 'Jobs', icon: 'bi-briefcase' },
    { id: 'cronjobs' as WorkloadTab, label: 'CronJobs', icon: 'bi-clock' },
  ];
}
