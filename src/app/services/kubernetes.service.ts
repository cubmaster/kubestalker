import { Injectable } from '@angular/core';
import { Observable, from } from 'rxjs';
import { ElectronService } from './electron.service';
import {
  KubeCluster, KubeNamespace, KubePod, KubeDeployment, KubeStatefulSet,
  KubeDaemonSet, KubeJob, KubeCronJob, KubeService, KubeEndpoints,
  KubeIngress, KubePV, KubePVC, KubeStorageClass, KubeConfigMap,
  KubeSecret, KubeNode, IpcResponse
} from '../models/kubernetes.models';

@Injectable({ providedIn: 'root' })
export class KubernetesService {
  constructor(private electron: ElectronService) {}

  private async call<T>(channel: string, ...args: any[]): Promise<T> {
    const response = await this.electron.invoke<T>(channel, ...args);
    if (!response.success) {
      throw new Error(response.error || 'Unknown error');
    }
    return response.data as T;
  }

  getClusters(): Promise<KubeCluster[]> {
    return this.call<KubeCluster[]>('k8s:getClusters');
  }

  getNamespaces(contextName: string): Promise<KubeNamespace[]> {
    return this.call<KubeNamespace[]>('k8s:getNamespaces', contextName);
  }

  getPods(contextName: string, namespaces: string[]): Promise<KubePod[]> {
    return this.call<KubePod[]>('k8s:getPods', contextName, namespaces);
  }

  getPod(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getPod', contextName, namespace, name);
  }

  deletePod(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deletePod', contextName, namespace, name);
  }

  getDeployments(contextName: string, namespaces: string[]): Promise<KubeDeployment[]> {
    return this.call<KubeDeployment[]>('k8s:getDeployments', contextName, namespaces);
  }

  getDeployment(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getDeployment', contextName, namespace, name);
  }

  createDeployment(contextName: string, namespace: string, body: any): Promise<any> {
    return this.call<any>('k8s:createDeployment', contextName, namespace, body);
  }

  updateDeployment(contextName: string, namespace: string, name: string, body: any): Promise<any> {
    return this.call<any>('k8s:updateDeployment', contextName, namespace, name, body);
  }

  patchDeployment(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchDeployment', contextName, namespace, name, patch);
  }

  deleteDeployment(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteDeployment', contextName, namespace, name);
  }

  restartDeployment(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:restartDeployment', contextName, namespace, name);
  }

  getStatefulSets(contextName: string, namespaces: string[]): Promise<KubeStatefulSet[]> {
    return this.call<KubeStatefulSet[]>('k8s:getStatefulSets', contextName, namespaces);
  }

  getStatefulSet(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getStatefulSet', contextName, namespace, name);
  }

  patchStatefulSet(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchStatefulSet', contextName, namespace, name, patch);
  }

  deleteStatefulSet(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteStatefulSet', contextName, namespace, name);
  }

  getDaemonSets(contextName: string, namespaces: string[]): Promise<KubeDaemonSet[]> {
    return this.call<KubeDaemonSet[]>('k8s:getDaemonSets', contextName, namespaces);
  }

  getDaemonSet(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getDaemonSet', contextName, namespace, name);
  }

  patchDaemonSet(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchDaemonSet', contextName, namespace, name, patch);
  }

  deleteDaemonSet(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteDaemonSet', contextName, namespace, name);
  }

  getJobs(contextName: string, namespaces: string[]): Promise<KubeJob[]> {
    return this.call<KubeJob[]>('k8s:getJobs', contextName, namespaces);
  }

  getJob(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getJob', contextName, namespace, name);
  }

  deleteJob(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteJob', contextName, namespace, name);
  }

  getCronJobs(contextName: string, namespaces: string[]): Promise<KubeCronJob[]> {
    return this.call<KubeCronJob[]>('k8s:getCronJobs', contextName, namespaces);
  }

  getCronJob(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getCronJob', contextName, namespace, name);
  }

  patchCronJob(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchCronJob', contextName, namespace, name, patch);
  }

  deleteCronJob(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteCronJob', contextName, namespace, name);
  }

  getServices(contextName: string, namespaces: string[]): Promise<KubeService[]> {
    return this.call<KubeService[]>('k8s:getServices', contextName, namespaces);
  }

  getService(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getService', contextName, namespace, name);
  }

  patchService(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchService', contextName, namespace, name, patch);
  }

  deleteService(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteService', contextName, namespace, name);
  }

  getEndpoints(contextName: string, namespaces: string[]): Promise<KubeEndpoints[]> {
    return this.call<KubeEndpoints[]>('k8s:getEndpoints', contextName, namespaces);
  }

  getIngresses(contextName: string, namespaces: string[]): Promise<KubeIngress[]> {
    return this.call<KubeIngress[]>('k8s:getIngresses', contextName, namespaces);
  }

  getIngress(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getIngress', contextName, namespace, name);
  }

  patchIngress(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchIngress', contextName, namespace, name, patch);
  }

  deleteIngress(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteIngress', contextName, namespace, name);
  }

  getPersistentVolumes(contextName: string): Promise<KubePV[]> {
    return this.call<KubePV[]>('k8s:getPersistentVolumes', contextName);
  }

  getPersistentVolume(contextName: string, name: string): Promise<any> {
    return this.call<any>('k8s:getPersistentVolume', contextName, name);
  }

  deletePersistentVolume(contextName: string, name: string): Promise<void> {
    return this.call<void>('k8s:deletePersistentVolume', contextName, name);
  }

  getPersistentVolumeClaims(contextName: string, namespaces: string[]): Promise<KubePVC[]> {
    return this.call<KubePVC[]>('k8s:getPersistentVolumeClaims', contextName, namespaces);
  }

  getPersistentVolumeClaim(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getPersistentVolumeClaim', contextName, namespace, name);
  }

  deletePersistentVolumeClaim(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deletePersistentVolumeClaim', contextName, namespace, name);
  }

  getStorageClasses(contextName: string): Promise<KubeStorageClass[]> {
    return this.call<KubeStorageClass[]>('k8s:getStorageClasses', contextName);
  }

  getStorageClass(contextName: string, name: string): Promise<any> {
    return this.call<any>('k8s:getStorageClass', contextName, name);
  }

  getConfigMaps(contextName: string, namespaces: string[]): Promise<KubeConfigMap[]> {
    return this.call<KubeConfigMap[]>('k8s:getConfigMaps', contextName, namespaces);
  }

  getConfigMap(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getConfigMap', contextName, namespace, name);
  }

  patchConfigMap(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchConfigMap', contextName, namespace, name, patch);
  }

  createConfigMap(contextName: string, namespace: string, body: any): Promise<any> {
    return this.call<any>('k8s:createConfigMap', contextName, namespace, body);
  }

  deleteConfigMap(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteConfigMap', contextName, namespace, name);
  }

  getSecrets(contextName: string, namespaces: string[]): Promise<KubeSecret[]> {
    return this.call<KubeSecret[]>('k8s:getSecrets', contextName, namespaces);
  }

  getSecret(contextName: string, namespace: string, name: string): Promise<any> {
    return this.call<any>('k8s:getSecret', contextName, namespace, name);
  }

  patchSecret(contextName: string, namespace: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchSecret', contextName, namespace, name, patch);
  }

  createSecret(contextName: string, namespace: string, body: any): Promise<any> {
    return this.call<any>('k8s:createSecret', contextName, namespace, body);
  }

  deleteSecret(contextName: string, namespace: string, name: string): Promise<void> {
    return this.call<void>('k8s:deleteSecret', contextName, namespace, name);
  }

  getNodes(contextName: string): Promise<KubeNode[]> {
    return this.call<KubeNode[]>('k8s:getNodes', contextName);
  }

  getNode(contextName: string, name: string): Promise<any> {
    return this.call<any>('k8s:getNode', contextName, name);
  }

  patchNode(contextName: string, name: string, patch: any): Promise<any> {
    return this.call<any>('k8s:patchNode', contextName, name, patch);
  }

  applyResource(contextName: string, namespace: string, resource: any): Promise<any> {
    return this.call<any>('k8s:applyResource', contextName, namespace, resource);
  }
}
