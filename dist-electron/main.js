"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const k8s = __importStar(require("@kubernetes/client-node"));
const middleware_js_1 = require("@kubernetes/client-node/dist/gen/middleware.js");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
let mainWindow = null;
let db = null;
// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1400, height: 900, minWidth: 900, minHeight: 600,
        webPreferences: {
            nodeIntegration: false, contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        backgroundColor: '#1e1e2e',
        show: false,
        title: 'KubeStalker',
    });
    const isDev = process.env['NODE_ENV'] === 'development' || !electron_1.app.isPackaged;
    if (isDev) {
        mainWindow.loadURL('http://localhost:4200');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/kubestalker/browser/index.html'));
    }
    mainWindow.once('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}
// ── Database ──────────────────────────────────────────────────────────────────
function initDatabase() {
    const dbDir = path.join(electron_1.app.getPath('userData'), 'kubestalker');
    if (!fs.existsSync(dbDir))
        fs.mkdirSync(dbDir, { recursive: true });
    db = new better_sqlite3_1.default(path.join(dbDir, 'state.db'));
    db.exec(`CREATE TABLE IF NOT EXISTS kv_store (
    key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL
  )`);
}
// ── K8s helpers ───────────────────────────────────────────────────────────────
const kubeConfigCache = new Map();
function getKubeConfig(contextName) {
    if (kubeConfigCache.has(contextName))
        return kubeConfigCache.get(contextName);
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    kc.setCurrentContext(contextName);
    kubeConfigCache.set(contextName, kc);
    return kc;
}
function makeCore(ctx) { return getKubeConfig(ctx).makeApiClient(k8s.CoreV1Api); }
function makeApps(ctx) { return getKubeConfig(ctx).makeApiClient(k8s.AppsV1Api); }
function makeBatch(ctx) { return getKubeConfig(ctx).makeApiClient(k8s.BatchV1Api); }
function makeNet(ctx) { return getKubeConfig(ctx).makeApiClient(k8s.NetworkingV1Api); }
function makeStorage(ctx) { return getKubeConfig(ctx).makeApiClient(k8s.StorageV1Api); }
const ok = (data) => ({ success: true, data });
const fail = (e) => ({ success: false, error: e?.body?.message || e?.message || String(e) });
// PromiseMiddleware that sets Content-Type to application/merge-patch+json
const mergePatchOptions = {
    middleware: [new middleware_js_1.PromiseMiddlewareWrapper({
            pre: async (ctx) => { ctx.setHeaderParam('Content-Type', 'application/merge-patch+json'); return ctx; },
            post: async (ctx) => ctx,
        })],
};
async function getAllNs(namespaces, allFn, nsFn) {
    if (namespaces.length === 0)
        return allFn();
    const results = await Promise.allSettled(namespaces.map(ns => nsFn(ns)));
    return results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
}
function hasConditionError(conditions) {
    if (!conditions)
        return false;
    return conditions.some(c => (c.type === 'Available' && c.status === 'False') ||
        (c.type === 'Progressing' && c.reason === 'ProgressDeadlineExceeded'));
}
// ── IPC: Database ─────────────────────────────────────────────────────────────
function registerDbHandlers() {
    electron_1.ipcMain.handle('db:get', (_e, key) => {
        try {
            const r = db.prepare('SELECT value FROM kv_store WHERE key=?').get(key);
            return ok(r ? JSON.parse(r.value) : null);
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('db:set', (_e, key, value) => {
        try {
            db.prepare('INSERT OR REPLACE INTO kv_store(key,value,updated_at)VALUES(?,?,?)').run(key, JSON.stringify(value), Date.now());
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('db:delete', (_e, key) => {
        try {
            db.prepare('DELETE FROM kv_store WHERE key=?').run(key);
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('db:getAll', (_e) => {
        try {
            const rows = db.prepare('SELECT key,value FROM kv_store').all();
            return ok(Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)])));
        }
        catch (e) {
            return fail(e);
        }
    });
}
// ── IPC: Kubernetes ────────────────────────────────────────────────────────────
function registerK8sHandlers() {
    electron_1.ipcMain.handle('k8s:getClusters', () => {
        try {
            const kc = new k8s.KubeConfig();
            kc.loadFromDefault();
            return ok(kc.getContexts().map(ctx => {
                const cluster = kc.getClusters().find(c => c.name === ctx.cluster);
                return { name: ctx.name, contextName: ctx.name, server: cluster?.server || 'Unknown', kubeconfigFile: 'default' };
            }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getNamespaces', async (_e, ctx) => {
        try {
            const res = await makeCore(ctx).listNamespace();
            return ok(res.items.map((ns) => ({
                name: ns.metadata.name, status: ns.status?.phase || 'Unknown', hasError: ns.status?.phase !== 'Active'
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    // Pods
    electron_1.ipcMain.handle('k8s:getPods', async (_e, ctx, namespaces) => {
        try {
            const api = makeCore(ctx);
            const pods = await getAllNs(namespaces, async () => (await api.listPodForAllNamespaces()).items, async (ns) => (await api.listNamespacedPod({ namespace: ns })).items);
            return ok(pods.map((pod) => {
                const containers = pod.status?.containerStatuses || [];
                const ready = containers.filter((c) => c.ready).length;
                const restarts = containers.reduce((s, c) => s + (c.restartCount || 0), 0);
                const hasErr = pod.status?.phase === 'Failed' ||
                    containers.some((c) => c.state?.waiting?.reason && !['ContainerCreating', 'PodInitializing'].includes(c.state.waiting.reason));
                return {
                    name: pod.metadata.name, namespace: pod.metadata.namespace,
                    uid: pod.metadata.uid, creationTimestamp: pod.metadata.creationTimestamp,
                    labels: pod.metadata.labels, phase: pod.status?.phase || 'Unknown',
                    ready: `${ready}/${containers.length}`, restarts, ip: pod.status?.podIP,
                    nodeName: pod.spec?.nodeName, hasError: hasErr, raw: pod,
                };
            }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getPod', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeCore(ctx).readNamespacedPod({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deletePod', async (_e, ctx, ns, name) => {
        try {
            await makeCore(ctx).deleteNamespacedPod({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // Deployments
    electron_1.ipcMain.handle('k8s:getDeployments', async (_e, ctx, namespaces) => {
        try {
            const api = makeApps(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listDeploymentForAllNamespaces()).items, async (ns) => (await api.listNamespacedDeployment({ namespace: ns })).items);
            return ok(items.map((d) => ({
                name: d.metadata.name, namespace: d.metadata.namespace,
                uid: d.metadata.uid, creationTimestamp: d.metadata.creationTimestamp,
                replicas: d.spec?.replicas ?? 0, readyReplicas: d.status?.readyReplicas ?? 0,
                updatedReplicas: d.status?.updatedReplicas ?? 0, availableReplicas: d.status?.availableReplicas ?? 0,
                strategy: d.spec?.strategy?.type, hasError: hasConditionError(d.status?.conditions), raw: d,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getDeployment', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeApps(ctx).readNamespacedDeployment({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:createDeployment', async (_e, ctx, ns, body) => {
        try {
            return ok(await makeApps(ctx).createNamespacedDeployment({ namespace: ns, body }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:updateDeployment', async (_e, ctx, ns, name, body) => {
        try {
            return ok(await makeApps(ctx).replaceNamespacedDeployment({ name, namespace: ns, body }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchDeployment', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeApps(ctx).patchNamespacedDeployment({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteDeployment', async (_e, ctx, ns, name) => {
        try {
            await makeApps(ctx).deleteNamespacedDeployment({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // StatefulSets
    electron_1.ipcMain.handle('k8s:getStatefulSets', async (_e, ctx, namespaces) => {
        try {
            const api = makeApps(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listStatefulSetForAllNamespaces()).items, async (ns) => (await api.listNamespacedStatefulSet({ namespace: ns })).items);
            return ok(items.map((s) => ({
                name: s.metadata.name, namespace: s.metadata.namespace,
                uid: s.metadata.uid, creationTimestamp: s.metadata.creationTimestamp,
                replicas: s.spec?.replicas ?? 0, readyReplicas: s.status?.readyReplicas ?? 0,
                serviceName: s.spec?.serviceName, hasError: false, raw: s,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getStatefulSet', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeApps(ctx).readNamespacedStatefulSet({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchStatefulSet', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeApps(ctx).patchNamespacedStatefulSet({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteStatefulSet', async (_e, ctx, ns, name) => {
        try {
            await makeApps(ctx).deleteNamespacedStatefulSet({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // DaemonSets
    electron_1.ipcMain.handle('k8s:getDaemonSets', async (_e, ctx, namespaces) => {
        try {
            const api = makeApps(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listDaemonSetForAllNamespaces()).items, async (ns) => (await api.listNamespacedDaemonSet({ namespace: ns })).items);
            return ok(items.map((d) => ({
                name: d.metadata.name, namespace: d.metadata.namespace,
                uid: d.metadata.uid, creationTimestamp: d.metadata.creationTimestamp,
                desiredNumberScheduled: d.status?.desiredNumberScheduled,
                currentNumberScheduled: d.status?.currentNumberScheduled,
                numberReady: d.status?.numberReady, numberMisscheduled: d.status?.numberMisscheduled,
                hasError: (d.status?.numberMisscheduled ?? 0) > 0 || (d.status?.numberReady ?? 0) < (d.status?.desiredNumberScheduled ?? 0),
                raw: d,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getDaemonSet', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeApps(ctx).readNamespacedDaemonSet({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchDaemonSet', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeApps(ctx).patchNamespacedDaemonSet({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteDaemonSet', async (_e, ctx, ns, name) => {
        try {
            await makeApps(ctx).deleteNamespacedDaemonSet({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // Jobs
    electron_1.ipcMain.handle('k8s:getJobs', async (_e, ctx, namespaces) => {
        try {
            const api = makeBatch(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listJobForAllNamespaces()).items, async (ns) => (await api.listNamespacedJob({ namespace: ns })).items);
            return ok(items.map((j) => {
                const start = j.status?.startTime, end = j.status?.completionTime;
                const duration = start && end ? `${Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000)}s` : j.status?.active ? 'Running' : '-';
                return {
                    name: j.metadata.name, namespace: j.metadata.namespace,
                    uid: j.metadata.uid, creationTimestamp: j.metadata.creationTimestamp,
                    completions: j.spec?.completions, succeeded: j.status?.succeeded,
                    failed: j.status?.failed, active: j.status?.active, duration,
                    hasError: (j.status?.failed ?? 0) > 0, raw: j,
                };
            }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getJob', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeBatch(ctx).readNamespacedJob({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteJob', async (_e, ctx, ns, name) => {
        try {
            await makeBatch(ctx).deleteNamespacedJob({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // CronJobs
    electron_1.ipcMain.handle('k8s:getCronJobs', async (_e, ctx, namespaces) => {
        try {
            const api = makeBatch(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listCronJobForAllNamespaces()).items, async (ns) => (await api.listNamespacedCronJob({ namespace: ns })).items);
            return ok(items.map((c) => ({
                name: c.metadata.name, namespace: c.metadata.namespace,
                uid: c.metadata.uid, creationTimestamp: c.metadata.creationTimestamp,
                schedule: c.spec?.schedule, suspend: c.spec?.suspend,
                lastScheduleTime: c.status?.lastScheduleTime, activeJobs: c.status?.active?.length ?? 0,
                hasError: false, raw: c,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getCronJob', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeBatch(ctx).readNamespacedCronJob({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchCronJob', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeBatch(ctx).patchNamespacedCronJob({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteCronJob', async (_e, ctx, ns, name) => {
        try {
            await makeBatch(ctx).deleteNamespacedCronJob({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // Services
    electron_1.ipcMain.handle('k8s:getServices', async (_e, ctx, namespaces) => {
        try {
            const api = makeCore(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listServiceForAllNamespaces()).items, async (ns) => (await api.listNamespacedService({ namespace: ns })).items);
            return ok(items.map((s) => ({
                name: s.metadata.name, namespace: s.metadata.namespace,
                uid: s.metadata.uid, creationTimestamp: s.metadata.creationTimestamp,
                type: s.spec?.type, clusterIP: s.spec?.clusterIP,
                externalIP: s.status?.loadBalancer?.ingress?.[0]?.ip || s.spec?.externalIPs?.[0],
                ports: s.spec?.ports?.map((p) => ({ name: p.name, port: p.port, targetPort: p.targetPort, protocol: p.protocol, nodePort: p.nodePort })),
                selector: s.spec?.selector, hasError: false, raw: s,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getService', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeCore(ctx).readNamespacedService({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchService', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeCore(ctx).patchNamespacedService({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteService', async (_e, ctx, ns, name) => {
        try {
            await makeCore(ctx).deleteNamespacedService({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // Endpoints
    electron_1.ipcMain.handle('k8s:getEndpoints', async (_e, ctx, namespaces) => {
        try {
            const api = makeCore(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listEndpointsForAllNamespaces()).items, async (ns) => (await api.listNamespacedEndpoints({ namespace: ns })).items);
            return ok(items.map((e) => ({
                name: e.metadata.name, namespace: e.metadata.namespace,
                uid: e.metadata.uid, creationTimestamp: e.metadata.creationTimestamp,
                subsets: e.subsets?.map((s) => ({ addresses: s.addresses?.map((a) => ({ ip: a.ip, nodeName: a.nodeName })), ports: s.ports?.map((p) => ({ port: p.port, protocol: p.protocol })) })),
                addresses: e.subsets?.flatMap((s) => s.addresses?.map((a) => a.ip) || []),
                hasError: false, raw: e,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    // Ingresses
    electron_1.ipcMain.handle('k8s:getIngresses', async (_e, ctx, namespaces) => {
        try {
            const api = makeNet(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listIngressForAllNamespaces()).items, async (ns) => (await api.listNamespacedIngress({ namespace: ns })).items);
            return ok(items.map((i) => ({
                name: i.metadata.name, namespace: i.metadata.namespace,
                uid: i.metadata.uid, creationTimestamp: i.metadata.creationTimestamp,
                ingressClass: i.spec?.ingressClassName || i.metadata?.annotations?.['kubernetes.io/ingress.class'],
                rules: i.spec?.rules?.map((r) => ({ host: r.host, paths: r.http?.paths?.map((p) => ({ path: p.path, pathType: p.pathType, backend: `${p.backend?.service?.name}:${p.backend?.service?.port?.number}` })) })),
                loadBalancerIP: i.status?.loadBalancer?.ingress?.[0]?.ip,
                hasError: false, raw: i,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getIngress', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeNet(ctx).readNamespacedIngress({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchIngress', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeNet(ctx).patchNamespacedIngress({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteIngress', async (_e, ctx, ns, name) => {
        try {
            await makeNet(ctx).deleteNamespacedIngress({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // PVs
    electron_1.ipcMain.handle('k8s:getPersistentVolumes', async (_e, ctx) => {
        try {
            const res = await makeCore(ctx).listPersistentVolume();
            return ok(res.items.map((pv) => ({
                name: pv.metadata.name, uid: pv.metadata.uid, creationTimestamp: pv.metadata.creationTimestamp,
                capacity: pv.spec?.capacity?.storage, accessModes: pv.spec?.accessModes,
                storageClass: pv.spec?.storageClassName, status: pv.status?.phase,
                claimRef: pv.spec?.claimRef ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}` : undefined,
                reclaimPolicy: pv.spec?.persistentVolumeReclaimPolicy,
                hasError: pv.status?.phase === 'Failed', raw: pv,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getPersistentVolume', async (_e, ctx, name) => {
        try {
            return ok(await makeCore(ctx).readPersistentVolume({ name }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deletePersistentVolume', async (_e, ctx, name) => {
        try {
            await makeCore(ctx).deletePersistentVolume({ name });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // PVCs
    electron_1.ipcMain.handle('k8s:getPersistentVolumeClaims', async (_e, ctx, namespaces) => {
        try {
            const api = makeCore(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listPersistentVolumeClaimForAllNamespaces()).items, async (ns) => (await api.listNamespacedPersistentVolumeClaim({ namespace: ns })).items);
            return ok(items.map((pvc) => ({
                name: pvc.metadata.name, namespace: pvc.metadata.namespace,
                uid: pvc.metadata.uid, creationTimestamp: pvc.metadata.creationTimestamp,
                storageClass: pvc.spec?.storageClassName, accessModes: pvc.spec?.accessModes,
                capacity: pvc.status?.capacity?.storage, status: pvc.status?.phase,
                volumeName: pvc.spec?.volumeName, hasError: pvc.status?.phase === 'Lost', raw: pvc,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getPersistentVolumeClaim', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeCore(ctx).readNamespacedPersistentVolumeClaim({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deletePersistentVolumeClaim', async (_e, ctx, ns, name) => {
        try {
            await makeCore(ctx).deleteNamespacedPersistentVolumeClaim({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // StorageClasses
    electron_1.ipcMain.handle('k8s:getStorageClasses', async (_e, ctx) => {
        try {
            const res = await makeStorage(ctx).listStorageClass();
            return ok(res.items.map((sc) => ({
                name: sc.metadata.name, uid: sc.metadata.uid, creationTimestamp: sc.metadata.creationTimestamp,
                provisioner: sc.provisioner, reclaimPolicy: sc.reclaimPolicy,
                volumeBindingMode: sc.volumeBindingMode,
                isDefault: sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
                hasError: false, raw: sc,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getStorageClass', async (_e, ctx, name) => {
        try {
            return ok(await makeStorage(ctx).readStorageClass({ name }));
        }
        catch (e) {
            return fail(e);
        }
    });
    // ConfigMaps
    electron_1.ipcMain.handle('k8s:getConfigMaps', async (_e, ctx, namespaces) => {
        try {
            const api = makeCore(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listConfigMapForAllNamespaces()).items, async (ns) => (await api.listNamespacedConfigMap({ namespace: ns })).items);
            return ok(items.map((cm) => ({
                name: cm.metadata.name, namespace: cm.metadata.namespace,
                uid: cm.metadata.uid, creationTimestamp: cm.metadata.creationTimestamp,
                data: cm.data, dataCount: Object.keys(cm.data || {}).length,
                hasError: false, raw: cm,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getConfigMap', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeCore(ctx).readNamespacedConfigMap({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchConfigMap', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeCore(ctx).patchNamespacedConfigMap({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:createConfigMap', async (_e, ctx, ns, body) => {
        try {
            return ok(await makeCore(ctx).createNamespacedConfigMap({ namespace: ns, body }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteConfigMap', async (_e, ctx, ns, name) => {
        try {
            await makeCore(ctx).deleteNamespacedConfigMap({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // Secrets
    electron_1.ipcMain.handle('k8s:getSecrets', async (_e, ctx, namespaces) => {
        try {
            const api = makeCore(ctx);
            const items = await getAllNs(namespaces, async () => (await api.listSecretForAllNamespaces()).items, async (ns) => (await api.listNamespacedSecret({ namespace: ns })).items);
            return ok(items.map((s) => ({
                name: s.metadata.name, namespace: s.metadata.namespace,
                uid: s.metadata.uid, creationTimestamp: s.metadata.creationTimestamp,
                type: s.type, dataCount: Object.keys(s.data || {}).length,
                hasError: false, raw: s,
            })));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getSecret', async (_e, ctx, ns, name) => {
        try {
            return ok(await makeCore(ctx).readNamespacedSecret({ name, namespace: ns }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchSecret', async (_e, ctx, ns, name, patch) => {
        try {
            return ok(await makeCore(ctx).patchNamespacedSecret({ name, namespace: ns, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:createSecret', async (_e, ctx, ns, body) => {
        try {
            return ok(await makeCore(ctx).createNamespacedSecret({ namespace: ns, body }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:deleteSecret', async (_e, ctx, ns, name) => {
        try {
            await makeCore(ctx).deleteNamespacedSecret({ name, namespace: ns });
            return ok(null);
        }
        catch (e) {
            return fail(e);
        }
    });
    // Nodes
    electron_1.ipcMain.handle('k8s:getNodes', async (_e, ctx) => {
        try {
            const res = await makeCore(ctx).listNode();
            return ok(res.items.map((n) => {
                const readyCond = n.status?.conditions?.find((c) => c.type === 'Ready');
                const roles = Object.keys(n.metadata?.labels || {})
                    .filter((k) => k.startsWith('node-role.kubernetes.io/'))
                    .map((k) => k.replace('node-role.kubernetes.io/', ''));
                return {
                    name: n.metadata.name, uid: n.metadata.uid, creationTimestamp: n.metadata.creationTimestamp,
                    roles: roles.length ? roles : ['<none>'],
                    status: readyCond?.status === 'True' ? 'Ready' : 'NotReady',
                    version: n.status?.nodeInfo?.kubeletVersion, osImage: n.status?.nodeInfo?.osImage,
                    kernelVersion: n.status?.nodeInfo?.kernelVersion, containerRuntime: n.status?.nodeInfo?.containerRuntimeVersion,
                    cpu: n.status?.capacity?.cpu, memory: n.status?.capacity?.memory,
                    addresses: n.status?.addresses?.map((a) => ({ type: a.type, address: a.address })),
                    conditions: n.status?.conditions?.map((c) => ({ type: c.type, status: c.status, reason: c.reason, message: c.message })),
                    taints: n.spec?.taints?.map((t) => ({ key: t.key, value: t.value, effect: t.effect })),
                    hasError: readyCond?.status !== 'True', raw: n,
                };
            }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:getNode', async (_e, ctx, name) => {
        try {
            return ok(await makeCore(ctx).readNode({ name }));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:patchNode', async (_e, ctx, name, patch) => {
        try {
            return ok(await makeCore(ctx).patchNode({ name, body: patch }, mergePatchOptions));
        }
        catch (e) {
            return fail(e);
        }
    });
    electron_1.ipcMain.handle('k8s:applyResource', async (_e, ctx, _ns, resource) => {
        try {
            const kc = getKubeConfig(ctx);
            const client = k8s.KubernetesObjectApi.makeApiClient(kc);
            const res = await client.patch(resource, undefined, undefined, 'kubestalker', true, k8s.PatchStrategy.ServerSideApply);
            return ok(res.body);
        }
        catch (e) {
            return fail(e);
        }
    });
}
// ── Lifecycle ─────────────────────────────────────────────────────────────────
electron_1.app.whenReady().then(() => {
    initDatabase();
    registerDbHandlers();
    registerK8sHandlers();
    createWindow();
    electron_1.app.on('activate', () => { if (electron_1.BrowserWindow.getAllWindows().length === 0)
        createWindow(); });
});
electron_1.app.on('window-all-closed', () => { if (process.platform !== 'darwin')
    electron_1.app.quit(); });
