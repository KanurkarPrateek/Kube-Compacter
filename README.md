# 🗜️ Kube-Compactor

[![Documentation](https://img.shields.io/badge/docs-GitHub%20Pages-blue)](https://kanurkarprateek.github.io/Kube-Compacter/)
[![Docker Pulls](https://img.shields.io/docker/pulls/kanurkarprateek/kube-compactor)](https://hub.docker.com/r/kanurkarprateek/kube-compactor)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Kubernetes](https://img.shields.io/badge/kubernetes-%3E%3D1.19-success)](https://kubernetes.io/)

> **Intelligent Kubernetes workload consolidation through advanced bin-packing algorithms**

Reduce your Kubernetes infrastructure costs by 30-70% through intelligent workload placement and node consolidation.

## 📚 Documentation

**Full documentation is available at: https://kanurkarprateek.github.io/Kube-Compacter/**

## 🚀 Quick Start

Deploy Kube-Compactor in your cluster (safe observe mode by default):

```bash
kubectl apply -f https://raw.githubusercontent.com/KanurkarPrateek/Kube-Compacter/main/k8s-controller/deploy/quick-start.yaml
```

## 🐳 Docker Image

```bash
docker pull kanurkarprateek/kube-compactor:latest
```

## ✨ Key Features

- **🧮 Advanced Bin-Packing**: Multiple algorithms (FFD, BFD, Network-aware, Affinity-based)
- **📊 Real-time Analysis**: Continuous monitoring and optimization recommendations
- **🔒 Safety First**: Multiple operation modes from observe-only to semi-automated
- **💰 Cost Savings**: Typically 30-70% reduction in node usage
- **🔄 Smart Migration**: Respects PDBs, affinity rules, and maintenance windows
- **📈 Graph-Based Optimization**: Analyzes service communication patterns

## 📊 How It Works

```
Before Kube-Compactor:
Node-1: [█████░░░░░] 50% used
Node-2: [███░░░░░░░] 30% used
Node-3: [██░░░░░░░░] 20% used
Cost: $3000/month

After Kube-Compactor:
Node-1: [█████████░] 90% used
Node-2: [EMPTY - Removed]
Node-3: [EMPTY - Removed]
Cost: $1000/month (66% savings!)
```

## 🎮 Operation Modes

| Mode | Description | Risk | Use Case |
|------|-------------|------|----------|
| **Observe** | Analysis only, no actions | None | Initial evaluation |
| **Manual** | Requires approval for each action | Low | Production |
| **Semi-Auto** | Auto-executes safe operations | Medium | Staging/Dev |
| **Full-Auto** | Fully automated | High | Testing only |

## 🏗️ Architecture

Kube-Compactor uses advanced algorithms to optimize workload placement:

- **Bin-Packing Engine**: Implements FFD, BFD, and custom strategies
- **Network-Aware Placement**: Co-locates communicating services
- **Graph-Based Analysis**: Uses spectral clustering for optimal grouping
- **Safe Migration Orchestrator**: Ensures zero-downtime migrations

## 📈 Real-World Results

| Company | Before | After | Savings |
|---------|--------|-------|---------|
| StartupCo | 10 nodes | 4 nodes | 60% / $3,000/mo |
| EnterpriseCorp | 50 nodes | 22 nodes | 56% / $28,000/mo |
| ScaleUpInc | 25 nodes | 12 nodes | 52% / $11,500/mo |

## 🛠️ Installation Options

### Helm (Recommended)
```bash
helm repo add kube-compactor https://kanurkarprateek.github.io/Kube-Compacter
helm install kube-compactor kube-compactor/kube-compactor
```

### Direct YAML
```bash
kubectl apply -f k8s-controller/deploy/quick-start.yaml
```

### Docker CLI
```bash
docker run -v ~/.kube/config:/home/nodejs/.kube/config:ro \
  kanurkarprateek/kube-compactor:latest analyze --cluster
```

## 📖 Documentation

Comprehensive documentation is available at our GitHub Pages site:

**📚 https://kanurkarprateek.github.io/Kube-Compacter/**

Including:
- Getting Started Guide
- Architecture Deep Dive
- Configuration Reference
- API Documentation
- Best Practices

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## 📝 License

Apache License 2.0 - See [LICENSE](LICENSE) for details.

## 🙏 Support

- **📚 Documentation**: https://kanurkarprateek.github.io/Kube-Compacter/
- **🐛 Issues**: [GitHub Issues](https://github.com/KanurkarPrateek/Kube-Compacter/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/KanurkarPrateek/Kube-Compacter/discussions)

---

<p align="center">
  <b>🗜️ Compact your cluster. Slash your costs. Keep control. 🗜️</b>
</p>