export class ResourceAnalyzer {
  constructor() {
    this.nodes = [];
    this.workloads = [];
  }

  addNode(node) {
    this.nodes.push({
      id: node.id,
      name: node.name,
      cpu: {
        total: node.cpu.total,
        used: node.cpu.used || 0,
        allocated: node.cpu.allocated || 0
      },
      memory: {
        total: node.memory.total,
        used: node.memory.used || 0,
        allocated: node.memory.allocated || 0
      },
      workloads: []
    });
  }

  addWorkload(workload) {
    this.workloads.push({
      id: workload.id,
      name: workload.name,
      nodeId: workload.nodeId,
      cpu: {
        limit: workload.cpu.limit,
        request: workload.cpu.request || workload.cpu.limit * 0.5,
        usage: workload.cpu.usage
      },
      memory: {
        limit: workload.memory.limit,
        request: workload.memory.request || workload.memory.limit * 0.5,
        usage: workload.memory.usage
      }
    });

    const node = this.nodes.find(n => n.id === workload.nodeId);
    if (node) {
      node.workloads.push(workload.id);
      node.cpu.used += workload.cpu.usage;
      node.cpu.allocated += workload.cpu.limit;
      node.memory.used += workload.memory.usage;
      node.memory.allocated += workload.memory.limit;
    }
  }

  analyzeUtilization() {
    const analysis = {
      nodes: [],
      overallStats: {
        totalCpu: 0,
        usedCpu: 0,
        allocatedCpu: 0,
        totalMemory: 0,
        usedMemory: 0,
        allocatedMemory: 0
      }
    };

    for (const node of this.nodes) {
      const nodeAnalysis = {
        id: node.id,
        name: node.name,
        cpu: {
          total: node.cpu.total,
          used: node.cpu.used,
          allocated: node.cpu.allocated,
          utilization: (node.cpu.used / node.cpu.total * 100).toFixed(2),
          allocationRatio: (node.cpu.allocated / node.cpu.total * 100).toFixed(2),
          wastedRatio: ((node.cpu.allocated - node.cpu.used) / node.cpu.total * 100).toFixed(2)
        },
        memory: {
          total: node.memory.total,
          used: node.memory.used,
          allocated: node.memory.allocated,
          utilization: (node.memory.used / node.memory.total * 100).toFixed(2),
          allocationRatio: (node.memory.allocated / node.memory.total * 100).toFixed(2),
          wastedRatio: ((node.memory.allocated - node.memory.used) / node.memory.total * 100).toFixed(2)
        },
        workloadCount: node.workloads.length,
        efficiency: this.calculateEfficiency(node)
      };

      analysis.nodes.push(nodeAnalysis);

      analysis.overallStats.totalCpu += node.cpu.total;
      analysis.overallStats.usedCpu += node.cpu.used;
      analysis.overallStats.allocatedCpu += node.cpu.allocated;
      analysis.overallStats.totalMemory += node.memory.total;
      analysis.overallStats.usedMemory += node.memory.used;
      analysis.overallStats.allocatedMemory += node.memory.allocated;
    }

    analysis.overallStats.cpuUtilization = (analysis.overallStats.usedCpu / analysis.overallStats.totalCpu * 100).toFixed(2);
    analysis.overallStats.memoryUtilization = (analysis.overallStats.usedMemory / analysis.overallStats.totalMemory * 100).toFixed(2);
    analysis.overallStats.cpuAllocationRatio = (analysis.overallStats.allocatedCpu / analysis.overallStats.totalCpu * 100).toFixed(2);
    analysis.overallStats.memoryAllocationRatio = (analysis.overallStats.allocatedMemory / analysis.overallStats.totalMemory * 100).toFixed(2);

    return analysis;
  }

  calculateEfficiency(node) {
    const cpuEfficiency = node.cpu.allocated > 0 ? (node.cpu.used / node.cpu.allocated * 100) : 0;
    const memoryEfficiency = node.memory.allocated > 0 ? (node.memory.used / node.memory.allocated * 100) : 0;
    return ((cpuEfficiency + memoryEfficiency) / 2).toFixed(2);
  }

  identifyOverprovisionedWorkloads() {
    const overprovisionedWorkloads = [];

    for (const workload of this.workloads) {
      const cpuUsageRatio = (workload.cpu.usage / workload.cpu.limit * 100);
      const memoryUsageRatio = (workload.memory.usage / workload.memory.limit * 100);

      if (cpuUsageRatio < 30 || memoryUsageRatio < 30) {
        overprovisionedWorkloads.push({
          id: workload.id,
          name: workload.name,
          nodeId: workload.nodeId,
          cpu: {
            limit: workload.cpu.limit,
            usage: workload.cpu.usage,
            usageRatio: cpuUsageRatio.toFixed(2),
            recommendedLimit: Math.max(workload.cpu.usage * 1.5, 0.1)
          },
          memory: {
            limit: workload.memory.limit,
            usage: workload.memory.usage,
            usageRatio: memoryUsageRatio.toFixed(2),
            recommendedLimit: Math.max(workload.memory.usage * 1.5, 128)
          }
        });
      }
    }

    return overprovisionedWorkloads;
  }
}