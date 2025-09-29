---
layout: default
title: API Reference
nav_order: 1
parent: API
---

# API Reference

## Custom Resource Definitions

### OptimizationConfig

Controls the behavior of Kube-Compactor optimization engine.

#### API Version
`optimizer.io/v1alpha1`

#### Kind
`OptimizationConfig`

#### Spec Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `mode` | string | `observe` | Operation mode: `observe`, `manual`, `semi-auto`, `full-auto` |
| `safetyThreshold` | string | `conservative` | Safety level: `conservative`, `medium`, `aggressive` |
| `targetNamespaces` | []string | All namespaces | Namespaces to analyze |
| `excludeNamespaces` | []string | `["kube-system"]` | Namespaces to exclude |
| `schedule` | string | `*/30 * * * *` | Cron schedule for analysis |
| `binPackingStrategy` | string | `best-fit` | Algorithm: `first-fit`, `best-fit`, `network-aware`, `affinity-based` |
| `consolidationEnabled` | boolean | `true` | Enable node consolidation |
| `rightSizingEnabled` | boolean | `true` | Enable workload right-sizing |
| `safeWindows` | []SafeWindow | None | Time windows for safe migrations |
| `notifications` | Notifications | None | Notification configuration |

#### SafeWindow Object

```yaml
safeWindows:
  - start: "02:00"      # Start time (24h format)
    end: "05:00"        # End time (24h format)
    days:               # Days of week
      - "Monday"
      - "Tuesday"
      - "Wednesday"
      - "Thursday"
      - "Friday"
    timeZone: "UTC"     # Timezone (optional, default UTC)
```

#### Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | Current phase: `Pending`, `Analyzing`, `Ready`, `Error` |
| `lastAnalysis` | timestamp | Last analysis timestamp |
| `nodeCount` | integer | Number of nodes analyzed |
| `workloadCount` | integer | Number of workloads analyzed |
| `potentialSavings` | string | Estimated monthly savings |
| `recommendations` | integer | Number of recommendations |
| `conditions` | []Condition | Status conditions |

#### Example

```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: production-config
spec:
  mode: manual
  safetyThreshold: conservative
  targetNamespaces:
    - production
    - staging
  excludeNamespaces:
    - kube-system
    - monitoring
  schedule: "0 2 * * *"
  binPackingStrategy: network-aware
  consolidationEnabled: true
  rightSizingEnabled: true
  safeWindows:
    - start: "02:00"
      end: "05:00"
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
  notifications:
    slack:
      webhook: "https://hooks.slack.com/..."
      channel: "#ops"
status:
  phase: Ready
  lastAnalysis: "2024-01-20T02:00:00Z"
  nodeCount: 10
  workloadCount: 45
  potentialSavings: "$2,500/month"
  recommendations: 23
```

---

### MigrationPlan

Represents a plan to migrate workloads between nodes.

#### API Version
`optimizer.io/v1alpha1`

#### Kind
`MigrationPlan`

#### Spec Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `migrations` | []Migration | Required | List of migrations to perform |
| `approved` | boolean | `false` | Whether plan is approved |
| `approvedBy` | string | None | Email/ID of approver |
| `approvalTime` | timestamp | None | When approval was given |
| `autoApprove` | boolean | `false` | Auto-approve if true |

#### Migration Object

```yaml
migrations:
  - workload:
      name: "frontend-deployment"
      namespace: "default"
      kind: "Deployment"
    fromNode: "node-1"
    toNode: "node-2"
    risk: "low"  # low, medium, high
    reason: "Consolidation for cost savings"
    estimatedSavings: "$50/month"
```

#### Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `phase` | string | `Pending`, `Approved`, `Executing`, `Completed`, `Failed`, `Cancelled` |
| `executedMigrations` | integer | Number of completed migrations |
| `totalMigrations` | integer | Total number of migrations |
| `startTime` | timestamp | Execution start time |
| `completionTime` | timestamp | Execution completion time |
| `results` | []MigrationResult | Individual migration results |

#### Example

```yaml
apiVersion: optimizer.io/v1alpha1
kind: MigrationPlan
metadata:
  name: migplan-20240120-001
  namespace: default
spec:
  migrations:
    - workload:
        name: frontend-deployment
        namespace: production
        kind: Deployment
      fromNode: worker-1
      toNode: worker-3
      risk: low
      reason: "Node consolidation"
      estimatedSavings: "$140/month"
    - workload:
        name: backend-deployment
        namespace: production
        kind: Deployment
      fromNode: worker-2
      toNode: worker-3
      risk: medium
      reason: "Co-location with frontend"
      estimatedSavings: "$140/month"
  approved: true
  approvedBy: "admin@example.com"
  approvalTime: "2024-01-20T03:00:00Z"
status:
  phase: Completed
  executedMigrations: 2
  totalMigrations: 2
  startTime: "2024-01-20T03:01:00Z"
  completionTime: "2024-01-20T03:05:00Z"
  results:
    - workload: frontend-deployment
      status: Success
      message: "Migration completed successfully"
      timestamp: "2024-01-20T03:02:00Z"
    - workload: backend-deployment
      status: Success
      message: "Migration completed successfully"
      timestamp: "2024-01-20T03:04:00Z"
```

---

### OptimizationReport

Contains analysis results and recommendations.

#### API Version
`optimizer.io/v1alpha1`

#### Kind
`OptimizationReport`

#### Spec Fields

| Field | Type | Description |
|-------|------|-------------|
| `configRef` | string | Reference to OptimizationConfig |
| `timestamp` | timestamp | Report generation time |

#### Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `summary` | Summary | Cluster summary statistics |
| `consolidation` | ConsolidationAnalysis | Node consolidation analysis |
| `overProvisionedWorkloads` | []WorkloadAnalysis | Over-provisioned workload list |
| `recommendations` | []Recommendation | Optimization recommendations |

#### Summary Object

```yaml
summary:
  totalNodes: 10
  activeNodes: 10
  totalWorkloads: 45
  cpuUtilization: "35%"
  memoryUtilization: "42%"
  cpuWaste: "65%"
  memoryWaste: "58%"
```

#### ConsolidationAnalysis Object

```yaml
consolidation:
  feasible: true
  currentNodes: 10
  requiredNodes: 4
  nodeReduction: 6
  estimatedSavings: "$2,100/month"
  confidence: "high"
```

#### Example

```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationReport
metadata:
  name: report-20240120-020000
  namespace: default
spec:
  configRef: production-config
  timestamp: "2024-01-20T02:00:00Z"
status:
  summary:
    totalNodes: 10
    activeNodes: 10
    totalWorkloads: 45
    cpuUtilization: "35%"
    memoryUtilization: "42%"
  consolidation:
    feasible: true
    currentNodes: 10
    requiredNodes: 4
    nodeReduction: 6
    estimatedSavings: "$2,100/month"
  overProvisionedWorkloads:
    - name: nginx-deployment
      namespace: production
      cpuUsage: "0.1"
      cpuLimit: "2.0"
      memoryUsage: "256Mi"
      memoryLimit: "4Gi"
      recommendation: "Reduce CPU limit to 0.3, Memory to 512Mi"
  recommendations:
    - type: "CONSOLIDATION"
      priority: "HIGH"
      message: "Can reduce from 10 to 4 nodes"
      action: "Review and approve migration plan"
      potentialSavings: "$2,100/month"
```

---

## Controller API

### REST Endpoints

The controller exposes these HTTP endpoints:

#### Health Check
```http
GET /healthz
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-20T10:00:00Z"
}
```

#### Readiness Check
```http
GET /readyz
```

Response:
```json
{
  "ready": true,
  "checks": {
    "kubernetes": "ok",
    "metrics": "ok",
    "crds": "ok"
  }
}
```

#### Metrics Endpoint
```http
GET /metrics
```

Prometheus-formatted metrics:
```prometheus
# HELP kube_compactor_nodes_total Total number of nodes
# TYPE kube_compactor_nodes_total gauge
kube_compactor_nodes_total 10

# HELP kube_compactor_workloads_total Total number of workloads
# TYPE kube_compactor_workloads_total gauge
kube_compactor_workloads_total 45

# HELP kube_compactor_potential_savings_dollars Monthly savings potential
# TYPE kube_compactor_potential_savings_dollars gauge
kube_compactor_potential_savings_dollars 2100

# HELP kube_compactor_migrations_total Total migrations by status
# TYPE kube_compactor_migrations_total counter
kube_compactor_migrations_total{status="success"} 23
kube_compactor_migrations_total{status="failed"} 2
```

---

## CLI Commands

### kubectl Plugin Commands

#### Get Optimization Status
```bash
kubectl get optimizationconfigs
kubectl get optconfig  # Short form
```

#### Describe Configuration
```bash
kubectl describe optimizationconfig default
```

#### View Reports
```bash
kubectl get optimizationreports
kubectl describe optimizationreport <report-name>
```

#### Migration Management
```bash
# List migration plans
kubectl get migrationplans

# Approve a migration
kubectl patch migrationplan <plan-name> --type merge \
  -p '{"spec":{"approved":true,"approvedBy":"admin@example.com"}}'

# Cancel a migration
kubectl patch migrationplan <plan-name> --type merge \
  -p '{"status":{"phase":"Cancelled"}}'
```

#### Apply Configuration
```bash
kubectl apply -f optimization-config.yaml
```

---

## Webhook API

### ValidatingWebhook

Validates OptimizationConfig resources:

```yaml
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: kube-compactor-webhook
webhooks:
  - name: validate.optimizer.io
    clientConfig:
      service:
        name: kube-compactor-webhook
        namespace: kube-compactor
        path: "/validate"
    rules:
      - apiGroups: ["optimizer.io"]
        apiVersions: ["v1alpha1"]
        resources: ["optimizationconfigs"]
        operations: ["CREATE", "UPDATE"]
```

Validation Rules:
- Mode must be valid (`observe`, `manual`, `semi-auto`, `full-auto`)
- Schedule must be valid cron expression
- Safety threshold must be valid
- Safe windows must have valid time format

---

## Event API

Kube-Compactor generates these Kubernetes events:

### Analysis Events

```yaml
Events:
  Type    Reason                Age   From             Message
  ----    ------                ----  ----             -------
  Normal  AnalysisStarted       5m    kube-compactor   Starting cluster analysis
  Normal  AnalysisCompleted     4m    kube-compactor   Analysis completed, found $2100/month savings
  Warning AnalysisFailed        3m    kube-compactor   Analysis failed: Metrics server unavailable
```

### Migration Events

```yaml
Events:
  Type    Reason                Age   From             Message
  ----    ------                ----  ----             -------
  Normal  MigrationPlanCreated  2m    kube-compactor   Created migration plan migplan-001
  Normal  MigrationApproved     1m    kube-compactor   Migration plan approved by admin@example.com
  Normal  MigrationStarted      30s   kube-compactor   Starting migration of frontend-deployment
  Normal  MigrationCompleted    10s   kube-compactor   Successfully migrated frontend-deployment
  Warning MigrationFailed       5s    kube-compactor   Failed to migrate backend-deployment: Insufficient resources
```

---

## Go Client Library

```go
import (
    "github.com/KanurkarPrateek/kube-compactor/pkg/client"
    "github.com/KanurkarPrateek/kube-compactor/pkg/apis/optimizer/v1alpha1"
)

// Create client
client, err := client.NewClient(kubeconfig)

// Get OptimizationConfig
config, err := client.OptimizationConfigs().Get("default")

// List Migration Plans
plans, err := client.MigrationPlans("default").List()

// Approve Migration
plan.Spec.Approved = true
plan.Spec.ApprovedBy = "admin@example.com"
err = client.MigrationPlans("default").Update(plan)

// Watch for Reports
watcher, err := client.OptimizationReports("default").Watch()
for event := range watcher.ResultChan() {
    report := event.Object.(*v1alpha1.OptimizationReport)
    fmt.Printf("New report: %s, Savings: %s\n",
        report.Name, report.Status.Consolidation.EstimatedSavings)
}
```

---

## Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| `E001` | Metrics server not available | Install metrics-server |
| `E002` | Insufficient RBAC permissions | Check ClusterRole/ClusterRoleBinding |
| `E003` | Invalid configuration | Validate OptimizationConfig spec |
| `E004` | Migration failed - insufficient resources | Check node capacity |
| `E005` | PDB violation | Adjust PodDisruptionBudget or wait |
| `E006` | Webhook certificate expired | Renew webhook certificates |
| `E007` | CRD not installed | Apply CRD manifests |

---

## Rate Limits

To prevent overwhelming the cluster:

- Analysis: Maximum 1 per minute
- Migration execution: Maximum 10 pods per minute
- API requests: 100 requests per second per client
- Webhook validations: 1000 per second

---

## Backwards Compatibility

### API Versioning

- Current: `v1alpha1` (unstable, may change)
- Future: `v1beta1` (more stable)
- Stable: `v1` (production ready)

### Deprecation Policy

- Alpha APIs: Can change without notice
- Beta APIs: 3 months deprecation notice
- Stable APIs: 6 months deprecation notice

---

## Next Topics

- [SDK Documentation](sdk)
- [Webhook Development](webhooks)
- [Custom Controllers](custom-controllers)