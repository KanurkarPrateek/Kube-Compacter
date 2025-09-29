export class LimitAnalyzer {
  constructor(analyzer) {
    this.analyzer = analyzer;
  }

  analyzeLimitsVsUsage() {
    const report = {
      overProvisionedWorkloads: [],
      underProvisionedWorkloads: [],
      optimizedWorkloads: [],
      recommendations: [],
      potentialSavings: {
        cpu: 0,
        memory: 0
      }
    };

    for (const workload of this.analyzer.workloads) {
      const cpuUsageRatio = (workload.cpu.usage / workload.cpu.limit * 100);
      const memoryUsageRatio = (workload.memory.usage / workload.memory.limit * 100);
      const avgUsageRatio = (cpuUsageRatio + memoryUsageRatio) / 2;

      const workloadAnalysis = {
        id: workload.id,
        name: workload.name,
        nodeId: workload.nodeId,
        cpu: {
          limit: workload.cpu.limit,
          request: workload.cpu.request,
          usage: workload.cpu.usage,
          usageRatio: cpuUsageRatio.toFixed(2),
          status: this.getCpuStatus(cpuUsageRatio)
        },
        memory: {
          limit: workload.memory.limit,
          request: workload.memory.request,
          usage: workload.memory.usage,
          usageRatio: memoryUsageRatio.toFixed(2),
          status: this.getMemoryStatus(memoryUsageRatio)
        }
      };

      if (avgUsageRatio < 30) {
        workloadAnalysis.recommendation = 'HIGHLY OVER-PROVISIONED';
        workloadAnalysis.suggestedLimits = {
          cpu: Math.ceil(workload.cpu.usage * 2),
          memory: Math.ceil(workload.memory.usage * 2)
        };
        workloadAnalysis.potentialSavings = {
          cpu: workload.cpu.limit - workloadAnalysis.suggestedLimits.cpu,
          memory: workload.memory.limit - workloadAnalysis.suggestedLimits.memory
        };
        report.overProvisionedWorkloads.push(workloadAnalysis);
        report.potentialSavings.cpu += workloadAnalysis.potentialSavings.cpu;
        report.potentialSavings.memory += workloadAnalysis.potentialSavings.memory;
      } else if (avgUsageRatio > 80) {
        workloadAnalysis.recommendation = 'UNDER-PROVISIONED';
        workloadAnalysis.suggestedLimits = {
          cpu: Math.ceil(workload.cpu.limit * 1.5),
          memory: Math.ceil(workload.memory.limit * 1.5)
        };
        report.underProvisionedWorkloads.push(workloadAnalysis);
      } else {
        workloadAnalysis.recommendation = 'OPTIMIZED';
        report.optimizedWorkloads.push(workloadAnalysis);
      }
    }

    this.generateRecommendations(report);
    return report;
  }

  getCpuStatus(ratio) {
    if (ratio < 10) return 'SEVERELY UNDERUTILIZED';
    if (ratio < 30) return 'UNDERUTILIZED';
    if (ratio < 70) return 'OPTIMAL';
    if (ratio < 90) return 'HIGH';
    return 'CRITICAL';
  }

  getMemoryStatus(ratio) {
    if (ratio < 20) return 'SEVERELY UNDERUTILIZED';
    if (ratio < 40) return 'UNDERUTILIZED';
    if (ratio < 75) return 'OPTIMAL';
    if (ratio < 90) return 'HIGH';
    return 'CRITICAL';
  }

  generateRecommendations(report) {
    if (report.overProvisionedWorkloads.length > 0) {
      const avgOverProvision = report.overProvisionedWorkloads.reduce((sum, w) => {
        return sum + (parseFloat(w.cpu.usageRatio) + parseFloat(w.memory.usageRatio)) / 2;
      }, 0) / report.overProvisionedWorkloads.length;

      report.recommendations.push({
        type: 'COST_OPTIMIZATION',
        priority: 'HIGH',
        message: `${report.overProvisionedWorkloads.length} workloads are over-provisioned (avg ${avgOverProvision.toFixed(2)}% utilization)`,
        action: 'Reduce limits to save resources',
        potentialSavings: `CPU: ${report.potentialSavings.cpu.toFixed(2)} cores, Memory: ${(report.potentialSavings.memory / 1024).toFixed(2)} GB`
      });
    }

    if (report.underProvisionedWorkloads.length > 0) {
      report.recommendations.push({
        type: 'PERFORMANCE',
        priority: 'CRITICAL',
        message: `${report.underProvisionedWorkloads.length} workloads are under-provisioned and may face performance issues`,
        action: 'Increase limits to prevent throttling and OOM kills'
      });
    }

    const totalWorkloads = this.analyzer.workloads.length;
    const optimizationScore = (report.optimizedWorkloads.length / totalWorkloads * 100).toFixed(2);

    report.recommendations.push({
      type: 'OVERALL',
      priority: 'INFO',
      message: `Resource optimization score: ${optimizationScore}%`,
      action: optimizationScore < 50 ? 'Significant optimization opportunity exists' : 'Resource allocation is reasonably optimized'
    });
  }

  generateRightSizingReport() {
    const analysis = this.analyzeLimitsVsUsage();
    const rightSizingPlan = {
      summary: {
        totalWorkloads: this.analyzer.workloads.length,
        needsRightSizing: analysis.overProvisionedWorkloads.length + analysis.underProvisionedWorkloads.length,
        alreadyOptimized: analysis.optimizedWorkloads.length
      },
      actions: [],
      estimatedMonthlySavings: 0
    };

    for (const workload of analysis.overProvisionedWorkloads) {
      rightSizingPlan.actions.push({
        workloadName: workload.name,
        action: 'REDUCE',
        current: {
          cpu: workload.cpu.limit,
          memory: workload.memory.limit
        },
        recommended: workload.suggestedLimits,
        savings: workload.potentialSavings,
        risk: 'LOW'
      });
    }

    for (const workload of analysis.underProvisionedWorkloads) {
      rightSizingPlan.actions.push({
        workloadName: workload.name,
        action: 'INCREASE',
        current: {
          cpu: workload.cpu.limit,
          memory: workload.memory.limit
        },
        recommended: workload.suggestedLimits,
        risk: 'HIGH - Current performance may be impacted'
      });
    }

    const cpuCostPerCore = 30;
    const memoryCostPerGB = 4;
    rightSizingPlan.estimatedMonthlySavings =
      (analysis.potentialSavings.cpu * cpuCostPerCore) +
      (analysis.potentialSavings.memory / 1024 * memoryCostPerGB);

    return rightSizingPlan;
  }
}