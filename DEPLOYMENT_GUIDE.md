# Kubernetes Controller Deployment Guide

## 🚀 Quick Start (One Command!)

Deploy the controller with safe defaults (OBSERVE mode):

```bash
kubectl apply -f https://raw.githubusercontent.com/yourusername/node-optimizer/main/k8s-controller/deploy/quick-start.yaml
```

This installs:
- CRDs (Custom Resource Definitions)
- Controller in `node-optimizer` namespace
- RBAC permissions
- Default config in OBSERVE mode (safe - no actions taken)

## 📦 Installation Methods

### Method 1: Helm (Recommended for Production)

```bash
# Add repo
helm repo add node-optimizer https://charts.node-optimizer.io
helm repo update

# Install with default values (OBSERVE mode)
helm install node-optimizer node-optimizer/node-optimizer \
  --namespace node-optimizer \
  --create-namespace

# Install with custom values
helm install node-optimizer node-optimizer/node-optimizer \
  --namespace node-optimizer \
  --create-namespace \
  --set controller.defaultConfig.mode=manual \
  --set notifications.slack.enabled=true \
  --set notifications.slack.webhook="https://hooks.slack.com/..."
```

### Method 2: Kubectl Apply

```bash
# 1. Install CRDs
kubectl apply -f k8s-controller/crds/optimizer-crds.yaml

# 2. Deploy operator
kubectl apply -f k8s-controller/deploy/operator.yaml

# 3. Create default config
kubectl apply -f - <<EOF
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: default
spec:
  mode: observe
  excludeNamespaces:
    - kube-system
    - kube-public
EOF
```

### Method 3: Build and Deploy from Source

```bash
# Build Docker image
docker build -f k8s-controller/Dockerfile -t node-optimizer:latest .

# Push to your registry
docker tag node-optimizer:latest your-registry/node-optimizer:latest
docker push your-registry/node-optimizer:latest

# Update deployment with your image
kubectl set image deployment/node-optimizer-controller \
  controller=your-registry/node-optimizer:latest \
  -n node-optimizer
```

## 🎮 Controller Modes Configuration

### 1. OBSERVE Mode (Default - Safest)
```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: observe-only
spec:
  mode: observe
  schedule: "*/30 * * * *"
```

### 2. MANUAL Mode (Production)
```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: production
spec:
  mode: manual
  safetyThreshold: conservative
  safeWindows:
    - start: "02:00"
      end: "05:00"
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
```

### 3. SEMI-AUTO Mode (Staging)
```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: staging
spec:
  mode: semi-auto
  safetyThreshold: medium
  targetNamespaces:
    - staging
    - development
```

## 📊 Viewing Reports and Recommendations

### Check Controller Status
```bash
kubectl get optimizationconfigs
kubectl describe optimizationconfig default
```

### View Latest Report
```bash
kubectl get optimizationreports
kubectl describe optimizationreport report-<timestamp>
```

### View Migration Plans
```bash
kubectl get migrationplans
kubectl describe migrationplan migplan-<timestamp>
```

### Approve Migrations (Manual Mode)
```bash
# View pending migrations
kubectl get migrationplans -o yaml

# Approve specific migration
kubectl patch migrationplan migplan-123456 --type merge \
  -p '{"spec":{"approved":true,"approvedBy":"admin@example.com"}}'
```

## 🔧 Advanced Configuration

### Multi-Cluster Setup
```yaml
apiVersion: optimizer.io/v1alpha1
kind: OptimizationConfig
metadata:
  name: multi-cluster
spec:
  mode: observe
  targetClusters:
    - name: production-us-east
      context: prod-us-east
    - name: production-eu-west
      context: prod-eu-west
```

### Custom Bin Packing Strategies
```yaml
spec:
  binPackingStrategy: network-aware  # Options: first-fit, best-fit, network-aware, affinity-based
  consolidationEnabled: true
  rightSizingEnabled: true
```

### Notification Setup
```yaml
spec:
  notifications:
    slack:
      webhook: "https://hooks.slack.com/services/..."
      channel: "#cost-optimization"
    email:
      - "finops-team@example.com"
      - "platform-team@example.com"
```

## 🛡️ Security Considerations

1. **RBAC**: Controller needs permissions to:
   - Read nodes, pods, metrics
   - Delete/evict pods (for migration)
   - Update deployments/statefulsets

2. **Network Policies**: Allow controller to:
   - Access Kubernetes API
   - Access Metrics Server
   - Send notifications (if configured)

3. **Pod Security Standards**:
```yaml
apiVersion: v1
kind: Pod
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000
  containers:
  - name: controller
    securityContext:
      allowPrivilegeEscalation: false
      capabilities:
        drop:
        - ALL
      readOnlyRootFilesystem: true
```

## 📈 Monitoring

### Prometheus Metrics
The controller exposes metrics on port 8080:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: node-optimizer-metrics
spec:
  selector:
    app: node-optimizer
  ports:
  - port: 8080
    name: metrics
```

### Key Metrics:
- `optimizer_nodes_total`: Total number of nodes
- `optimizer_workloads_total`: Total workloads analyzed
- `optimizer_savings_potential`: Estimated monthly savings
- `optimizer_migrations_pending`: Pending migrations
- `optimizer_migrations_completed`: Completed migrations

## 🔄 Upgrade Process

### Helm Upgrade
```bash
helm upgrade node-optimizer node-optimizer/node-optimizer \
  --namespace node-optimizer \
  --reuse-values
```

### Manual Upgrade
```bash
# 1. Update CRDs
kubectl apply -f k8s-controller/crds/optimizer-crds.yaml

# 2. Update deployment
kubectl set image deployment/node-optimizer-controller \
  controller=node-optimizer:v1.1.0 \
  -n node-optimizer
```

## 🧹 Uninstall

### Helm
```bash
helm uninstall node-optimizer -n node-optimizer
```

### Manual
```bash
kubectl delete -f k8s-controller/deploy/operator.yaml
kubectl delete -f k8s-controller/crds/optimizer-crds.yaml
kubectl delete namespace node-optimizer
```

## 🆘 Troubleshooting

### Controller Not Starting
```bash
kubectl logs -n node-optimizer deployment/node-optimizer-controller
kubectl describe pod -n node-optimizer -l app=node-optimizer
```

### Metrics Server Required
```bash
# Check if metrics server is installed
kubectl top nodes

# If not, install it:
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
```

### No Recommendations Generated
1. Check if workloads exist in target namespaces
2. Verify metrics are available
3. Check controller logs for errors
4. Ensure sufficient data collection time (30 minutes)

## 🎯 Best Practices

1. **Start with OBSERVE mode** in production
2. **Test in staging** before production
3. **Monitor metrics** after migrations
4. **Set up alerts** for failed migrations
5. **Review reports weekly** for optimization opportunities
6. **Gradually increase automation** as confidence builds

## 📚 Next Steps

1. Review optimization reports
2. Adjust safety thresholds based on your risk tolerance
3. Configure notifications for your team
4. Set up monitoring dashboards
5. Schedule regular reviews of savings achieved