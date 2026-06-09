export interface KubeCluster {
  name: string;
  server: string;
  contextName: string;
  kubeconfigFile: string;
  namespace?: string;
}

export interface KubeNamespace {
  name: string;
  status: string;
  hasError?: boolean;
}

export interface KubeResource {
  name: string;
  namespace?: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
  creationTimestamp?: string;
  uid?: string;
  resourceVersion?: string;
  hasError?: boolean;
  raw?: any;
}

export interface KubePod extends KubeResource {
  nodeName?: string;
  phase?: string;
  conditions?: PodCondition[];
  containers?: ContainerStatus[];
  restarts?: number;
  ip?: string;
  ready?: string;
}

export interface PodCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface ContainerStatus {
  name: string;
  image: string;
  ready: boolean;
  restartCount: number;
  state?: string;
  reason?: string;
}

export interface KubeDeployment extends KubeResource {
  replicas?: number;
  readyReplicas?: number;
  updatedReplicas?: number;
  availableReplicas?: number;
  strategy?: string;
  conditions?: DeploymentCondition[];
}

export interface DeploymentCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface KubeStatefulSet extends KubeResource {
  replicas?: number;
  readyReplicas?: number;
  serviceName?: string;
}

export interface KubeDaemonSet extends KubeResource {
  desiredNumberScheduled?: number;
  currentNumberScheduled?: number;
  numberReady?: number;
  numberMisscheduled?: number;
}

export interface KubeJob extends KubeResource {
  completions?: number;
  succeeded?: number;
  failed?: number;
  active?: number;
  duration?: string;
  completionTime?: string;
  startTime?: string;
}

export interface KubeCronJob extends KubeResource {
  schedule?: string;
  suspend?: boolean;
  lastScheduleTime?: string;
  activeJobs?: number;
}

export interface KubeService extends KubeResource {
  type?: string;
  clusterIP?: string;
  externalIP?: string;
  ports?: ServicePort[];
  selector?: Record<string, string>;
}

export interface ServicePort {
  name?: string;
  port: number;
  targetPort?: string | number;
  protocol?: string;
  nodePort?: number;
}

export interface KubeEndpoints extends KubeResource {
  subsets?: EndpointSubset[];
  addresses?: string[];
  ports?: number[];
}

export interface EndpointSubset {
  addresses?: Array<{ ip: string; nodeName?: string }>;
  ports?: Array<{ port: number; protocol?: string }>;
}

export interface KubeIngress extends KubeResource {
  ingressClass?: string;
  rules?: IngressRule[];
  tls?: IngressTLS[];
  loadBalancerIP?: string;
}

export interface IngressRule {
  host?: string;
  paths?: Array<{ path: string; pathType?: string; backend?: string }>;
}

export interface IngressTLS {
  hosts?: string[];
  secretName?: string;
}

export interface KubePV extends KubeResource {
  capacity?: string;
  accessModes?: string[];
  storageClass?: string;
  status?: string;
  claimRef?: string;
  reclaimPolicy?: string;
}

export interface KubePVC extends KubeResource {
  storageClass?: string;
  accessModes?: string[];
  capacity?: string;
  status?: string;
  volumeName?: string;
}

export interface KubeStorageClass extends KubeResource {
  provisioner?: string;
  reclaimPolicy?: string;
  volumeBindingMode?: string;
  isDefault?: boolean;
}

export interface KubeConfigMap extends KubeResource {
  data?: Record<string, string>;
  binaryData?: Record<string, string>;
  dataCount?: number;
}

export interface KubeSecret extends KubeResource {
  type?: string;
  data?: Record<string, string>;
  decodedData?: Record<string, string>;
  dataCount?: number;
}

export interface KubeNode extends KubeResource {
  roles?: string[];
  status?: string;
  version?: string;
  osImage?: string;
  kernelVersion?: string;
  containerRuntime?: string;
  cpu?: string;
  memory?: string;
  conditions?: NodeCondition[];
  addresses?: NodeAddress[];
  taints?: NodeTaint[];
}

export interface NodeCondition {
  type: string;
  status: string;
  reason?: string;
  message?: string;
}

export interface NodeAddress {
  type: string;
  address: string;
}

export interface NodeTaint {
  key: string;
  value?: string;
  effect: string;
}

export interface AppState {
  selectedCluster?: string;
  selectedNamespaces: string[];
  recentClusters: string[];
}

export interface IpcResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}
