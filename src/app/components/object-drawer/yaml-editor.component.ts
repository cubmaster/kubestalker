import { Component, Input, Output, EventEmitter, OnInit, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
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
        <pre class="bg-dark text-light p-3 rounded" style="max-height: 600px; overflow-y: auto; font-size: 12px;">{{ yamlContent }}</pre>
      </div>

      <div *ngIf="activeTab === 'describe' && resourceType === 'Pod'" class="describe-view">
        <pre class="describe-output p-3 rounded" style="overflow-y: auto; font-size: 12px; white-space: pre-wrap; word-break: break-all;">{{ describeContent }}</pre>
      </div>

      <div *ngIf="activeTab === 'form'" class="form-view">
        <div *ngIf="formFields.length === 0" class="text-muted text-center p-4">
          No editable fields available
        </div>
        <form *ngIf="formGroup && formFields.length > 0" [formGroup]="formGroup">
          <div *ngFor="let field of formFields" class="mb-3">
            <label class="form-label fw-semibold">{{ field.label }}</label>
            <small *ngIf="field.description" class="form-text text-muted d-block mb-1">{{ field.description }}</small>

            <textarea *ngIf="field.type === 'textarea'"
              class="form-control font-monospace"
              [formControlName]="field.key"
              [attr.disabled]="readOnly ? true : null"
              rows="4"></textarea>

            <select *ngIf="field.type === 'select'"
              class="form-select"
              [formControlName]="field.key"
              [attr.disabled]="readOnly ? true : null">
              <option *ngFor="let opt of field.options" [value]="opt.value">{{ opt.label }}</option>
            </select>

            <div *ngIf="field.type === 'keyvalue'" class="keyvalue-editor">
              <div *ngFor="let kv of getKeyValues(field.key); let i = index" class="input-group mb-1">
                <input type="text" class="form-control form-control-sm" [value]="kv.key"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueKey(field.key, i, $any($event.target).value)"
                  placeholder="Key">
                <input type="text" class="form-control form-control-sm" [value]="kv.value"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueValue(field.key, i, $any($event.target).value)"
                  placeholder="Value">
                <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-danger"
                  (click)="removeKeyValue(field.key, i)">
                  <i class="bi bi-x"></i>
                </button>
              </div>
              <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-secondary"
                (click)="addKeyValue(field.key)">
                <i class="bi bi-plus me-1"></i>Add
              </button>
            </div>

            <div *ngIf="field.type === 'secret-keyvalue'" class="keyvalue-editor">
              <div *ngFor="let kv of getKeyValues(field.key); let i = index" class="input-group mb-1">
                <input type="text" class="form-control form-control-sm" [value]="kv.key"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueKey(field.key, i, $any($event.target).value)"
                  placeholder="Key">
                <textarea class="form-control form-control-sm font-monospace" [value]="kv.value" rows="1"
                  [attr.disabled]="readOnly ? true : null"
                  (change)="updateKeyValueValue(field.key, i, $any($event.target).value)"
                  placeholder="Value (decoded)"></textarea>
                <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-danger"
                  (click)="removeKeyValue(field.key, i)">
                  <i class="bi bi-x"></i>
                </button>
              </div>
              <button *ngIf="!readOnly" type="button" class="btn btn-sm btn-outline-secondary"
                (click)="addKeyValue(field.key)">
                <i class="bi bi-plus me-1"></i>Add
              </button>
            </div>

            <input *ngIf="field.type === 'text' || field.type === 'number'"
              [type]="field.type"
              class="form-control"
              [formControlName]="field.key"
              [attr.disabled]="readOnly ? true : null">
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .yaml-editor { font-size: 14px; }
    .nav-tabs .nav-link { padding: 0.25rem 0.75rem; font-size: 0.875rem; }
    .keyvalue-editor .input-group { flex-wrap: nowrap; }
    .keyvalue-editor .form-control {
      background: #181825;
      border-color: #45475a;
      color: #cdd6f4;
    }
    .keyvalue-editor .form-control:focus {
      background: #181825;
      border-color: #89b4fa;
      color: #cdd6f4;
      box-shadow: 0 0 0 0.2rem rgba(137,180,250,0.15);
    }
    .keyvalue-editor .form-control[disabled] {
      background: #11111b;
      color: #a6adc8;
      opacity: 0.8;
    }
    .describe-output {
      background: #11111b;
      color: #a6e3a1;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      border: 1px solid #313244;
    }
  `]
})
export class YamlEditorComponent implements OnInit, OnChanges {
  @Input() resource: any;
  @Input() resourceType: string = '';
  @Input() readOnly: boolean = false;
  @Output() save = new EventEmitter<any>();

  activeTab: 'form' | 'yaml' | 'describe' = 'form';
  yamlContent: string = '';
  describeContent: string = '';
  formGroup: FormGroup | null = null;
  formFields: FormField[] = [];
  private keyValueData: Record<string, Array<{key: string, value: string}>> = {};
  private originalResource: any;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initializeEditor();
  }

  ngOnChanges(): void {
    this.initializeEditor();
  }

  private initializeEditor(): void {
    if (!this.resource) return;
    this.originalResource = JSON.parse(JSON.stringify(this.resource));
    this.yamlContent = yaml.dump(this.resource, { lineWidth: -1 });
    if (this.resourceType === 'Pod') {
      this.describeContent = this.buildPodDescribe(this.resource);
    }
    this.buildForm();
  }

  private buildForm(): void {
    const r = this.resource;
    if (!r) return;

    const controls: Record<string, any> = {};
    this.formFields = [];
    this.keyValueData = {};

    // Common metadata fields
    this.addTextField('labels', 'Labels', controls, 'keyvalue',
      'Key-value pairs for organizing resources');
    this.addTextField('annotations', 'Annotations', controls, 'keyvalue',
      'Non-identifying metadata');

    const initKeyValue = (fieldKey: string, source: Record<string, string> | undefined) => {
      this.keyValueData[fieldKey] = source
        ? Object.entries(source).map(([k, v]) => ({ key: k, value: v }))
        : [];
    };
    initKeyValue('labels', r.metadata?.labels);
    initKeyValue('annotations', r.metadata?.annotations);

    // Resource-specific fields
    switch (this.resourceType) {
      case 'Deployment':
      case 'StatefulSet':
      case 'DaemonSet':
        controls['replicas'] = [r.spec?.replicas ?? 1];
        this.formFields.push({ key: 'replicas', label: 'Replicas', type: 'number' });
        break;

      case 'CronJob':
        controls['schedule'] = [r.spec?.schedule ?? ''];
        controls['suspend'] = [r.spec?.suspend ?? false];
        this.formFields.push({ key: 'schedule', label: 'Schedule (Cron)', type: 'text' });
        break;

      case 'ConfigMap':
        this.addTextField('configData', 'Data', controls, 'keyvalue', 'Key-value configuration data');
        initKeyValue('configData', r.data);
        break;

      case 'Secret':
        this.addTextField('secretData', 'Data (Base64 Decoded)', controls, 'secret-keyvalue',
          'Secret key-value pairs — values shown decoded');
        const decodedData: Record<string, string> = {};
        if (r.data) {
          for (const [k, v] of Object.entries(r.data as Record<string, string>)) {
            try { decodedData[k] = atob(v); } catch { decodedData[k] = v; }
          }
        }
        initKeyValue('secretData', decodedData);
        break;

      case 'Service':
        controls['serviceType'] = [r.spec?.type ?? 'ClusterIP'];
        this.formFields.push({
          key: 'serviceType', label: 'Service Type', type: 'select',
          options: [
            { value: 'ClusterIP', label: 'ClusterIP' },
            { value: 'NodePort', label: 'NodePort' },
            { value: 'LoadBalancer', label: 'LoadBalancer' },
            { value: 'ExternalName', label: 'ExternalName' }
          ]
        });
        break;
    }

    this.formGroup = this.fb.group(controls);
  }

  private addTextField(key: string, label: string, controls: Record<string, any>,
    type: FormField['type'], description?: string): void {
    controls[key] = [''];
    this.formFields.push({ key, label, type, description });
  }

  getKeyValues(fieldKey: string): Array<{key: string, value: string}> {
    return this.keyValueData[fieldKey] || [];
  }

  addKeyValue(fieldKey: string): void {
    if (!this.keyValueData[fieldKey]) this.keyValueData[fieldKey] = [];
    this.keyValueData[fieldKey].push({ key: '', value: '' });
  }

  removeKeyValue(fieldKey: string, index: number): void {
    this.keyValueData[fieldKey].splice(index, 1);
  }

  updateKeyValueKey(fieldKey: string, index: number, newKey: string): void {
    if (this.keyValueData[fieldKey]?.[index]) {
      this.keyValueData[fieldKey][index].key = newKey;
    }
  }

  updateKeyValueValue(fieldKey: string, index: number, newValue: string): void {
    if (this.keyValueData[fieldKey]?.[index]) {
      this.keyValueData[fieldKey][index].value = newValue;
    }
  }

  onSave(): void {
    const patch = this.buildPatch();
    this.save.emit(patch);
  }

  onReset(): void {
    this.resource = JSON.parse(JSON.stringify(this.originalResource));
    this.initializeEditor();
  }

  private buildPatch(): any {
    if (!this.formGroup) return {};
    const values = this.formGroup.value;
    const patch: any = { metadata: {} };

    const toObject = (arr: Array<{key: string, value: string}>) =>
      arr.reduce((acc, { key, value }) => key ? ({ ...acc, [key]: value }) : acc, {});

    if (this.keyValueData['labels']) {
      patch.metadata.labels = toObject(this.keyValueData['labels']);
    }
    if (this.keyValueData['annotations']) {
      patch.metadata.annotations = toObject(this.keyValueData['annotations']);
    }

    switch (this.resourceType) {
      case 'Deployment':
      case 'StatefulSet':
      case 'DaemonSet':
        patch.spec = { replicas: Number(values['replicas']) };
        break;
      case 'CronJob':
        patch.spec = { schedule: values['schedule'] };
        break;
      case 'ConfigMap':
        patch.data = toObject(this.keyValueData['configData'] || []);
        break;
      case 'Secret':
        patch.data = {};
        for (const { key, value } of (this.keyValueData['secretData'] || [])) {
          if (key) patch.data[key] = btoa(value);
        }
        break;
      case 'Service':
        patch.spec = { type: values['serviceType'] };
        break;
    }

    return patch;
  }

  private buildPodDescribe(pod: any): string {
    const lines: string[] = [];
    const add = (label: string, value: any) => { if (value !== undefined && value !== null) lines.push(`${label}:${' '.repeat(Math.max(1, 24 - label.length))}${value}`); };
    const addMap = (label: string, map: Record<string, string> | undefined) => {
      if (!map || Object.keys(map).length === 0) { lines.push(`${label}:${' '.repeat(Math.max(1, 24 - label.length))}<none>`); return; }
      lines.push(`${label}:`);
      for (const [k, v] of Object.entries(map)) lines.push(`  ${k}=${v}`);
    };
    const meta = pod.metadata || {};
    const spec = pod.spec || {};
    const status = pod.status || {};

    add('Name', meta.name);
    add('Namespace', meta.namespace);
    add('Priority', spec.priority);
    add('PriorityClassName', spec.priorityClassName);
    add('Service Account', spec.serviceAccountName);
    add('Node', spec.nodeName ? `${spec.nodeName}/${status.hostIP || ''}` : '<none>');
    add('Start Time', status.startTime);
    addMap('Labels', meta.labels);
    addMap('Annotations', meta.annotations);
    add('Status', status.phase);
    add('IP', status.podIP);

    if (status.podIPs?.length) {
      lines.push('IPs:');
      for (const ip of status.podIPs) lines.push(`  IP:  ${ip.ip}`);
    }

    if (spec.initContainers?.length) {
      lines.push('Init Containers:');
      for (const c of spec.initContainers) {
        this.describeContainer(lines, c, status.initContainerStatuses);
      }
    }

    lines.push('Containers:');
    for (const c of (spec.containers || [])) {
      this.describeContainer(lines, c, status.containerStatuses);
    }

    if (status.conditions?.length) {
      lines.push('Conditions:');
      lines.push(`  ${'Type'.padEnd(24)}${'Status'.padEnd(10)}`);
      lines.push(`  ${'----'.padEnd(24)}${'------'.padEnd(10)}`);
      for (const cond of status.conditions) {
        lines.push(`  ${(cond.type || '').padEnd(24)}${(cond.status || '').padEnd(10)}`);
      }
    }

    if (spec.volumes?.length) {
      lines.push('Volumes:');
      for (const vol of spec.volumes) {
        lines.push(`  ${vol.name}:`);
        if (vol.configMap) lines.push(`    Type:      ConfigMap (a volume populated by a ConfigMap)`, `    Name:      ${vol.configMap.name}`);
        else if (vol.secret) lines.push(`    Type:      Secret (a volume populated by a Secret)`, `    SecretName: ${vol.secret.secretName}`);
        else if (vol.emptyDir) lines.push(`    Type:      EmptyDir`);
        else if (vol.persistentVolumeClaim) lines.push(`    Type:      PersistentVolumeClaim`, `    ClaimName:  ${vol.persistentVolumeClaim.claimName}`);
        else if (vol.hostPath) lines.push(`    Type:      HostPath`, `    Path:      ${vol.hostPath.path}`);
        else if (vol.projected) lines.push(`    Type:      Projected`);
        else lines.push(`    Type:      ${Object.keys(vol).filter(k => k !== 'name').join(', ') || 'Unknown'}`);
      }
    }

    add('QoS Class', status.qosClass);
    addMap('Node-Selectors', spec.nodeSelector);

    if (spec.tolerations?.length) {
      lines.push('Tolerations:');
      for (const t of spec.tolerations) {
        const parts = [t.key || '', t.operator === 'Exists' ? 'Exists' : `=${t.value || ''}`, t.effect ? `:${t.effect}` : ''];
        lines.push(`  ${parts.join('')}${t.tolerationSeconds != null ? ` for ${t.tolerationSeconds}s` : ''}`);
      }
    }

    if (status.conditions?.length) {
      lines.push('Events:');
      lines.push('  (events not available via API — use kubectl describe for full events)');
    }

    return lines.join('\n');
  }

  private describeContainer(lines: string[], container: any, statuses?: any[]): void {
    const cs = statuses?.find((s: any) => s.name === container.name) || {};
    lines.push(`  ${container.name}:`);
    lines.push(`    Image:          ${container.image}`);
    if (container.command) lines.push(`    Command:        ${container.command.join(' ')}`);
    if (container.args) lines.push(`    Args:           ${container.args.join(' ')}`);

    if (cs.state) {
      const stateKey = Object.keys(cs.state)[0];
      const stateVal = cs.state[stateKey] || {};
      lines.push(`    State:          ${stateKey}`);
      if (stateVal.startedAt) lines.push(`      Started:      ${stateVal.startedAt}`);
      if (stateVal.reason) lines.push(`      Reason:       ${stateVal.reason}`);
      if (stateVal.message) lines.push(`      Message:      ${stateVal.message}`);
    }
    if (cs.lastState && Object.keys(cs.lastState).length) {
      const stateKey = Object.keys(cs.lastState)[0];
      const stateVal = cs.lastState[stateKey] || {};
      lines.push(`    Last State:     ${stateKey}`);
      if (stateVal.reason) lines.push(`      Reason:       ${stateVal.reason}`);
      if (stateVal.exitCode !== undefined) lines.push(`      Exit Code:    ${stateVal.exitCode}`);
      if (stateVal.finishedAt) lines.push(`      Finished:     ${stateVal.finishedAt}`);
    }

    lines.push(`    Ready:          ${cs.ready ?? false}`);
    lines.push(`    Restart Count:  ${cs.restartCount ?? 0}`);

    if (container.env?.length) {
      lines.push(`    Environment:`);
      for (const e of container.env) {
        if (e.value !== undefined) lines.push(`      ${e.name}:  ${e.value}`);
        else if (e.valueFrom?.secretKeyRef) lines.push(`      ${e.name}:  <set from secret ${e.valueFrom.secretKeyRef.name}>`);
        else if (e.valueFrom?.configMapKeyRef) lines.push(`      ${e.name}:  <set from configmap ${e.valueFrom.configMapKeyRef.name}>`);
        else if (e.valueFrom?.fieldRef) lines.push(`      ${e.name}:  (${e.valueFrom.fieldRef.fieldPath})`);
        else lines.push(`      ${e.name}:  <set>`);
      }
    }

    if (container.ports?.length) {
      lines.push(`    Ports:          ${container.ports.map((p: any) => `${p.containerPort}/${p.protocol || 'TCP'}`).join(', ')}`);
    }

    const res = container.resources || {};
    if (res.limits) lines.push(`    Limits:         ${Object.entries(res.limits).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    if (res.requests) lines.push(`    Requests:       ${Object.entries(res.requests).map(([k, v]) => `${k}: ${v}`).join(', ')}`);

    if (container.volumeMounts?.length) {
      lines.push(`    Mounts:`);
      for (const m of container.volumeMounts) {
        lines.push(`      ${m.mountPath} from ${m.name}${m.readOnly ? ' (ro)' : ''}`);
      }
    }
  }
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'textarea' | 'select' | 'keyvalue' | 'secret-keyvalue';
  description?: string;
  options?: Array<{ value: string; label: string }>;
}
