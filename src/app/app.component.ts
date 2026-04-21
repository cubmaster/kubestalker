import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ClusterListComponent } from './components/cluster-list/cluster-list.component';
import { ClusterHomeComponent } from './components/cluster-home/cluster-home.component';
import { ObjectDrawerComponent } from './components/object-drawer/object-drawer.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, ClusterListComponent, ClusterHomeComponent, ObjectDrawerComponent],
  template: `
    <div class="app-layout">
      <aside class="app-sidebar">
        <app-cluster-list></app-cluster-list>
      </aside>
      <main class="app-content">
        <app-cluster-home></app-cluster-home>
      </main>
      <app-object-drawer></app-object-drawer>
    </div>
  `,
  styles: [`
    .app-layout {
      display: flex; height: 100vh; overflow: hidden;
      background: #1e1e2e; color: #cdd6f4;
    }
    .app-sidebar {
      width: 260px; flex-shrink: 0;
      border-right: 1px solid #313244;
      overflow: hidden; display: flex; flex-direction: column;
    }
    .app-content {
      flex: 1; overflow: hidden; display: flex; flex-direction: column;
    }
  `]
})
export class AppComponent {
  title = 'kubestalker';
}
