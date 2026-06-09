import { fakeAsync, tick } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { NamespaceFilterComponent } from './namespace-filter.component';
import { StateService } from '../../services/state.service';
import { KubernetesService } from '../../services/kubernetes.service';
import { KubeCluster } from '../../models/kubernetes.models';

describe('NamespaceFilterComponent', () => {
  let component: NamespaceFilterComponent;
  let selectedNamespaces$: BehaviorSubject<string[]>;
  let selectedCluster$: BehaviorSubject<KubeCluster | null>;
  let state: jasmine.SpyObj<StateService>;
  let k8s: jasmine.SpyObj<KubernetesService>;

  beforeEach(() => {
    selectedNamespaces$ = new BehaviorSubject<string[]>([]);
    selectedCluster$ = new BehaviorSubject<KubeCluster | null>(null);
    state = jasmine.createSpyObj<StateService>('StateService', ['setSelectedNamespaces'], {
      selectedNamespaces: selectedNamespaces$.asObservable(),
      selectedCluster: selectedCluster$.asObservable()
    });
    k8s = jasmine.createSpyObj<KubernetesService>('KubernetesService', ['getNamespaces']);
    component = new NamespaceFilterComponent(state, k8s);
    component.namespaces = [
      { name: 'default', status: 'Active' },
      { name: 'kube-system', status: 'Active' }
    ];
  });

  it('uses typed namespace when it is not in the loaded namespace list', fakeAsync(() => {
    component.onFilterTextChange('preview-123');
    tick(350);

    expect(component.selectedNamespaces).toEqual(['preview-123']);
    expect(state.setSelectedNamespaces).toHaveBeenCalledWith(['preview-123']);
    expect(component.getLabel()).toBe('preview-123');
  }));

  it('debounces typed namespaces so commands use the final typed value', fakeAsync(() => {
    component.onFilterTextChange('t');
    tick(100);
    component.onFilterTextChange('td');
    tick(100);
    component.onFilterTextChange('tda');
    tick(349);

    expect(state.setSelectedNamespaces).not.toHaveBeenCalled();

    tick(1);

    expect(component.selectedNamespaces).toEqual(['tda']);
    expect(state.setSelectedNamespaces).toHaveBeenCalledTimes(1);
    expect(state.setSelectedNamespaces).toHaveBeenCalledWith(['tda']);
  }));

  it('commits typed namespace immediately when requested', () => {
    component.onFilterTextChange('tda');
    component.useTypedNamespace();

    expect(component.selectedNamespaces).toEqual(['tda']);
    expect(state.setSelectedNamespaces).toHaveBeenCalledWith(['tda']);
  });

  it('does not turn an exact namespace match into a custom selection', () => {
    component.onFilterTextChange('default');

    expect(component.selectedNamespaces).toEqual([]);
    expect(state.setSelectedNamespaces).not.toHaveBeenCalled();
    expect(component.customNamespaceCandidate).toBe('');
  });

  it('returns to all namespaces when an implicit custom namespace filter is cleared', () => {
    component.onFilterTextChange('preview-123');
    component.useTypedNamespace();
    state.setSelectedNamespaces.calls.reset();

    component.onFilterTextChange('');

    expect(component.selectedNamespaces).toEqual([]);
    expect(state.setSelectedNamespaces).toHaveBeenCalledWith([]);
  });
});
