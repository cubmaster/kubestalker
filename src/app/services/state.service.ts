import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { KubeCluster, AppState } from '../models/kubernetes.models';

@Injectable({ providedIn: 'root' })
export class StateService {
  private state: AppState = {
    selectedCluster: undefined,
    selectedNamespaces: [],
    recentClusters: []
  };

  private selectedCluster$ = new BehaviorSubject<KubeCluster | null>(null);
  private selectedNamespaces$ = new BehaviorSubject<string[]>([]);
  private clusters$ = new BehaviorSubject<KubeCluster[]>([]);

  selectedCluster = this.selectedCluster$.asObservable();
  selectedNamespaces = this.selectedNamespaces$.asObservable();
  clusters = this.clusters$.asObservable();

  setSelectedCluster(cluster: KubeCluster | null): void {
    this.selectedCluster$.next(cluster);
    this.selectedNamespaces$.next([]);
    if (cluster) {
      this.state.selectedCluster = cluster.contextName;
      if (!this.state.recentClusters.includes(cluster.contextName)) {
        this.state.recentClusters.unshift(cluster.contextName);
        if (this.state.recentClusters.length > 10) {
          this.state.recentClusters.pop();
        }
      }
    }
  }

  setSelectedNamespaces(namespaces: string[]): void {
    this.state.selectedNamespaces = namespaces;
    this.selectedNamespaces$.next(namespaces);
  }

  setClusters(clusters: KubeCluster[]): void {
    this.clusters$.next(clusters);
  }

  getSelectedCluster(): KubeCluster | null {
    return this.selectedCluster$.getValue();
  }

  getSelectedNamespaces(): string[] {
    return this.selectedNamespaces$.getValue();
  }
}
