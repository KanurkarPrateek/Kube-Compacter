---
layout: default
title: Advanced Configuration
nav_order: 2
parent: Configuration
---

# Advanced Configuration Guide

## Configuration Overview

Kube-Compactor offers extensive configuration options for fine-tuning optimization behavior:

```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: production
spec:
  # Core Settings
  mode: manual
  safetyThreshold: conservative

  # Targeting
  targetNamespaces: ["production", "staging"]
  excludeNamespaces: ["kube-system", "monitoring"]

  # Algorithm Configuration
  binPackingStrategy: network-aware
  consolidationEnabled: true
  rightSizingEnabled: true

  # Scheduling
  schedule: "0 2 * * *"  # 2 AM daily
  safeWindows:
    - start: "02:00"
      end: "05:00"
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"]

  # Advanced Settings
  maxMigrationsPerCycle: 10
  migrationBatchSize: 1
  cooldownPeriod: "5m"

  # Resource Thresholds
  thresholds:
    minNodeUtilization: 20  # Don't consolidate nodes above 20%
    maxNodeUtilization: 85  # Leave 15% headroom
    overProvisionThreshold: 30  # Flag workloads using <30%

  # Network Optimization
  networkOptimization:
    enabled: true
    crossZoneCostFactor: 2.0
    affinityWeight: 1.5

  # Notifications
  notifications:
    slack:
      webhook: "https://hooks.slack.com/services/..."
      channel: "#kube-compactor"
      alertOn: ["migration_failed", "savings_found"]
    email:
      recipients: ["ops@example.com"]
      smtp:
        host: smtp.gmail.com
        port: 587
        from: "kube-compactor@example.com"
```

## Operation Modes Deep Dive

### Manual Mode Configuration

Best for production environments where every action needs approval:

```yaml
spec:
  mode: manual
  approvalPolicy:
    requireApproval: true
    approvers:
      - email: "platform-lead@example.com"
      - email: "sre-team@example.com"
    approvalTimeout: "24h"
    autoRejectAfterTimeout: true

  # Risk-based approval
  riskBasedApproval:
    low:
      autoApprove: false
      notifyOnly: true
    medium:
      requireApprovals: 1
      allowedApprovers: ["sre-team"]
    high:
      requireApprovals: 2
      allowedApprovers: ["platform-lead", "sre-team"]
```

### Semi-Auto Mode Configuration

For staging/dev environments with automatic safe operations:

```yaml
spec:
  mode: semi-auto
  safetyThreshold: medium

  autoMigrationRules:
    # Auto-migrate if all conditions met
    conditions:
      - type: "WorkloadRisk"
        operator: "LessThan"
        value: "medium"
      - type: "CPUUsage"
        operator: "LessThan"
        value: "2.0"
      - type: "Replicas"
        operator: "GreaterThan"
        value: "1"

  # Workload-specific rules
  workloadPolicies:
    - name: "stateless-apps"
      selector:
        labels:
          type: "stateless"
      autoMigrate: true
      priority: 1

    - name: "databases"
      selector:
        labels:
          type: "database"
      autoMigrate: false
      requireManualApproval: true
      priority: 10
```

## Bin-Packing Strategies

### Strategy Comparison

| Strategy | Best For | Pros | Cons |
|----------|----------|------|------|
| first-fit | General use | Fast, simple | May not be optimal |
| best-fit | Memory-constrained | Minimizes waste | Slower computation |
| worst-fit | Load distribution | Spreads load | Lower density |
| network-aware | Microservices | Reduces latency | Complex setup |
| affinity-based | Production | Respects rules | May limit consolidation |

### Network-Aware Configuration

```yaml
spec:
  binPackingStrategy: network-aware

  networkOptimization:
    enabled: true

    # Service mesh configuration
    serviceMesh:
      enabled: true
      provider: "istio"  # or "linkerd"

    # Traffic analysis
    trafficAnalysis:
      enabled: true
      dataSource: "istio-telemetry"  # or "prometheus"
      samplePeriod: "7d"

    # Placement rules
    placementRules:
      - name: "frontend-backend-colocation"
        selector:
          service: ["frontend", "backend"]
        placement: "same-node"
        weight: 10

      - name: "database-isolation"
        selector:
          type: "database"
        placement: "dedicated-node"
        weight: 20

    # Cost factors
    costModel:
      intraNodeTraffic: 0     # Free
      interNodeTraffic: 0.01  # $0.01/GB
      crossZoneTraffic: 0.02  # $0.02/GB
      internetEgress: 0.09    # $0.09/GB
```

### Custom Algorithm Implementation

```yaml
spec:
  binPackingStrategy: custom

  customAlgorithm:
    name: "resource-balanced-packing"
    implementation: |
      function customPack(workloads, nodes) {
        // Balance CPU and Memory equally
        workloads.sort((a, b) => {
          const scoreA = a.cpu * 0.5 + a.memory * 0.5;
          const scoreB = b.cpu * 0.5 + b.memory * 0.5;
          return scoreB - scoreA;
        });

        for (const workload of workloads) {
          const bestNode = nodes.find(n =>
            n.availableCpu >= workload.cpu &&
            n.availableMemory >= workload.memory &&
            Math.abs(n.cpuUsage - n.memoryUsage) < 0.2
          );
          if (bestNode) bestNode.place(workload);
        }
      }
```

## Resource Thresholds

### Node Utilization Targets

```yaml
spec:
  thresholds:
    # Consolidation triggers
    minNodeUtilization: 20      # Consolidate if below 20%
    targetNodeUtilization: 75   # Aim for 75% utilization
    maxNodeUtilization: 85      # Never exceed 85%

    # Buffer settings
    cpuHeadroom: 15            # Keep 15% CPU free
    memoryHeadroom: 20         # Keep 20% memory free

    # Spike tolerance
    burstCapacity: 1.5         # Allow 50% burst
    sustainedLoadThreshold: 80 # Alert if >80% for 5min
```

### Workload Classification

```yaml
spec:
  workloadClassification:
    classes:
      - name: "critical"
        selector:
          labels:
            tier: "critical"
        settings:
          neverEvict: true
          requiresDedicatedNode: false
          minReplicas: 2

      - name: "batch"
        selector:
          labels:
            type: "batch"
        settings:
          preemptible: true
          packingPriority: low
          allowedDowntime: "5m"

      - name: "development"
        selector:
          namespaces: ["dev", "staging"]
        settings:
          aggressivePacking: true
          overProvisionTolerance: 50  # Allow 50% over-provisioning
```

## Migration Policies

### Safe Migration Windows

```yaml
spec:
  safeWindows:
    # Weekday maintenance window
    - start: "02:00"
      end: "05:00"
      days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
      timeZone: "America/New_York"

    # Weekend extended window
    - start: "00:00"
      end: "06:00"
      days: ["Saturday", "Sunday"]
      timeZone: "America/New_York"

    # Holiday windows
    holidays:
      - date: "2024-12-25"
        allDay: true
      - date: "2024-01-01"
        allDay: true

  # Emergency override
  emergencyOverride:
    enabled: true
    requiresApproval: true
    approvers: ["oncall@example.com"]
```

### Migration Ordering

```yaml
spec:
  migrationStrategy:
    order: "risk-ascending"  # low-risk first

    priorities:
      - selector:
          type: "stateless"
        priority: 1  # Migrate first

      - selector:
          type: "stateful"
        priority: 5  # Migrate with caution

      - selector:
          type: "database"
        priority: 10  # Migrate last

    batchConfiguration:
      batchSize: 5
      batchDelay: "2m"
      parallelism: 1  # Sequential migration

    healthChecks:
      enabled: true
      timeout: "5m"
      retries: 3
```

## Monitoring & Alerting

### Prometheus Integration

```yaml
spec:
  monitoring:
    prometheus:
      enabled: true
      endpoint: "http://prometheus:9090"

      # Custom queries for decision making
      queries:
        nodeUtilization: |
          avg_over_time(node_cpu_usage[5m])

        workloadSpikes: |
          max_over_time(container_cpu_usage[1h]) >
          avg_over_time(container_cpu_usage[24h]) * 2

      # Alert rules
      alerts:
        - name: "HighSavingsPotential"
          expr: "kube_compactor_potential_savings > 1000"
          for: "1h"
          annotations:
            summary: "Potential savings over $1000/month detected"

        - name: "MigrationFailureRate"
          expr: "rate(kube_compactor_migrations_failed[1h]) > 0.1"
          annotations:
            summary: "High migration failure rate"
```

### Slack Notifications

```yaml
spec:
  notifications:
    slack:
      webhook: "${SLACK_WEBHOOK_URL}"
      channel: "#kube-compactor"

      # Message templates
      templates:
        analysisComplete: |
          📊 *Analysis Complete*
          • Potential Savings: {{ .Savings }}
          • Nodes to remove: {{ .NodeReduction }}
          • Over-provisioned workloads: {{ .OverProvisionedCount }}

        migrationApproval: |
          🔄 *Migration Plan Ready*
          • Total migrations: {{ .MigrationCount }}
          • Risk level: {{ .RiskLevel }}
          • Approve: `kubectl patch migrationplan {{ .PlanName }} --type merge -p '{"spec":{"approved":true}}'`

      # Notification triggers
      triggers:
        - event: "analysis_complete"
          template: "analysisComplete"
          condition: "savings > 100"

        - event: "migration_plan_created"
          template: "migrationApproval"
          condition: "manual_mode"
```

## Security Configuration

### RBAC Fine-Tuning

```yaml
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: kube-compactor-custom
rules:
  # Read-only access to most resources
  - apiGroups: ["", "apps", "batch"]
    resources: ["*"]
    verbs: ["get", "list", "watch"]

  # Write access only for evictions
  - apiGroups: [""]
    resources: ["pods/eviction"]
    verbs: ["create"]

  # Restricted namespace access
  - apiGroups: [""]
    resources: ["pods"]
    resourceNames: []  # Can specify exact pod names
    verbs: ["delete"]

  # CRD full access
  - apiGroups: ["optimizer.io"]
    resources: ["*"]
    verbs: ["*"]
```

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: kube-compactor-network
  namespace: kube-compactor
spec:
  podSelector:
    matchLabels:
      app: kube-compactor

  policyTypes:
  - Ingress
  - Egress

  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: monitoring
    ports:
    - protocol: TCP
      port: 8080  # Metrics

  egress:
  - to:
    - namespaceSelector: {}  # Access to all namespaces
    ports:
    - protocol: TCP
      port: 443  # Kubernetes API
  - to:
    - namespaceSelector:
        matchLabels:
          name: kube-system
    ports:
    - protocol: TCP
      port: 443  # Metrics Server
```

## Performance Tuning

### Resource Limits

```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: kube-compactor-quota
  namespace: kube-compactor
spec:
  hard:
    requests.cpu: "2"
    requests.memory: 2Gi
    limits.cpu: "4"
    limits.memory: 4Gi
```

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: kube-compactor-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: kube-compactor-controller
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## Troubleshooting Configuration

### Debug Logging

```yaml
spec:
  logging:
    level: debug  # error, warn, info, debug, trace
    format: json  # or text
    output: stdout

    # Component-specific logging
    components:
      controller: info
      analyzer: debug
      binpacking: trace
      migrator: debug

    # Log sampling
    sampling:
      enabled: true
      rate: 0.1  # Log 10% of events in high-volume scenarios
```

### Dry-Run Mode

```yaml
spec:
  dryRun:
    enabled: true
    generateReports: true
    simulateMigrations: true
    outputPath: "/tmp/kube-compactor-simulation"
```

---

## Configuration Best Practices

1. **Start Conservative**: Begin with observe mode and conservative thresholds
2. **Test in Staging**: Always test configuration changes in non-production first
3. **Monitor Metrics**: Watch resource metrics after configuration changes
4. **Gradual Changes**: Make incremental changes rather than large jumps
5. **Document Changes**: Keep a changelog of configuration modifications
6. **Version Control**: Store configurations in Git for rollback capability

## Next Steps

- [Configuration Examples](examples)
- [Helm Values Reference](helm-values)
- [Troubleshooting](../troubleshooting)