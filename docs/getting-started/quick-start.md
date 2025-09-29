---
layout: default
title: Quick Start Guide
nav_order: 2
parent: Getting Started
---

# Quick Start Guide

Get Kube-Compactor running in your cluster in 5 minutes!

## Prerequisites

- ✅ Kubernetes cluster (1.19+)
- ✅ kubectl configured
- ✅ Metrics Server installed

### Check Prerequisites

```bash
# Check Kubernetes version
kubectl version --short

# Check if Metrics Server is installed
kubectl top nodes

# If Metrics Server is not installed:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## 🚀 One-Command Installation

Deploy Kube-Compactor in **safe observe mode** (no actions taken):

```bash
kubectl apply -f https://raw.githubusercontent.com/KanurkarPrateek/Kube-Compacter/main/k8s-controller/deploy/quick-start.yaml
```

This installs:
- ✅ Custom Resource Definitions (CRDs)
- ✅ Controller in `node-optimizer` namespace
- ✅ RBAC permissions
- ✅ Default configuration (observe mode)

## 🔍 Verify Installation

```bash
# Check if controller is running
kubectl get pods -n node-optimizer

# Expected output:
NAME                                       READY   STATUS    RESTARTS   AGE
node-optimizer-controller-7d4f5c6b9-x2lmn   1/1     Running   0          30s

# Check CRDs are installed
kubectl get crd | grep optimizer

# Expected output:
optimizationconfigs.optimizer.io    2024-01-20T10:00:00Z
migrationplans.optimizer.io         2024-01-20T10:00:00Z
optimizationreports.optimizer.io    2024-01-20T10:00:00Z
```

## 📊 Your First Analysis

### Wait for Initial Analysis (30 seconds)

The controller analyzes your cluster every 30 seconds:

```bash
# Watch the optimization config status
kubectl get optimizationconfigs -w

# Expected output:
NAME      MODE      PHASE       NODES   WORKLOADS   SAVINGS
default   observe   Analyzing   5       23          calculating...
default   observe   Ready       5       23          $1,200/month
```

### View the Analysis Report

```bash
# Get the latest report
kubectl get optimizationreports

# View detailed report
kubectl describe optimizationreport -n default $(kubectl get optimizationreports -n default -o jsonpath='{.items[0].metadata.name}')
```

### Example Report Output

```yaml
Summary:
  Total Nodes: 5
  Active Nodes: 5
  Total Workloads: 23
  CPU Utilization: 28%
  Memory Utilization: 35%

Consolidation Analysis:
  Feasible: true
  Current Nodes: 5
  Required Nodes: 2
  Node Reduction: 3 (60%)
  Estimated Savings: $1,200/month

Over-Provisioned Workloads: 8
  - frontend-deployment: Using 10% of allocated resources
  - backend-deployment: Using 15% of allocated resources
  - worker-deployment: Using 8% of allocated resources

Recommendations:
  - Can consolidate from 5 nodes to 2 nodes
  - Would save 60% of infrastructure costs
  - 8 workloads are significantly over-provisioned
```

## 🎮 Understanding Operation Modes

Kube-Compactor starts in **Observe Mode** by default:

### Current Mode: Observe (Safe)
- ✅ Analyzes cluster
- ✅ Generates reports
- ❌ Takes no actions
- Perfect for initial evaluation

### Changing Modes

```bash
# Edit the configuration
kubectl edit optimizationconfig default

# Change spec.mode from "observe" to one of:
# - "manual": Requires approval for each migration
# - "semi-auto": Auto-migrates low-risk workloads
# - "observe": Just analyze (default)
```

## 📈 Viewing Recommendations

### CLI Method

```bash
# View migration plans (if any)
kubectl get migrationplans

# View specific plan details
kubectl describe migrationplan <plan-name>
```

### Understanding the Output

```yaml
Migration Plan: migplan-1234567890
Status: Pending Approval

Migrations:
  1. Workload: frontend-deployment
     From: node-1
     To: node-2
     Risk: LOW
     Reason: Consolidation for cost savings

  2. Workload: backend-deployment
     From: node-3
     To: node-2
     Risk: LOW
     Reason: Co-location with frontend

Estimated Savings: $400/month
Total Migrations: 12
```

## 🚦 Taking Action (Manual Mode)

If you're ready to optimize, switch to manual mode:

### Step 1: Change to Manual Mode

```bash
kubectl patch optimizationconfig default --type merge -p '{"spec":{"mode":"manual"}}'
```

### Step 2: Wait for Migration Plan

```bash
# Watch for new migration plans
kubectl get migrationplans -w
```

### Step 3: Review and Approve

```bash
# Review the plan
kubectl describe migrationplan <plan-name>

# If satisfied, approve it
kubectl patch migrationplan <plan-name> --type merge \
  -p '{"spec":{"approved":true,"approvedBy":"your-name@example.com"}}'
```

### Step 4: Monitor Execution

```bash
# Watch the migration progress
kubectl get migrationplan <plan-name> -w

# Check pod movements
kubectl get pods -A -o wide
```

## 🔧 Basic Configuration

### Customize Analysis Schedule

```yaml
# edit-config.yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: default
spec:
  mode: observe
  schedule: "*/10 * * * *"  # Every 10 minutes
  excludeNamespaces:
    - kube-system
    - monitoring
  binPackingStrategy: best-fit
```

Apply configuration:
```bash
kubectl apply -f edit-config.yaml
```

## 📊 Example: Real Cluster Analysis

Here's what Kube-Compactor found in a real cluster:

```bash
$ kubectl describe optimizationreport report-1234567890

Current State:
  Nodes: 8 (m5.2xlarge)
  Total CPU: 64 cores
  Used CPU: 18.3 cores (28.6%)
  Total Memory: 512 GB
  Used Memory: 142 GB (27.7%)
  Monthly Cost: $1,120

After Optimization:
  Required Nodes: 3
  CPU Utilization: 76.2%
  Memory Utilization: 73.8%
  Monthly Cost: $420

Savings Analysis:
  Nodes to Remove: 5
  Monthly Savings: $700
  Annual Savings: $8,400
  Reduction: 62.5%

Top Over-Provisioned Workloads:
  1. nginx-deployment: Allocated 2 CPU, Using 0.05 CPU (2.5%)
  2. redis-cache: Allocated 4GB RAM, Using 200MB (5%)
  3. worker-pool: Allocated 8 CPU, Using 0.8 CPU (10%)
```

## 🛡️ Safety Features

Kube-Compactor includes built-in safety:

1. **Default to Observe Mode**: No actions without explicit configuration
2. **Respects PDBs**: Won't violate Pod Disruption Budgets
3. **Health Checks**: Verifies pods after migration
4. **Gradual Migration**: One pod at a time
5. **Instant Rollback**: Available if needed

## 📚 Next Steps

Now that you have Kube-Compactor running:

<div class="next-steps">
  <div class="step">
    <h3>1. Run for 24 Hours</h3>
    <p>Let it analyze your cluster's patterns</p>
  </div>

  <div class="step">
    <h3>2. Review Reports</h3>
    <p>Understand optimization opportunities</p>
  </div>

  <div class="step">
    <h3>3. Test in Staging</h3>
    <p>Try manual mode in non-production first</p>
  </div>

  <div class="step">
    <h3>4. Deploy to Production</h3>
    <p>Use manual mode with careful approval</p>
  </div>
</div>

## 🆘 Troubleshooting

### Controller Not Starting

```bash
# Check logs
kubectl logs -n node-optimizer deployment/node-optimizer-controller

# Common issues:
# - Metrics Server not installed
# - Insufficient RBAC permissions
```

### No Reports Generated

```bash
# Check if workloads exist in target namespaces
kubectl get pods -A | grep -v kube-system

# Ensure metrics are available
kubectl top pods -A
```

### Migration Failed

```bash
# Check migration plan status
kubectl describe migrationplan <plan-name>

# View controller logs for errors
kubectl logs -n node-optimizer deployment/node-optimizer-controller
```

## 🎉 Success Checklist

- [ ] Kube-Compactor deployed successfully
- [ ] Controller pod is running
- [ ] First analysis report generated
- [ ] Understand potential savings
- [ ] Know how to change operation modes
- [ ] Ready to optimize!

---

<div class="support-box">
  <h3>Need Help?</h3>
  <p>Join our community for support:</p>
  <ul>
    <li><a href="https://github.com/KanurkarPrateek/Kube-Compacter/issues">GitHub Issues</a></li>
    <li><a href="https://kubernetes.slack.com">Kubernetes Slack #kube-compactor</a></li>
  </ul>
</div>