import { StateService } from './state.service';
import { KubeCluster } from '../models/kubernetes.models';

describe('StateService', () => {
  let service: StateService;

  beforeEach(() => {
    service = new StateService();
  });

  it('defaults selected namespaces from the kubeconfig context namespace', () => {
    const cluster: KubeCluster = {
      name: 'tda-stg-readonly',
      contextName: 'tda-stg-readonly',
      server: 'https://example.invalid',
      kubeconfigFile: 'tda-stg.yml',
      namespace: 'tax-dynamic-agents-stg'
    };

    service.setSelectedCluster(cluster);

    expect(service.getSelectedNamespaces()).toEqual(['tax-dynamic-agents-stg']);
  });

  it('uses all namespaces when the context has no default namespace', () => {
    const cluster: KubeCluster = {
      name: 'docker-desktop',
      contextName: 'docker-desktop',
      server: 'https://example.invalid',
      kubeconfigFile: 'config'
    };

    service.setSelectedCluster(cluster);

    expect(service.getSelectedNamespaces()).toEqual([]);
  });
});
