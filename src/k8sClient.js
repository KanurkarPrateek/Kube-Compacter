import k8s from '@kubernetes/client-node';
import { ResourceAnalyzer } from './resourceAnalyzer.js';

export class K8sResourceCollector {
  constructor() {
    this.kc = new k8s.KubeConfig();
    try {
      this.kc.loadFromDefault();
    } catch (err) {
      console.log('Failed to load from default, trying in-cluster config...');
      this.kc.loadFromCluster();
    }

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.metricsApi = this.kc.makeApiClient(k8s.MetricsV1beta1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
  }

  async collectClusterResources() {
    const analyzer = new ResourceAnalyzer();

    try {
      const nodes = await this.getNodesWithMetrics();
      const pods = await this.getPodsWithMetrics();

      for (const node of nodes) {
        analyzer.addNode(node);
      }

      for (const pod of pods) {
        analyzer.addWorkload(pod);
      }

      return analyzer;
    } catch (error) {
      console.error('Error collecting cluster resources:', error);
      throw error;
    }
  }

  async getNodesWithMetrics() {
    const nodesResponse = await this.k8sApi.listNode();
    const nodes = nodesResponse.body.items;

    const nodeMetricsResponse = await this.metricsApi.listNodeMetrics();
    const nodeMetrics = nodeMetricsResponse.body.items;

    const metricsMap = new Map();
    nodeMetrics.forEach(metric => {
      metricsMap.set(metric.metadata.name, metric);
    });

    return nodes.map(node => {
      const nodeName = node.metadata.name;
      const metrics = metricsMap.get(nodeName);

      const allocatable = node.status.allocatable;
      const capacity = node.status.capacity;

      const cpuCapacity = this.parseCpu(capacity.cpu);
      const memoryCapacity = this.parseMemory(capacity.memory);

      let cpuUsage = 0;
      let memoryUsage = 0;

      if (metrics) {
        cpuUsage = this.parseCpu(metrics.usage.cpu);
        memoryUsage = this.parseMemory(metrics.usage.memory);
      }

      return {
        id: nodeName,
        name: nodeName,
        cpu: {
          total: cpuCapacity,
          used: cpuUsage,
          allocated: 0
        },
        memory: {
          total: memoryCapacity,
          used: memoryUsage,
          allocated: 0
        },
        labels: node.metadata.labels,
        taints: node.spec.taints || []
      };
    });
  }

  async getPodsWithMetrics() {
    const podsResponse = await this.k8sApi.listPodForAllNamespaces();
    const pods = podsResponse.body.items.filter(pod =>
      pod.status.phase === 'Running' &&
      !pod.metadata.namespace.includes('kube-system')
    );

    const podMetricsResponse = await this.metricsApi.listPodMetricsForAllNamespaces();
    const podMetrics = podMetricsResponse.body.items;

    const metricsMap = new Map();
    podMetrics.forEach(metric => {
      const key = `${metric.metadata.namespace}/${metric.metadata.name}`;
      metricsMap.set(key, metric);
    });

    return pods.map(pod => {
      const podKey = `${pod.metadata.namespace}/${pod.metadata.name}`;
      const metrics = metricsMap.get(podKey);

      let totalCpuLimit = 0;
      let totalMemoryLimit = 0;
      let totalCpuRequest = 0;
      let totalMemoryRequest = 0;
      let totalCpuUsage = 0;
      let totalMemoryUsage = 0;

      pod.spec.containers.forEach((container, index) => {
        if (container.resources) {
          if (container.resources.limits) {
            totalCpuLimit += this.parseCpu(container.resources.limits.cpu || '0');
            totalMemoryLimit += this.parseMemory(container.resources.limits.memory || '0');
          }
          if (container.resources.requests) {
            totalCpuRequest += this.parseCpu(container.resources.requests.cpu || '0');
            totalMemoryRequest += this.parseMemory(container.resources.requests.memory || '0');
          }
        }

        if (metrics && metrics.containers[index]) {
          totalCpuUsage += this.parseCpu(metrics.containers[index].usage.cpu || '0');
          totalMemoryUsage += this.parseMemory(metrics.containers[index].usage.memory || '0');
        }
      });

      return {
        id: pod.metadata.uid,
        name: `${pod.metadata.namespace}/${pod.metadata.name}`,
        nodeId: pod.spec.nodeName,
        namespace: pod.metadata.namespace,
        cpu: {
          limit: totalCpuLimit || 1,
          request: totalCpuRequest || 0.5,
          usage: totalCpuUsage
        },
        memory: {
          limit: totalMemoryLimit || 1024,
          request: totalMemoryRequest || 512,
          usage: totalMemoryUsage
        },
        labels: pod.metadata.labels,
        owner: this.getOwnerInfo(pod)
      };
    });
  }

  getOwnerInfo(pod) {
    if (pod.metadata.ownerReferences && pod.metadata.ownerReferences.length > 0) {
      const owner = pod.metadata.ownerReferences[0];
      return {
        kind: owner.kind,
        name: owner.name
      };
    }
    return null;
  }

  parseCpu(cpu) {
    if (!cpu) return 0;
    cpu = String(cpu);

    if (cpu.endsWith('m')) {
      return parseFloat(cpu.slice(0, -1)) / 1000;
    } else if (cpu.endsWith('n')) {
      return parseFloat(cpu.slice(0, -1)) / 1000000000;
    } else {
      return parseFloat(cpu);
    }
  }

  parseMemory(memory) {
    if (!memory) return 0;
    memory = String(memory);

    const units = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'K': 1000,
      'M': 1000 * 1000,
      'G': 1000 * 1000 * 1000
    };

    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseFloat(memory.slice(0, -unit.length)) * multiplier / (1024 * 1024);
      }
    }

    return parseFloat(memory) / (1024 * 1024);
  }

  async applyRecommendations(recommendations, dryRun = true) {
    const patches = [];

    for (const recommendation of recommendations) {
      if (recommendation.owner && recommendation.owner.kind === 'Deployment') {
        const patch = {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: {
            name: recommendation.owner.name,
            namespace: recommendation.namespace
          },
          spec: {
            template: {
              spec: {
                containers: [{
                  name: recommendation.containerName,
                  resources: {
                    limits: {
                      cpu: `${Math.ceil(recommendation.suggestedLimits.cpu * 1000)}m`,
                      memory: `${Math.ceil(recommendation.suggestedLimits.memory)}Mi`
                    },
                    requests: {
                      cpu: `${Math.ceil(recommendation.suggestedLimits.cpu * 500)}m`,
                      memory: `${Math.ceil(recommendation.suggestedLimits.memory * 0.8)}Mi`
                    }
                  }
                }]
              }
            }
          }
        };

        patches.push(patch);

        if (!dryRun) {
          try {
            await this.appsApi.patchNamespacedDeployment(
              recommendation.owner.name,
              recommendation.namespace,
              patch,
              undefined,
              undefined,
              undefined,
              undefined,
              { headers: { 'Content-Type': 'application/strategic-merge-patch+json' } }
            );
            console.log(`Updated deployment ${recommendation.owner.name} in namespace ${recommendation.namespace}`);
          } catch (error) {
            console.error(`Failed to update deployment ${recommendation.owner.name}:`, error);
          }
        }
      }
    }

    return patches;
  }
}