import k8s from '@kubernetes/client-node';
import { ResourceAnalyzer } from '../../src/resourceAnalyzer.js';
import { ConsolidationPredictor } from '../../src/consolidationPredictor.js';
import { BinPackingOptimizer } from '../../src/algorithms/binPacking.js';
import { MigrationController } from '../../src/migrationController.js';

export class OptimizerController {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.kc.loadFromDefault();

    this.k8sApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi);
    this.metricsApi = this.kc.makeApiClient(k8s.MetricsV1beta1Api);

    this.analyzer = new ResourceAnalyzer();
    this.binPacker = new BinPackingOptimizer();
    this.migrationController = new MigrationController();

    this.group = 'optimizer.io';
    this.version = 'v1alpha1';
  }

  async start() {
    console.log('🚀 Starting Optimizer Controller...');

    // Watch for OptimizationConfig changes
    await this.watchOptimizationConfigs();

    // Start reconciliation loop
    setInterval(() => this.reconcile(), 30000); // Every 30 seconds

    console.log('✅ Controller started successfully');
  }

  async watchOptimizationConfigs() {
    const watch = new k8s.Watch(this.kc);
    const watchPath = `/apis/${this.group}/${this.version}/optimizationconfigs`;

    try {
      await watch.watch(
        watchPath,
        {},
        (type, obj) => this.handleConfigChange(type, obj),
        (err) => console.error('Watch error:', err)
      );
    } catch (error) {
      console.error('Failed to setup watch:', error);
    }
  }

  async handleConfigChange(type, config) {
    console.log(`Config ${type}: ${config.metadata.name}`);

    switch (type) {
      case 'ADDED':
      case 'MODIFIED':
        await this.processConfig(config);
        break;
      case 'DELETED':
        console.log(`Config deleted: ${config.metadata.name}`);
        break;
    }
  }

  async processConfig(config) {
    try {
      // Update status to Analyzing
      await this.updateConfigStatus(config.metadata.name, {
        phase: 'Analyzing',
        lastAnalysis: new Date().toISOString()
      });

      // Collect cluster data
      const clusterData = await this.collectClusterData(config.spec);

      // Analyze resources
      const analysis = this.analyzer.analyzeUtilization();

      // Generate consolidation plan
      const consolidationPlan = this.generateConsolidationPlan(clusterData, config.spec);

      // Create optimization report
      const report = await this.createOptimizationReport(config, analysis, consolidationPlan);

      // Handle based on mode
      await this.handleMode(config, consolidationPlan, report);

      // Update status
      await this.updateConfigStatus(config.metadata.name, {
        phase: 'Ready',
        nodeCount: clusterData.nodes.length,
        workloadCount: clusterData.workloads.length,
        potentialSavings: consolidationPlan.savings?.estimatedMonthlySavings || '$0',
        recommendations: consolidationPlan.migrations?.length || 0
      });

    } catch (error) {
      console.error('Error processing config:', error);
      await this.updateConfigStatus(config.metadata.name, {
        phase: 'Error',
        conditions: [{
          type: 'Error',
          status: 'True',
          lastTransitionTime: new Date().toISOString(),
          reason: 'ProcessingFailed',
          message: error.message
        }]
      });
    }
  }

  async collectClusterData(spec) {
    const nodes = [];
    const workloads = [];

    // Get nodes with metrics
    const nodesResponse = await this.k8sApi.listNode();
    const nodeMetricsResponse = await this.metricsApi.listNodeMetrics();

    const metricsMap = new Map();
    nodeMetricsResponse.body.items.forEach(metric => {
      metricsMap.set(metric.metadata.name, metric);
    });

    for (const node of nodesResponse.body.items) {
      const metrics = metricsMap.get(node.metadata.name);
      nodes.push(this.parseNode(node, metrics));
    }

    // Get pods with metrics
    const namespaces = spec.targetNamespaces || ['default'];
    const excludeNamespaces = spec.excludeNamespaces || ['kube-system', 'kube-public'];

    for (const ns of namespaces) {
      if (excludeNamespaces.includes(ns)) continue;

      const podsResponse = await this.k8sApi.listNamespacedPod(ns);
      const podMetricsResponse = await this.metricsApi.listNamespacedPodMetrics(ns);

      const podMetricsMap = new Map();
      podMetricsResponse.body.items.forEach(metric => {
        podMetricsMap.set(metric.metadata.name, metric);
      });

      for (const pod of podsResponse.body.items) {
        if (pod.status.phase === 'Running') {
          const metrics = podMetricsMap.get(pod.metadata.name);
          workloads.push(this.parsePod(pod, metrics));
        }
      }
    }

    // Add to analyzer
    nodes.forEach(node => this.analyzer.addNode(node));
    workloads.forEach(workload => this.analyzer.addWorkload(workload));

    return { nodes, workloads };
  }

  generateConsolidationPlan(clusterData, spec) {
    if (!spec.consolidationEnabled) {
      return { feasible: false };
    }

    // Use bin packing algorithm
    const strategy = spec.binPackingStrategy || 'best-fit';
    const placement = this.binPacker.optimizePlacement(
      clusterData.workloads,
      clusterData.nodes,
      strategy
    );

    // Generate migration plan
    const migrations = placement.migrations.map(m => ({
      workload: {
        name: m.workloadName,
        namespace: m.namespace || 'default',
        kind: 'Pod'
      },
      fromNode: m.from,
      toNode: m.to,
      risk: this.assessRisk(m),
      reason: m.reason,
      estimatedSavings: '$50/month'
    }));

    return {
      feasible: placement.efficiency > 50,
      migrations,
      efficiency: placement.efficiency,
      savings: {
        estimatedMonthlySavings: `$${migrations.length * 50}`
      }
    };
  }

  async handleMode(config, consolidationPlan, report) {
    const mode = config.spec.mode || 'observe';

    switch (mode) {
      case 'observe':
        // Just create report, no action
        console.log(`📊 Report created: ${report.metadata.name}`);
        break;

      case 'manual':
        // Create migration plan for approval
        if (consolidationPlan.feasible) {
          await this.createMigrationPlan(config, consolidationPlan);
        }
        break;

      case 'semi-auto':
        // Auto-approve low risk migrations
        if (consolidationPlan.feasible) {
          const plan = await this.createMigrationPlan(config, consolidationPlan);
          await this.autoApproveLowRisk(plan, config.spec.safetyThreshold);
        }
        break;

      case 'full-auto':
        // Auto-approve all (requires explicit flag)
        if (consolidationPlan.feasible && config.spec.confirmFullAuto) {
          const plan = await this.createMigrationPlan(config, consolidationPlan);
          await this.approveAllMigrations(plan);
        }
        break;
    }
  }

  async createMigrationPlan(config, consolidationPlan) {
    const plan = {
      apiVersion: `${this.group}/${this.version}`,
      kind: 'MigrationPlan',
      metadata: {
        name: `migplan-${Date.now()}`,
        namespace: 'default',
        labels: {
          'optimizer.io/config': config.metadata.name
        }
      },
      spec: {
        migrations: consolidationPlan.migrations,
        approved: false,
        autoApprove: config.spec.mode === 'full-auto'
      }
    };

    await this.customApi.createNamespacedCustomObject(
      this.group,
      this.version,
      'default',
      'migrationplans',
      plan
    );

    console.log(`📋 Migration plan created: ${plan.metadata.name}`);
    return plan;
  }

  async createOptimizationReport(config, analysis, consolidationPlan) {
    const report = {
      apiVersion: `${this.group}/${this.version}`,
      kind: 'OptimizationReport',
      metadata: {
        name: `report-${Date.now()}`,
        namespace: 'default',
        labels: {
          'optimizer.io/config': config.metadata.name
        }
      },
      spec: {
        configRef: config.metadata.name,
        timestamp: new Date().toISOString()
      },
      status: {
        summary: {
          totalNodes: analysis.nodes?.length || 0,
          activeNodes: analysis.nodes?.filter(n => n.workloadCount > 0).length || 0,
          totalWorkloads: this.analyzer.workloads.length,
          cpuUtilization: `${analysis.overallStats?.cpuUtilization || 0}%`,
          memoryUtilization: `${analysis.overallStats?.memoryUtilization || 0}%`
        },
        consolidation: {
          feasible: consolidationPlan.feasible,
          currentNodes: analysis.nodes?.length || 0,
          requiredNodes: consolidationPlan.requiredNodes || 0,
          estimatedSavings: consolidationPlan.savings?.estimatedMonthlySavings || '$0'
        },
        overProvisionedWorkloads: this.analyzer.identifyOverprovisionedWorkloads(),
        recommendations: this.generateRecommendations(analysis, consolidationPlan)
      }
    };

    await this.customApi.createNamespacedCustomObject(
      this.group,
      this.version,
      'default',
      'optimizationreports',
      report
    );

    return report;
  }

  async updateConfigStatus(name, status) {
    try {
      const patch = {
        status: status
      };

      await this.customApi.patchClusterCustomObjectStatus(
        this.group,
        this.version,
        'optimizationconfigs',
        name,
        patch
      );
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  }

  async reconcile() {
    try {
      // Get all OptimizationConfigs
      const configs = await this.customApi.listClusterCustomObject(
        this.group,
        this.version,
        'optimizationconfigs'
      );

      for (const config of configs.body.items) {
        // Check if it's time to run based on schedule
        if (this.shouldRun(config)) {
          await this.processConfig(config);
        }
      }

      // Process pending migration plans
      await this.processPendingMigrations();

    } catch (error) {
      console.error('Reconciliation error:', error);
    }
  }

  async processPendingMigrations() {
    const plans = await this.customApi.listNamespacedCustomObject(
      this.group,
      this.version,
      'default',
      'migrationplans'
    );

    for (const plan of plans.body.items) {
      if (plan.status?.phase === 'Approved' && plan.status?.phase !== 'Executing') {
        await this.executeMigrationPlan(plan);
      }
    }
  }

  async executeMigrationPlan(plan) {
    console.log(`🚀 Executing migration plan: ${plan.metadata.name}`);

    // Update status to Executing
    await this.updateMigrationPlanStatus(plan.metadata.name, {
      phase: 'Executing',
      startTime: new Date().toISOString()
    });

    const results = [];

    for (const migration of plan.spec.migrations) {
      try {
        // Evict pod to trigger rescheduling
        await this.k8sApi.deleteNamespacedPod(
          migration.workload.name,
          migration.workload.namespace,
          undefined,
          undefined,
          30, // grace period
          undefined,
          'Background'
        );

        results.push({
          workload: migration.workload.name,
          status: 'Success',
          message: `Migrated from ${migration.fromNode} to ${migration.toNode}`,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        results.push({
          workload: migration.workload.name,
          status: 'Failed',
          message: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    // Update final status
    await this.updateMigrationPlanStatus(plan.metadata.name, {
      phase: 'Completed',
      completionTime: new Date().toISOString(),
      results: results,
      executedMigrations: results.filter(r => r.status === 'Success').length,
      totalMigrations: plan.spec.migrations.length
    });
  }

  shouldRun(config) {
    // Simple cron-like schedule check (simplified)
    const lastAnalysis = config.status?.lastAnalysis;
    if (!lastAnalysis) return true;

    const lastTime = new Date(lastAnalysis);
    const now = new Date();
    const diffMinutes = (now - lastTime) / (1000 * 60);

    // Default: run every 30 minutes
    return diffMinutes >= 30;
  }

  parseNode(node, metrics) {
    // Implementation from k8sClient.js
    return {
      id: node.metadata.name,
      name: node.metadata.name,
      cpu: {
        total: this.parseCpu(node.status.allocatable.cpu),
        used: metrics ? this.parseCpu(metrics.usage.cpu) : 0
      },
      memory: {
        total: this.parseMemory(node.status.allocatable.memory),
        used: metrics ? this.parseMemory(metrics.usage.memory) : 0
      }
    };
  }

  parsePod(pod, metrics) {
    // Implementation from k8sClient.js
    return {
      id: pod.metadata.uid,
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      nodeId: pod.spec.nodeName,
      cpu: {
        limit: 1,
        request: 0.1,
        usage: metrics ? this.parseCpu(metrics.containers[0]?.usage.cpu) : 0
      },
      memory: {
        limit: 1024,
        request: 128,
        usage: metrics ? this.parseMemory(metrics.containers[0]?.usage.memory) : 0
      }
    };
  }

  parseCpu(value) {
    if (!value) return 0;
    const str = String(value);
    if (str.endsWith('m')) return parseFloat(str) / 1000;
    return parseFloat(str);
  }

  parseMemory(value) {
    if (!value) return 0;
    const str = String(value);
    if (str.endsWith('Mi')) return parseFloat(str);
    if (str.endsWith('Gi')) return parseFloat(str) * 1024;
    return parseFloat(str) / (1024 * 1024);
  }

  assessRisk(migration) {
    // Simplified risk assessment
    if (migration.workloadName?.includes('database')) return 'high';
    if (migration.workloadName?.includes('api')) return 'medium';
    return 'low';
  }

  generateRecommendations(analysis, consolidationPlan) {
    const recommendations = [];

    if (consolidationPlan.feasible) {
      recommendations.push({
        type: 'CONSOLIDATION',
        priority: 'HIGH',
        message: `Can reduce nodes from ${analysis.nodes?.length} to ${consolidationPlan.requiredNodes}`,
        action: 'Review migration plan'
      });
    }

    return recommendations;
  }

  async updateMigrationPlanStatus(name, status) {
    // Update migration plan status
    const patch = { status };
    await this.customApi.patchNamespacedCustomObjectStatus(
      this.group,
      this.version,
      'default',
      'migrationplans',
      name,
      patch
    );
  }

  async autoApproveLowRisk(plan, threshold) {
    // Auto-approve based on risk threshold
    const lowRiskMigrations = plan.spec.migrations.filter(m => m.risk === 'low');
    if (lowRiskMigrations.length > 0) {
      plan.spec.approved = true;
      plan.spec.approvedBy = 'auto-approval';
      plan.spec.approvalTime = new Date().toISOString();
      await this.updateMigrationPlanStatus(plan.metadata.name, { phase: 'Approved' });
    }
  }

  async approveAllMigrations(plan) {
    plan.spec.approved = true;
    plan.spec.approvedBy = 'full-auto';
    plan.spec.approvalTime = new Date().toISOString();
    await this.updateMigrationPlanStatus(plan.metadata.name, { phase: 'Approved' });
  }
}

// Start controller if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const controller = new OptimizerController();
  controller.start().catch(console.error);
}