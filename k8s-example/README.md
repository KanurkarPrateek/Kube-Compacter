# Kubernetes Integration Guide

## How It Works in a Kubernetes Cluster

The Node Resource Optimizer can analyze live Kubernetes clusters to identify resource optimization opportunities.

## Prerequisites

1. **kubectl** installed and configured to connect to your cluster
2. **Metrics Server** installed in the cluster (required for `kubectl top`)

### Install Metrics Server (if not installed)
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

## Usage with Kubernetes

### 1. Analyze Live Cluster
```bash
npm start analyze -- --cluster
```

This will:
- Connect to your current kubectl context
- Collect node capacity and usage metrics
- Collect pod resource requests, limits, and actual usage
- Generate consolidation and optimization recommendations

### 2. Deploy Test Workloads
```bash
# Deploy sample workloads with various resource patterns
kubectl apply -f k8s-example/deployment.yaml

# Wait for pods to be running
kubectl wait --for=condition=ready pod -l app=overprovisioned -n resource-test --timeout=60s

# Analyze the cluster
npm start analyze -- --cluster
```

### 3. Apply Recommendations

The tool will generate recommendations in several forms:

#### Node Consolidation
- Shows if workloads can fit on fewer nodes
- Provides migration plan (which pods to move where)
- Calculates infrastructure savings

#### Resource Right-Sizing
- Identifies over-provisioned pods (high limits, low usage)
- Suggests new resource limits based on actual usage
- Generates YAML patches for deployments

## How It Collects Data

### Without Prometheus (Default)
Uses `kubectl` commands to collect:
- **Node metrics**: `kubectl top nodes`
- **Pod metrics**: `kubectl top pods --all-namespaces`
- **Resource definitions**: `kubectl get nodes/pods -o json`

### With Kubernetes API (using @kubernetes/client-node)
The `k8sClient.js` module can:
- Connect directly to Kubernetes API
- Use Metrics API for real-time usage
- Apply recommendations directly to deployments

## Key Metrics Analyzed

1. **CPU & Memory Utilization**
   - Actual usage vs allocated resources
   - Actual usage vs resource limits

2. **Over-Provisioning Detection**
   - Pods using <30% of their limits
   - Nodes with <20% utilization

3. **Consolidation Opportunities**
   - Can workloads fit on fewer nodes?
   - What's the migration plan?

## Example Output for K8s Cluster

```
📊 Node Resource Utilization Report

Node            CPU Used/Total   Memory Used/Total   Efficiency
worker-node-1   4.2/16 (26%)    8.5/32GB (27%)     45%
worker-node-2   2.1/16 (13%)    4.2/32GB (13%)     22%
worker-node-3   0.8/16 (5%)     2.1/32GB (7%)      8%

🔄 Consolidation Analysis
✅ Can consolidate from 3 nodes to 1 node
💰 Estimated savings: $500/month

🎯 Resource Limits Analysis
Over-provisioned workloads: 5
- namespace/pod-name: Using 10% of allocated resources
  Recommendation: Reduce CPU limit from 2000m to 400m
                  Reduce Memory limit from 2Gi to 512Mi
```

## Production Considerations

1. **Safety Margins**: The tool uses 15% safety margin for consolidation recommendations
2. **Peak Usage**: Consider collecting metrics over time (24-48 hours) for accurate sizing
3. **Critical Workloads**: Some workloads may need high limits for burst capacity
4. **Anti-Affinity Rules**: Check pod anti-affinity before consolidating
5. **Node Selectors**: Respect node labels and taints

## Automated Right-Sizing

To apply recommendations (dry-run by default):
```javascript
// In your code
const k8s = new K8sIntegration();
const recommendations = await k8s.generateYamlRecommendations(overprovisionedWorkloads);

// Apply with dry-run
for (const rec of recommendations) {
  await k8s.applyRecommendation(rec, true);
}
```

## Best Practices

1. **Monitor Before Applying**: Watch metrics for at least 24 hours
2. **Test in Staging**: Apply recommendations to non-production first
3. **Gradual Rollout**: Update one deployment at a time
4. **Set Up Alerts**: Monitor for OOM kills and CPU throttling after changes
5. **Keep Buffers**: Don't set limits exactly at usage - keep 20-50% buffer