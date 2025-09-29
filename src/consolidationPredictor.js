export class ConsolidationPredictor {
  constructor(analyzer) {
    this.analyzer = analyzer;
    this.safetyMargin = 0.15; // 15% safety margin for consolidation
  }

  canConsolidate() {
    const analysis = this.analyzer.analyzeUtilization();
    const consolidationPlan = {
      feasible: false,
      currentNodes: this.analyzer.nodes.length,
      requiredNodes: 0,
      savings: {},
      plan: [],
      warnings: [],
      recommendations: []
    };

    const totalRequiredCpu = this.analyzer.workloads.reduce((sum, w) => sum + w.cpu.usage, 0);
    const totalRequiredMemory = this.analyzer.workloads.reduce((sum, w) => sum + w.memory.usage, 0);

    const totalAvailableCpu = this.analyzer.nodes.reduce((sum, n) => sum + n.cpu.total, 0);
    const totalAvailableMemory = this.analyzer.nodes.reduce((sum, n) => sum + n.memory.total, 0);

    const cpuWithMargin = totalRequiredCpu * (1 + this.safetyMargin);
    const memoryWithMargin = totalRequiredMemory * (1 + this.safetyMargin);

    const sortedNodes = [...this.analyzer.nodes].sort((a, b) => {
      const effA = (a.cpu.total + a.memory.total);
      const effB = (b.cpu.total + b.memory.total);
      return effB - effA;
    });

    let nodesNeeded = 0;
    let remainingCpu = cpuWithMargin;
    let remainingMemory = memoryWithMargin;

    for (const node of sortedNodes) {
      if (remainingCpu > 0 || remainingMemory > 0) {
        nodesNeeded++;
        remainingCpu -= node.cpu.total;
        remainingMemory -= node.memory.total;

        consolidationPlan.plan.push({
          nodeId: node.id,
          nodeName: node.name,
          allocatedCpu: Math.min(cpuWithMargin, node.cpu.total),
          allocatedMemory: Math.min(memoryWithMargin, node.memory.total)
        });
      }
    }

    consolidationPlan.requiredNodes = nodesNeeded;
    consolidationPlan.feasible = nodesNeeded < this.analyzer.nodes.length;

    if (consolidationPlan.feasible) {
      const nodesSaved = this.analyzer.nodes.length - nodesNeeded;
      consolidationPlan.savings = {
        nodeReduction: nodesSaved,
        percentReduction: (nodesSaved / this.analyzer.nodes.length * 100).toFixed(2),
        cpuSaved: sortedNodes.slice(nodesNeeded).reduce((sum, n) => sum + n.cpu.total, 0),
        memorySaved: sortedNodes.slice(nodesNeeded).reduce((sum, n) => sum + n.memory.total, 0)
      };

      consolidationPlan.recommendations.push(
        `Can consolidate from ${this.analyzer.nodes.length} nodes to ${nodesNeeded} nodes`,
        `This would save ${consolidationPlan.savings.percentReduction}% of infrastructure`,
        `CPU utilization would increase from ${analysis.overallStats.cpuUtilization}% to ${(totalRequiredCpu / (nodesNeeded * sortedNodes[0].cpu.total) * 100).toFixed(2)}%`
      );
    }

    this.checkForRisks(consolidationPlan, analysis);

    return consolidationPlan;
  }

  checkForRisks(consolidationPlan, analysis) {
    for (const node of analysis.nodes) {
      if (parseFloat(node.cpu.allocationRatio) > 100) {
        consolidationPlan.warnings.push(`Node ${node.name} has CPU over-allocation (${node.cpu.allocationRatio}%)`);
      }
      if (parseFloat(node.memory.allocationRatio) > 100) {
        consolidationPlan.warnings.push(`Node ${node.name} has Memory over-allocation (${node.memory.allocationRatio}%)`);
      }
    }

    if (consolidationPlan.requiredNodes === 1) {
      consolidationPlan.warnings.push("Single node consolidation creates a single point of failure");
    }

    const highUtilizationWorkloads = this.analyzer.workloads.filter(w => {
      const cpuUsage = (w.cpu.usage / w.cpu.limit * 100);
      const memUsage = (w.memory.usage / w.memory.limit * 100);
      return cpuUsage > 80 || memUsage > 80;
    });

    if (highUtilizationWorkloads.length > 0) {
      consolidationPlan.warnings.push(`${highUtilizationWorkloads.length} workloads are running at high utilization (>80%)`);
    }
  }

  generateMigrationPlan() {
    const consolidationPlan = this.canConsolidate();
    if (!consolidationPlan.feasible) {
      return null;
    }

    const migrationSteps = [];
    const targetNodes = consolidationPlan.plan;
    const workloadsByNode = {};

    for (const workload of this.analyzer.workloads) {
      if (!workloadsByNode[workload.nodeId]) {
        workloadsByNode[workload.nodeId] = [];
      }
      workloadsByNode[workload.nodeId].push(workload);
    }

    let targetNodeIndex = 0;
    let currentTargetNode = targetNodes[targetNodeIndex];
    let availableCpu = currentTargetNode.allocatedCpu;
    let availableMemory = currentTargetNode.allocatedMemory;

    for (const [sourceNodeId, workloads] of Object.entries(workloadsByNode)) {
      for (const workload of workloads) {
        if (workload.cpu.usage > availableCpu || workload.memory.usage > availableMemory) {
          targetNodeIndex++;
          if (targetNodeIndex >= targetNodes.length) break;
          currentTargetNode = targetNodes[targetNodeIndex];
          availableCpu = currentTargetNode.allocatedCpu;
          availableMemory = currentTargetNode.allocatedMemory;
        }

        if (sourceNodeId !== currentTargetNode.nodeId) {
          migrationSteps.push({
            workloadId: workload.id,
            workloadName: workload.name,
            fromNode: sourceNodeId,
            toNode: currentTargetNode.nodeId,
            toNodeName: currentTargetNode.nodeName,
            resourceRequirements: {
              cpu: workload.cpu.usage,
              memory: workload.memory.usage
            }
          });
        }

        availableCpu -= workload.cpu.usage;
        availableMemory -= workload.memory.usage;
      }
    }

    return {
      ...consolidationPlan,
      migrationSteps,
      totalMigrations: migrationSteps.length
    };
  }
}