import { Component, Input, Output, EventEmitter, OnInit, OnChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { KubernetesService } from '../../services/kubernetes.service';
import * as yaml from 'js-yaml';

@Component({
  selector: 'app-yaml-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="yaml-editor">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <ul class="nav nav-tabs nav-sm">
          <li class="nav-item">
            <button class="nav-link" [class.active]="activeTab === 'form'" (click)="activeTab = 'form'">
              <i class="bi bi-ui-checks me-1"></i>Form
            </button>
          </li>
          <li class="nav-item">
            <button class="nav-link" [class.active]="activeTab === 'yaml'" (click)="activeTab = 'yaml'">
              <i class="bi bi-code me-1"></i>YAML
            </button>
          </li>
          <li *ngIf="resourceType === 'Pod'" class="nav-item">
            <button class="nav-link" [class.active]="activeTab === 'describe'" (click)="activeTab = 'describe'">
              <i class="bi bi-card-text me-1"></i>Describe
            </button>
          </li>
          <li *ngIf="resourceType === 'Pod'" class="nav-item">
            <button class="nav-link" [class.active]="activeTab === 'logs'" (click)="selectLogsTab()">
              <i class="bi bi-terminal me-1"></i>Logs
            </button>
          </li>
        </ul>
        <div *ngIf="!readOnly">
          <button class="btn btn-sm btn-primary me-2" (click)="onSave()">
            <i class="bi bi-check-lg me-1"></i>Save
          </button>
          <button class="btn btn-sm btn-outline-secondary" (click)="onReset()">
            <i class="bi bi-arrow-counterclockwise me-1"></i>Reset
          </button>
        </div>
      </div>

      <div *ngIf="activeTab === 'yaml'" class="yaml-view">
        <textarea *ngIf="!readOnly" class="form-control yaml-textarea font-monospace"
          [(ngModel)]="yamlContent" (ngModelChange)="yamlEdited = true"
          spellcheck="false" wrap="off"
          style="min-height: 600px; font-size: 12px; background:#11111b; color:#cdd6f4; border-color:#313244;"></textarea>
        <pre *ngIf="readOnly" class="bg-dark text-light p-3 rounded" style="max-height: 600px; overflow-y: auto; font-size: 12px;">{{ yamlContent }}</pre>
        <div *ngIf="yamlError" class="alert alert-danger py-2 small mt-2">{{ yamlError }}</div>
      </div>

      <div *ngIf="activeTab === 'describe' && resourceType === 'Pod'" class="describe-view">
        <pre class="describe-output p-3 rounded" style="overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all;">{{ describeContent }}</pre>
      </div>

      <div *ngIf="activeTab === 'logs' && resourceType === 'Pod'" class="logs-view">
        <div class="d-flex align-items-center gap-2 mb-3">
          <label class="form-label mb-0 small text-muted">Container:</label>
          <select class="form-select form-select-sm" style="width: 250px;"
            [(ngModel)]="selectedContainer" (ngModelChange)="loadLogs()">
            <option *ngFor="let c of containerNames" [value]="c">{{ c }}</option>
          </select>
          <button class="btn btn-sm btn-outline-secondary" (click)="loadLogs()" [disabled]="logsLoading">
            <i class="bi bi-arrow-clockwise" [class.spin]="logsLoading"></i>
          </button>
          <div class="form-check ms-auto">
            <input class="form-check-input" type="checkbox" id="autoRefreshLogs"
              [(ngModel)]="logsAutoRefresh" (ngModelChange)="toggleLogsAutoRefresh()">
            <label class="form-check-label small text-muted" for="autoRefreshLogs">Auto-refresh (5s)</label>
          </div>
        </div>
        <div *ngIf="logsError" class="alert alert-danger py-2 small">{{ logsError }}</div>
        <pre class="logs-output p-3 rounded" style="overflow-y: auto; font-size: 11px; white-space: pre-wrap; word-break: break-all; max-height: calc(100vh - 280px);">{{ logsContent || 'No logs available' }}</pre>
      </div>

      <div *ngIf="activeTab === 'form'" class="form-view">
        <div *ngIf="formFields.length === 0" class="text-muted text-center p-4">
          No editable fields available
        </div>
        <form *ngIf="formGroup && formFields.length > 0" [formGroup]="formGroup">
          <div *ngFor="let field of formFields" class="mb-3">
            <label class="form-label fw-semibold">{{ field.label }}</label>
            <small *ngIf="field.description" class="form-text text-muted d-block mb-1">{{ field.description }}</small>
            <textarea *ngIf="field.type === 'textarea'" class="form-control font-monospace"
              [formControlName]="field.key" [attr.disabled]="readOnly ? true : null" rows="4"></textarea>
            <select *ngIf="field.type === 'select'" class="form-select"
              [formControlName]="field.key" [attr.disabled]="readOnly ? true : null">
              <option *ngFor="let opt of field.options" [value]="opt.value">{{ opt.label }}</option>
            </select>
            <div *ngIf="field.type === 'keyvalue'" class="keyvalue-editor">
              <div *ngFor="let kv of getKeyValues(field.key); let i = index" class="input-group mb-1">
                <input type="text" class="form-control form-control-sm" [value]="kv.key"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueKey(field.key, i, $any($event.target).value)" placeholder="Key">
                <input type="text" class="form-control form-control-sm" [value]="kv.value"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueValue(field.key, i, $any($event.target).value)" placeholder="Value">
                <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-danger"
                  (click)="removeKeyValue(field.key, i)"><i class="bi bi-x"></i></button>
              </div>
              <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-secondary"
                (click)="addKeyValue(field.key)"><i class="bi bi-plus me-1"></i>Add</button>
            </div>
            <div *ngIf="field.type === 'secret-keyvalue'" class="keyvalue-editor">
              <div *ngFor="let kv of getKeyValues(field.key); let i = index" class="input-group mb-1">
                <input type="text" class="form-control form-control-sm" [value]="kv.key"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueKey(field.key, i, $any($event.target).value)" placeholder="Key">
                <textarea class="form-control form-control-sm font-monospace" [value]="kv.value" rows="1"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueValue(field.key, i, $any($event.target).value)"
                  placeholder="Value (decoded)"></textarea>
                <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-danger"
                  (click)="removeKeyValue(field.key, i)"><i class="bi bi-x"></i></button>
              </div>
              <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-secondary"
                (click)="addKeyValue(field.key)"><i class="bi bi-plus me-1"></i>Add</button>
            </div>
            <input *ngIf="field.type === 'text' || field.type === 'number'" [type]="field.type"
              class="form-control" [formControlName]="field.key" [attr.disabled]="readOnly ? true : null">
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .yaml-editor { font-size: 14px; }
    .nav-tabs .nav-link { padding: 0.25rem 0.75rem; font-size: 0.875rem; }
    .keyvalue-editor .input-group { flex-wrap: nowrap; }
    .keyvalue-editor .form-control { background: #181825; border-color: #45475a; color: #cdd6f4; }
    .keyvalue-editor .form-control:focus { background: #181825; border-color: #89b4fa; color: #cdd6f4; box-shadow: 0 0 0 0.2rem rgba(137,180,250,0.15); }
    .keyvalue-editor .form-control[disabled] { background: #11111b; color: #a6adc8; opacity: 0.8; }
    .describe-output { background: #11111b; color: #a6e3a1; font-family: 'JetBrains Mono', 'Fira Code', monospace; border: 1px solid #313244; }
    .logs-output { background: #11111b; color: #cdd6f4; font-family: 'JetBrains Mono', 'Fira Code', monospace; border: 1px solid #313244; }
    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
  `]
})
export class YamlEditorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() resource: any;
  @Input() resourceType: string = '';
  @Input() readOnly: boolean = false;
  @Input() contextName: string = '';
  @Input() namespace: string = '';
  @Output() save = new EventEmitter<any>();

  activeTab: 'form' | 'yaml' | 'describe' | 'logs' = 'form';
  yamlContent = '';
  yamlEdited = false;
  yamlError: string | null = null;
  describeContent = '';
  formGroup: FormGroup | null = null;
  formFields: FormField[] = [];
  containerNames: string[] = [];
  selectedContainer = '';
  logsContent = '';
  logsLoading = false;
  logsError: string | null = null;
  logsAutoRefresh = false;
  private logsInterval: any;
  private keyValueData: Record<string, Array<{key: string, value: string}>> = {};
  private originalResource: any;

  constructor(private fb: FormBuilder, private k8s: KubernetesService) {}

  ngOnInit(): void { this.initializeEditor(); }
  ngOnChanges(): void { this.initializeEditor(); }
  ngOnDestroy(): void { this.clearLogsInterval(); }

  private initializeEditor(): void {
    if (!this.resource) return;
    this.originalResource = JSON.parse(JSON.stringify(this.resource));
    this.yamlContent = yaml.dump(this.resource, { lineWidth: -1 });
    this.yamlEdited = false;
    this.yamlError = null;
    if (this.resourceType === 'Pod') {
      this.describeContent = this.buildPodDescribe(this.resource);
      this.containerNames = this.getContainerNames();
      if (this.containerNames.length > 0 && !this.selectedContainer) {
        this.selectedContainer = this.containerNames[0];
      }
    }
    this.buildForm();
  }

  private getContainerNames(): string[] {
    const names: string[] = [];
    const spec = this.resource?.spec;
    if (spec?.initContainers) { for (const c of spec.initContainers) names.push(c.name); }
    if (spec?.containers) { for (const c of spec.containers) names.push(c.name); }
    return names;
  }

  selectLogsTab(): void {
    this.activeTab = 'logs';
    if (this.containerNames.length > 0 && !this.logsContent) { this.loadLogs(); }
  }

  async loadLogs(): Promise<void> {
    if (!this.contextName || !this.namespace || !this.selectedContainer) return;
    const podName = this.resource?.metadata?.name;
    if (!podName) return;
    this.logsLoading = true;
    this.logsError = null;
    try {
      this.logsContent = await this.k8s.getPodLogs(this.contextName, this.namespace, podName, this.selectedContainer, 500);
    } catch (e: any) {
      this.logsError = e.message || 'Failed to fetch logs';
      this.logsContent = '';
    } finally { this.logsLoading = false; }
  }

  toggleLogsAutoRefresh(): void {
    if (this.logsAutoRefresh) { this.logsInterval = setInterval(() => this.loadLogs(), 5000); }
    else { this.clearLogsInterval(); }
  }

  private clearLogsInterval(): void {
    if (this.logsInterval) { clearInterval(this.logsInterval); this.logsInterval = null; }
  }

  private buildForm(): void {
    const r = this.resource;
    if (!r) return;
    const controls: Record<string, any> = {};
    this.formFields = [];
    this.keyValueData = {};
    this.addTextField('labels', 'Labels', controls, 'keyvalue', 'Key-value pairs for organizing resources');
    this.addTextField('annotations', 'Annotations', controls, 'keyvalue', 'Non-identifying metadata');
    const initKV = (fk: string, src: Record<string, string> | undefined) => {
      this.keyValueData[fk] = src ? Object.entries(src).map(([k, v]) => ({ key: k, value: v })) : [];
    };
    initKV('labels', r.metadata?.labels);
    initKV('annotations', r.metadata?.annotations);
    switch (this.resourceType) {
      case 'Deployment': case 'StatefulSet': case 'DaemonSet':
        controls['replicas'] = [r.spec?.replicas ?? 1];
        this.formFields.push({ key: 'replicas', label: 'Replicas', type: 'number' });
        const containers = r.spec?.template?.spec?.containers || [];
        for (let i = 0; i < containers.length; i++) {
          const c = containers[i];
          const fk = 'image_' + i;
          controls[fk] = [c.image ?? ''];
          this.formFields.push({ key: fk, label: 'Image: ' + c.name, type: 'text', description: 'Container image (set new tag to roll out)' });
        }
        break;
      case 'CronJob':
        controls['schedule'] = [r.spec?.schedule ?? ''];
        this.formFields.push({ key: 'schedule', label: 'Schedule (Cron)', type: 'text' }); break;
      case 'ConfigMap':
        this.addTextField('configData', 'Data', controls, 'keyvalue', 'Key-value configuration data');
        initKV('configData', r.data); break;
      case 'Secret':
        this.addTextField('secretData', 'Data (Base64 Decoded)', controls, 'secret-keyvalue', 'Secret key-value pairs');
        const dd: Record<string, string> = {};
        if (r.data) { for (const [k, v] of Object.entries(r.data as Record<string, string>)) { try { dd[k] = atob(v); } catch { dd[k] = v; } } }
        initKV('secretData', dd); break;
      case 'Service':
        controls['serviceType'] = [r.spec?.type ?? 'ClusterIP'];
        this.formFields.push({ key: 'serviceType', label: 'Service Type', type: 'select',
          options: [{ value: 'ClusterIP', label: 'ClusterIP' }, { value: 'NodePort', label: 'NodePort' },
            { value: 'LoadBalancer', label: 'LoadBalancer' }, { value: 'ExternalName', label: 'ExternalName' }] }); break;
    }
    this.formGroup = this.fb.group(controls);
  }

  private addTextField(key: string, label: string, controls: Record<string, any>, type: FormField['type'], description?: string): void {
    controls[key] = ['']; this.formFields.push({ key, label, type, description });
  }
  getKeyValues(fk: string): Array<{key: string, value: string}> { return this.keyValueData[fk] || []; }
  addKeyValue(fk: string): void { if (!this.keyValueData[fk]) this.keyValueData[fk] = []; this.keyValueData[fk].push({ key: '', value: '' }); }
  removeKeyValue(fk: string, i: number): void { this.keyValueData[fk].splice(i, 1); }
  updateKeyValueKey(fk: string, i: number, v: string): void { if (this.keyValueData[fk]?.[i]) this.keyValueData[fk][i].key = v; }
  updateKeyValueValue(fk: string, i: number, v: string): void { if (this.keyValueData[fk]?.[i]) this.keyValueData[fk][i].value = v; }
  onSave(): void {
    // If YAML was edited and we're on the YAML tab (or yamlEdited flag is set), send full resource
    if (this.yamlEdited) {
      try {
        const parsed = yaml.load(this.yamlContent) as any;
        if (!parsed || typeof parsed !== 'object') {
          this.yamlError = 'YAML did not parse to an object';
          return;
        }
        this.yamlError = null;
        this.save.emit({ __fullResource: true, body: parsed });
        return;
      } catch (e: any) {
        this.yamlError = 'Invalid YAML: ' + (e.message || String(e));
        return;
      }
    }
    this.save.emit(this.buildPatch());
  }
  onReset(): void { this.resource = JSON.parse(JSON.stringify(this.originalResource)); this.initializeEditor(); }

  private buildPatch(): any {
    if (!this.formGroup) return {};
    const values = this.formGroup.value;
    const patch: any = { metadata: {} };
    const toObj = (arr: Array<{key: string, value: string}>) => arr.reduce((a, { key, value }) => key ? ({ ...a, [key]: value }) : a, {});
    if (this.keyValueData['labels']) patch.metadata.labels = toObj(this.keyValueData['labels']);
    if (this.keyValueData['annotations']) patch.metadata.annotations = toObj(this.keyValueData['annotations']);
    switch (this.resourceType) {
      case 'Deployment': case 'StatefulSet': case 'DaemonSet': {
        patch.spec = { replicas: Number(values['replicas']) };
        const origContainers = this.resource?.spec?.template?.spec?.containers || [];
        const newContainers = origContainers.map((c: any, i: number) => ({
          name: c.name,
          image: values['image_' + i] ?? c.image,
        }));
        if (newContainers.length > 0) {
          patch.spec.template = { spec: { containers: newContainers } };
        }
        break;
      }
      case 'CronJob': patch.spec = { schedule: values['schedule'] }; break;
      case 'ConfigMap': patch.data = toObj(this.keyValueData['configData'] || []); break;
      case 'Secret': patch.data = {}; for (const { key, value } of (this.keyValueData['secretData'] || [])) { if (key) patch.data[key] = btoa(value); } break;
      case 'Service': patch.spec = { type: values['serviceType'] }; break;
    }
    return patch;
  }

  private buildPodDescribe(pod: any): string {
    const lines: string[] = [];
    const add = (l: string, v: any) => { if (v !== undefined && v !== null) lines.push(l + ':' + ' '.repeat(Math.max(1, 24 - l.length)) + v); };
    const addMap = (l: string, m: Record<string, string> | undefined) => {
      if (!m || Object.keys(m).length === 0) { lines.push(l + ':' + ' '.repeat(Math.max(1, 24 - l.length)) + '<none>'); return; }
      lines.push(l + ':'); for (const [k, v] of Object.entries(m)) lines.push('  ' + k + '=' + v);
    };
    const meta = pod.metadata || {}, spec = pod.spec || {}, status = pod.status || {};
    add('Name', meta.name); add('Namespace', meta.namespace);
    add('Priority', spec.priority); add('PriorityClassName', spec.priorityClassName);
    add('Service Account', spec.serviceAccountName);
    add('Node', spec.nodeName ? spec.nodeName + '/' + (status.hostIP || '') : '<none>');
    add('Start Time', status.startTime);
    addMap('Labels', meta.labels); addMap('Annotations', meta.annotations);
    add('Status', status.phase); add('IP', status.podIP);
    if (status.podIPs?.length) { lines.push('IPs:'); for (const ip of status.podIPs) lines.push('  IP:  ' + ip.ip); }
    if (spec.initContainers?.length) { lines.push('Init Containers:'); for (const c of spec.initContainers) this.describeContainer(lines, c, status.initContainerStatuses); }
    lines.push('Containers:'); for (const c of (spec.containers || [])) this.describeContainer(lines, c, status.containerStatuses);
    if (status.conditions?.length) {
      lines.push('Conditions:'); lines.push('  ' + 'Type'.padEnd(24) + 'Status'.padEnd(10)); lines.push('  ' + '----'.padEnd(24) + '------'.padEnd(10));
      for (const cond of status.conditions) lines.push('  ' + (cond.type || '').padEnd(24) + (cond.status || '').padEnd(10));
    }
    if (spec.volumes?.length) {
      lines.push('Volumes:');
      for (const vol of spec.volumes) {
        lines.push('  ' + vol.name + ':');
        if (vol.configMap) lines.push('    Type:      ConfigMap', '    Name:      ' + vol.configMap.name);
        else if (vol.secret) lines.push('    Type:      Secret', '    SecretName: ' + vol.secret.secretName);
        else if (vol.emptyDir) lines.push('    Type:      EmptyDir');
        else if (vol.persistentVolumeClaim) lines.push('    Type:      PersistentVolumeClaim', '    ClaimName:  ' + vol.persistentVolumeClaim.claimName);
        else if (vol.hostPath) lines.push('    Type:      HostPath', '    Path:      ' + vol.hostPath.path);
        else if (vol.projected) lines.push('    Type:      Projected');
        else lines.push('    Type:      ' + (Object.keys(vol).filter(k => k !== 'name').join(', ') || 'Unknown'));
      }
    }
    add('QoS Class', status.qosClass); addMap('Node-Selectors', spec.nodeSelector);
    if (spec.tolerations?.length) {
      lines.push('Tolerations:');
      for (const t of spec.tolerations) { lines.push('  ' + (t.key || '') + (t.operator === 'Exists' ? 'Exists' : '=' + (t.value || '')) + (t.effect ? ':' + t.effect : '') + (t.tolerationSeconds != null ? ' for ' + t.tolerationSeconds + 's' : '')); }
    }
    return lines.join('\n');
  }

  private describeContainer(lines: string[], container: any, statuses?: any[]): void {
    const cs = statuses?.find((s: any) => s.name === container.name) || {};
    lines.push('  ' + container.name + ':');
    lines.push('    Image:          ' + container.image);
    if (container.command) lines.push('    Command:        ' + container.command.join(' '));
    if (container.args) lines.push('    Args:           ' + container.args.join(' '));
    if (cs.state) { const sk = Object.keys(cs.state)[0]; const sv = cs.state[sk] || {}; lines.push('    State:          ' + sk); if (sv.startedAt) lines.push('      Started:      ' + sv.startedAt); if (sv.reason) lines.push('      Reason:       ' + sv.reason); if (sv.message) lines.push('      Message:      ' + sv.message); }
    if (cs.lastState && Object.keys(cs.lastState).length) { const sk = Object.keys(cs.lastState)[0]; const sv = cs.lastState[sk] || {}; lines.push('    Last State:     ' + sk); if (sv.reason) lines.push('      Reason:       ' + sv.reason); if (sv.exitCode !== undefined) lines.push('      Exit Code:    ' + sv.exitCode); if (sv.finishedAt) lines.push('      Finished:     ' + sv.finishedAt); }
    lines.push('    Ready:          ' + (cs.ready ?? false));
    lines.push('    Restart Count:  ' + (cs.restartCount ?? 0));
    if (container.env?.length) { lines.push('    Environment:'); for (const e of container.env) { if (e.value !== undefined) lines.push('      ' + e.name + ':  ' + e.value); else if (e.valueFrom?.secretKeyRef) lines.push('      ' + e.name + ':  <set from secret ' + e.valueFrom.secretKeyRef.name + '>'); else if (e.valueFrom?.configMapKeyRef) lines.push('      ' + e.name + ':  <set from configmap ' + e.valueFrom.configMapKeyRef.name + '>'); else if (e.valueFrom?.fieldRef) lines.push('      ' + e.name + ':  (' + e.valueFrom.fieldRef.fieldPath + ')'); else lines.push('      ' + e.name + ':  <set>'); } }
    if (container.ports?.length) { lines.push('    Ports:          ' + container.ports.map((p: any) => p.containerPort + '/' + (p.protocol || 'TCP')).join(', ')); }
    const res = container.resources || {};
    if (res.limits) lines.push('    Limits:         ' + Object.entries(res.limits).map(([k, v]) => k + ': ' + v).join(', '));
    if (res.requests) lines.push('    Requests:       ' + Object.entries(res.requests).map(([k, v]) => k + ': ' + v).join(', '));
    if (container.volumeMounts?.length) { lines.push('    Mounts:'); for (const m of container.volumeMounts) lines.push('      ' + m.mountPath + ' from ' + m.name + (m.readOnly ? ' (ro)' : '')); }
  }
}

interface FormField {
  key: string; label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'keyvalue' | 'secret-keyvalue';
  description?: string;
  options?: Array<{ value: string; label: string }>;
}
