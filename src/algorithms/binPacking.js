export class BinPackingOptimizer {
  constructor() {
    this.strategies = {
      FIRST_FIT_DECREASING: 'ffd',
      BEST_FIT_DECREASING: 'bfd',
      WORST_FIT_DECREASING: 'wfd',
      NETWORK_AWARE: 'network',
      AFFINITY_BASED: 'affinity'
    };
  }

  optimizePlacement(workloads, nodes, strategy = 'ffd', constraints = {}) {
    const sortedWorkloads = this.sortWorkloads(workloads, strategy);
    const placement = {
      assignments: new Map(),
      unplaceable: [],
      efficiency: 0,
      migrations: []
    };

    for (const workload of sortedWorkloads) {
      const targetNode = this.findBestNode(workload, nodes, strategy, constraints);

      if (targetNode) {
        this.placeWorkload(workload, targetNode, placement);
      } else {
        placement.unplaceable.push(workload);
      }
    }

    placement.efficiency = this.calculateEfficiency(nodes);
    placement.migrations = this.generateMigrationPlan(workloads, placement.assignments);

    return placement;
  }

  sortWorkloads(workloads, strategy) {
    const sorted = [...workloads];

    switch (strategy) {
      case 'ffd':
      case 'bfd':
        sorted.sort((a, b) => {
          const scoreA = a.cpu.usage + (a.memory.usage / 1024);
          const scoreB = b.cpu.usage + (b.memory.usage / 1024);
          return scoreB - scoreA;
        });
        break;

      case 'network':
        sorted.sort((a, b) => {
          const networkA = a.networkIntensity || 0;
          const networkB = b.networkIntensity || 0;
          return networkB - networkA;
        });
        break;

      case 'affinity':
        // Group by affinity labels first
        const groups = this.groupByAffinity(sorted);
        return this.flattenGroups(groups);
    }

    return sorted;
  }

  findBestNode(workload, nodes, strategy, constraints) {
    const eligibleNodes = nodes.filter(node =>
      this.meetsConstraints(workload, node, constraints) &&
      this.hasCapacity(workload, node)
    );

    if (eligibleNodes.length === 0) return null;

    switch (strategy) {
      case 'ffd':
        return eligibleNodes[0];

      case 'bfd':
        return eligibleNodes.reduce((best, node) => {
          const bestFit = this.calculateFit(workload, best);
          const nodeFit = this.calculateFit(workload, node);
          return nodeFit < bestFit ? node : best;
        });

      case 'wfd':
        return eligibleNodes.reduce((worst, node) => {
          const worstFit = this.calculateFit(workload, worst);
          const nodeFit = this.calculateFit(workload, node);
          return nodeFit > worstFit ? node : worst;
        });

      case 'network':
        return this.findNetworkOptimalNode(workload, eligibleNodes);

      case 'affinity':
        return this.findAffinityOptimalNode(workload, eligibleNodes);

      default:
        return eligibleNodes[0];
    }
  }

  calculateFit(workload, node) {
    const cpuFit = (node.cpu.total - node.cpu.used - workload.cpu.usage) / node.cpu.total;
    const memoryFit = (node.memory.total - node.memory.used - workload.memory.usage) / node.memory.total;
    return (cpuFit + memoryFit) / 2;
  }

  hasCapacity(workload, node) {
    const availableCpu = node.cpu.total - node.cpu.used;
    const availableMemory = node.memory.total - node.memory.used;

    return availableCpu >= workload.cpu.usage * 1.1 &&
           availableMemory >= workload.memory.usage * 1.1;
  }

  meetsConstraints(workload, node, constraints) {
    if (constraints.nodeSelector && workload.nodeSelector) {
      for (const [key, value] of Object.entries(workload.nodeSelector)) {
        if (node.labels[key] !== value) return false;
      }
    }

    if (constraints.taints && node.taints) {
      for (const taint of node.taints) {
        if (!this.hasToleration(workload, taint)) return false;
      }
    }

    if (constraints.zones && workload.zone) {
      if (node.zone !== workload.zone) return false;
    }

    return true;
  }

  placeWorkload(workload, node, placement) {
    placement.assignments.set(workload.id, node.id);
    node.cpu.used += workload.cpu.usage;
    node.memory.used += workload.memory.usage;

    if (!node.workloads) node.workloads = [];
    node.workloads.push(workload.id);
  }

  generateMigrationPlan(originalWorkloads, newAssignments) {
    const migrations = [];

    for (const workload of originalWorkloads) {
      const currentNode = workload.nodeId;
      const newNode = newAssignments.get(workload.id);

      if (currentNode !== newNode) {
        migrations.push({
          workloadId: workload.id,
          workloadName: workload.name,
          from: currentNode,
          to: newNode,
          reason: this.getMigrationReason(workload, currentNode, newNode)
        });
      }
    }

    return this.optimizeMigrationOrder(migrations);
  }

  optimizeMigrationOrder(migrations) {
    // Sort migrations to minimize disruption
    // 1. Stateless before stateful
    // 2. Small workloads before large
    // 3. Non-critical before critical

    return migrations.sort((a, b) => {
      const priorityA = this.getMigrationPriority(a);
      const priorityB = this.getMigrationPriority(b);
      return priorityA - priorityB;
    });
  }

  getMigrationPriority(migration) {
    let priority = 0;

    if (migration.workloadName.includes('database')) priority += 100;
    if (migration.workloadName.includes('cache')) priority += 50;
    if (migration.workloadName.includes('api')) priority += 75;

    return priority;
  }

  getMigrationReason(workload, fromNode, toNode) {
    const reasons = [];

    if (workload.affinityLabels) {
      reasons.push('Affinity optimization');
    }

    if (workload.networkIntensity > 0.5) {
      reasons.push('Network locality improvement');
    }

    if (!reasons.length) {
      reasons.push('Consolidation for cost savings');
    }

    return reasons.join(', ');
  }

  calculateEfficiency(nodes) {
    let totalUsedCpu = 0;
    let totalCapacityCpu = 0;
    let totalUsedMemory = 0;
    let totalCapacityMemory = 0;
    let activeNodes = 0;

    for (const node of nodes) {
      if (node.cpu.used > 0) {
        activeNodes++;
        totalUsedCpu += node.cpu.used;
        totalUsedMemory += node.memory.used;
      }
      totalCapacityCpu += node.cpu.total;
      totalCapacityMemory += node.memory.total;
    }

    const cpuEfficiency = totalUsedCpu / (activeNodes * (totalCapacityCpu / nodes.length));
    const memoryEfficiency = totalUsedMemory / (activeNodes * (totalCapacityMemory / nodes.length));

    return ((cpuEfficiency + memoryEfficiency) / 2 * 100).toFixed(2);
  }

  groupByAffinity(workloads) {
    const groups = new Map();

    for (const workload of workloads) {
      const affinityKey = workload.affinityGroup || 'default';

      if (!groups.has(affinityKey)) {
        groups.set(affinityKey, []);
      }

      groups.get(affinityKey).push(workload);
    }

    return groups;
  }

  flattenGroups(groups) {
    const flattened = [];

    for (const [key, workloads] of groups) {
      workloads.sort((a, b) => {
        const scoreA = a.cpu.usage + (a.memory.usage / 1024);
        const scoreB = b.cpu.usage + (b.memory.usage / 1024);
        return scoreB - scoreA;
      });

      flattened.push(...workloads);
    }

    return flattened;
  }

  findNetworkOptimalNode(workload, nodes) {
    // Find node with workloads that communicate with this workload
    let bestNode = nodes[0];
    let maxScore = 0;

    for (const node of nodes) {
      let score = 0;

      if (node.workloads) {
        for (const workloadId of node.workloads) {
          if (workload.communicatesWith && workload.communicatesWith.includes(workloadId)) {
            score += 10;
          }
        }
      }

      const capacity = this.calculateFit(workload, node);
      score += capacity * 5;

      if (score > maxScore) {
        maxScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  findAffinityOptimalNode(workload, nodes) {
    let bestNode = nodes[0];
    let maxScore = 0;

    for (const node of nodes) {
      let score = 0;

      if (workload.preferredNodes) {
        for (const [label, value] of Object.entries(workload.preferredNodes)) {
          if (node.labels && node.labels[label] === value) {
            score += 10;
          }
        }
      }

      if (workload.affinityGroup && node.workloads) {
        const sameGroupCount = node.workloads.filter(wId => {
          // Check if workloads in same affinity group
          return true; // Simplified for example
        }).length;
        score += sameGroupCount * 5;
      }

      if (score > maxScore) {
        maxScore = score;
        bestNode = node;
      }
    }

    return bestNode;
  }

  hasToleration(workload, taint) {
    if (!workload.tolerations) return false;

    return workload.tolerations.some(toleration =>
      toleration.key === taint.key &&
      toleration.operator === 'Equal' &&
      toleration.value === taint.value
    );
  }
}