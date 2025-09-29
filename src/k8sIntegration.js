import { exec } from 'child_process';
import { promisify } from 'util';
import { ResourceAnalyzer } from './resourceAnalyzer.js';

const execAsync = promisify(exec);

export class K8sIntegration {
  constructor() {
    this.analyzer = new ResourceAnalyzer();
  }

  async checkKubectl() {
    try {
      await execAsync('kubectl version --client');
      return true;
    } catch (error) {
      console.error('kubectl not found. Please install kubectl and configure it to connect to your cluster.');
      return false;
    }
  }

  async collectFromCluster() {
    const hasKubectl = await this.checkKubectl();
    if (!hasKubectl) {
      throw new Error('kubectl is not available');
    }

    console.log('Collecting data from Kubernetes cluster...');

    const nodes = await this.getNodes();
    const pods = await this.getPods();
    const metrics = await this.getMetrics();

    for (const node of nodes) {
      this.analyzer.addNode(node);
    }

    for (const pod of pods) {
      this.analyzer.addWorkload(pod);
    }

    return this.analyzer;
  }

  async getNodes() {
    try {
      const { stdout: nodesJson } = await execAsync('kubectl get nodes -o json');
      const nodesData = JSON.parse(nodesJson);

      const { stdout: topOutput } = await execAsync('kubectl top nodes --no-headers');
      const topLines = topOutput.trim().split('\n');

      const topMetrics = {};
      topLines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const name = parts[0];
          const cpuUsage = this.parseCpu(parts[1]);
          const memoryUsage = this.parseMemory(parts[3]);
          topMetrics[name] = { cpu: cpuUsage, memory: memoryUsage };
        }
      });

      return nodesData.items.map(node => {
        const name = node.metadata.name;
        const capacity = node.status.capacity;
        const allocatable = node.status.allocatable;
        const metrics = topMetrics[name] || { cpu: 0, memory: 0 };

        return {
          id: name,
          name: name,
          cpu: {
            total: this.parseCpu(allocatable.cpu),
            used: metrics.cpu,
            allocated: 0
          },
          memory: {
            total: this.parseMemory(allocatable.memory),
            used: metrics.memory,
            allocated: 0
          }
        };
      });
    } catch (error) {
      console.error('Error getting nodes:', error);
      return [];
    }
  }

  async getPods() {
    try {
      const { stdout: podsJson } = await execAsync('kubectl get pods --all-namespaces -o json');
      const podsData = JSON.parse(podsJson);

      const { stdout: topOutput } = await execAsync('kubectl top pods --all-namespaces --no-headers --containers');
      const topLines = topOutput.trim().split('\n');

      const topMetrics = {};
      topLines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          const namespace = parts[0];
          const podName = parts[1];
          const key = `${namespace}/${podName}`;

          if (!topMetrics[key]) {
            topMetrics[key] = { cpu: 0, memory: 0 };
          }

          topMetrics[key].cpu += this.parseCpu(parts[3]);
          topMetrics[key].memory += this.parseMemory(parts[4]);
        }
      });

      return podsData.items
        .filter(pod =>
          pod.status.phase === 'Running' &&
          !['kube-system', 'kube-public', 'kube-node-lease'].includes(pod.metadata.namespace)
        )
        .map(pod => {
          const namespace = pod.metadata.namespace;
          const name = pod.metadata.name;
          const key = `${namespace}/${name}`;
          const metrics = topMetrics[key] || { cpu: 0, memory: 0 };

          let cpuLimits = 0;
          let memoryLimits = 0;
          let cpuRequests = 0;
          let memoryRequests = 0;

          pod.spec.containers.forEach(container => {
            if (container.resources) {
              if (container.resources.limits) {
                cpuLimits += this.parseCpu(container.resources.limits.cpu || '1');
                memoryLimits += this.parseMemory(container.resources.limits.memory || '1Gi');
              } else {
                cpuLimits += 1;
                memoryLimits += 1024;
              }
              if (container.resources.requests) {
                cpuRequests += this.parseCpu(container.resources.requests.cpu || '0.1');
                memoryRequests += this.parseMemory(container.resources.requests.memory || '128Mi');
              } else {
                cpuRequests += 0.1;
                memoryRequests += 128;
              }
            } else {
              cpuLimits += 1;
              memoryLimits += 1024;
              cpuRequests += 0.1;
              memoryRequests += 128;
            }
          });

          return {
            id: pod.metadata.uid,
            name: `${namespace}/${name}`,
            nodeId: pod.spec.nodeName,
            namespace: namespace,
            cpu: {
              limit: cpuLimits,
              request: cpuRequests,
              usage: metrics.cpu
            },
            memory: {
              limit: memoryLimits,
              request: memoryRequests,
              usage: metrics.memory
            }
          };
        });
    } catch (error) {
      console.error('Error getting pods:', error);
      return [];
    }
  }

  async getMetrics() {
    try {
      const { stdout } = await execAsync('kubectl top nodes --no-headers && kubectl top pods --all-namespaces --no-headers');
      return stdout;
    } catch (error) {
      console.error('Metrics Server not available. Install it with:');
      console.error('kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml');
      return '';
    }
  }

  parseCpu(cpu) {
    if (!cpu) return 0;
    cpu = String(cpu);

    if (cpu.endsWith('m')) {
      return parseFloat(cpu.slice(0, -1)) / 1000;
    } else if (cpu.endsWith('n')) {
      return parseFloat(cpu.slice(0, -1)) / 1000000000;
    } else {
      return parseFloat(cpu) || 0;
    }
  }

  parseMemory(memory) {
    if (!memory) return 0;
    memory = String(memory);

    const units = {
      'Ki': 1,
      'Mi': 1024,
      'Gi': 1024 * 1024,
      'Ti': 1024 * 1024 * 1024,
      'K': 1000 / 1024,
      'M': 1000 * 1000 / (1024 * 1024),
      'G': 1000 * 1000 * 1000 / (1024 * 1024)
    };

    for (const [unit, multiplier] of Object.entries(units)) {
      if (memory.endsWith(unit)) {
        return parseFloat(memory.slice(0, -unit.length)) * multiplier || 0;
      }
    }

    return parseFloat(memory) / (1024 * 1024) || 0;
  }

  async generateYamlRecommendations(recommendations) {
    const yamlPatches = [];

    for (const rec of recommendations) {
      const [namespace, podName] = rec.name.split('/');

      const { stdout } = await execAsync(
        `kubectl get pod ${podName} -n ${namespace} -o jsonpath='{.metadata.ownerReferences[0].kind},{.metadata.ownerReferences[0].name}'`
      );

      const [ownerKind, ownerName] = stdout.split(',');

      if (ownerKind === 'ReplicaSet') {
        const { stdout: rsOut } = await execAsync(
          `kubectl get rs ${ownerName} -n ${namespace} -o jsonpath='{.metadata.ownerReferences[0].kind},{.metadata.ownerReferences[0].name}'`
        );
        const [deployKind, deployName] = rsOut.split(',');

        if (deployKind === 'Deployment') {
          const patch = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deployName}
  namespace: ${namespace}
spec:
  template:
    spec:
      containers:
      - name: <container-name>
        resources:
          requests:
            cpu: "${Math.round(rec.suggestedLimits.cpu * 500)}m"
            memory: "${Math.round(rec.suggestedLimits.memory * 0.8)}Mi"
          limits:
            cpu: "${Math.round(rec.suggestedLimits.cpu * 1000)}m"
            memory: "${Math.round(rec.suggestedLimits.memory)}Mi"`;

          yamlPatches.push({
            kind: 'Deployment',
            name: deployName,
            namespace: namespace,
            patch: patch
          });
        }
      }
    }

    return yamlPatches;
  }

  async applyRecommendation(recommendation, dryRun = true) {
    if (!recommendation.patch) return;

    const filename = `/tmp/patch-${recommendation.name}.yaml`;
    const fs = await import('fs/promises');
    await fs.writeFile(filename, recommendation.patch);

    const dryRunFlag = dryRun ? '--dry-run=client' : '';

    try {
      const { stdout, stderr } = await execAsync(
        `kubectl patch ${recommendation.kind.toLowerCase()} ${recommendation.name} -n ${recommendation.namespace} --patch-file=${filename} ${dryRunFlag}`
      );

      console.log(dryRun ? 'DRY RUN - Would apply:' : 'Applied:');
      console.log(stdout);

      if (stderr) {
        console.error('Warning:', stderr);
      }
    } catch (error) {
      console.error(`Failed to apply patch for ${recommendation.name}:`, error.message);
    }

    await fs.unlink(filename);
  }
}