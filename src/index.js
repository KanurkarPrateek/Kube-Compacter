import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { ResourceAnalyzer } from './resourceAnalyzer.js';
import { ConsolidationPredictor } from './consolidationPredictor.js';
import { LimitAnalyzer } from './limitAnalyzer.js';
import { loadTestData } from './testData.js';
import { K8sIntegration } from './k8sIntegration.js';

const program = new Command();

function displayUtilizationReport(analysis) {
  console.log(chalk.blue.bold('\n📊 Node Resource Utilization Report\n'));

  const nodeTable = new Table({
    head: ['Node', 'CPU Used/Total', 'CPU Util%', 'Memory Used/Total', 'Memory Util%', 'Efficiency', 'Workloads'],
    style: { head: ['cyan'] }
  });

  for (const node of analysis.nodes) {
    const cpuColor = parseFloat(node.cpu.utilization) < 30 ? 'red' : parseFloat(node.cpu.utilization) > 70 ? 'yellow' : 'green';
    const memColor = parseFloat(node.memory.utilization) < 30 ? 'red' : parseFloat(node.memory.utilization) > 70 ? 'yellow' : 'green';

    nodeTable.push([
      node.name,
      `${node.cpu.used.toFixed(2)}/${node.cpu.total}`,
      chalk[cpuColor](`${node.cpu.utilization}%`),
      `${(node.memory.used/1024).toFixed(2)}/${(node.memory.total/1024).toFixed(2)} GB`,
      chalk[memColor](`${node.memory.utilization}%`),
      `${node.efficiency}%`,
      node.workloadCount
    ]);
  }

  console.log(nodeTable.toString());

  console.log(chalk.blue.bold('\n📈 Overall Statistics:\n'));
  console.log(`  Total CPU: ${analysis.overallStats.totalCpu} cores`);
  console.log(`  Used CPU: ${analysis.overallStats.usedCpu.toFixed(2)} cores (${analysis.overallStats.cpuUtilization}%)`);
  console.log(`  Total Memory: ${(analysis.overallStats.totalMemory/1024).toFixed(2)} GB`);
  console.log(`  Used Memory: ${(analysis.overallStats.usedMemory/1024).toFixed(2)} GB (${analysis.overallStats.memoryUtilization}%)`);
}

function displayConsolidationReport(consolidationPlan) {
  console.log(chalk.blue.bold('\n🔄 Consolidation Analysis\n'));

  if (consolidationPlan.feasible) {
    console.log(chalk.green.bold('✅ Node consolidation is FEASIBLE!\n'));
    console.log(`  Current nodes: ${consolidationPlan.currentNodes}`);
    console.log(`  Required nodes: ${consolidationPlan.requiredNodes}`);
    console.log(`  Nodes saved: ${consolidationPlan.savings.nodeReduction} (${consolidationPlan.savings.percentReduction}% reduction)`);
    console.log(`  CPU saved: ${consolidationPlan.savings.cpuSaved} cores`);
    console.log(`  Memory saved: ${(consolidationPlan.savings.memorySaved/1024).toFixed(2)} GB`);

    if (consolidationPlan.recommendations.length > 0) {
      console.log(chalk.yellow.bold('\n💡 Recommendations:'));
      consolidationPlan.recommendations.forEach(rec => console.log(`  • ${rec}`));
    }

    if (consolidationPlan.warnings.length > 0) {
      console.log(chalk.red.bold('\n⚠️ Warnings:'));
      consolidationPlan.warnings.forEach(warn => console.log(`  • ${warn}`));
    }

    if (consolidationPlan.migrationSteps) {
      console.log(chalk.blue.bold('\n📋 Migration Plan:'));
      console.log(`  Total workload migrations needed: ${consolidationPlan.totalMigrations}`);

      const migrationTable = new Table({
        head: ['Workload', 'From Node', 'To Node', 'CPU', 'Memory'],
        style: { head: ['cyan'] }
      });

      consolidationPlan.migrationSteps.slice(0, 10).forEach(step => {
        migrationTable.push([
          step.workloadName,
          step.fromNode,
          step.toNodeName,
          `${step.resourceRequirements.cpu.toFixed(2)} cores`,
          `${(step.resourceRequirements.memory/1024).toFixed(2)} GB`
        ]);
      });

      if (consolidationPlan.migrationSteps.length > 10) {
        migrationTable.push(['...', '...', '...', '...', '...']);
      }

      console.log(migrationTable.toString());
    }
  } else {
    console.log(chalk.yellow('⚠️ Node consolidation is NOT feasible with current resource usage.'));
  }
}

function displayLimitAnalysisReport(report, rightSizingPlan) {
  console.log(chalk.blue.bold('\n🎯 Resource Limits Analysis\n'));

  console.log(chalk.bold('Summary:'));
  console.log(`  Over-provisioned workloads: ${report.overProvisionedWorkloads.length}`);
  console.log(`  Under-provisioned workloads: ${report.underProvisionedWorkloads.length}`);
  console.log(`  Optimized workloads: ${report.optimizedWorkloads.length}`);

  if (report.potentialSavings.cpu > 0 || report.potentialSavings.memory > 0) {
    console.log(chalk.green.bold('\n💰 Potential Savings:'));
    console.log(`  CPU: ${report.potentialSavings.cpu.toFixed(2)} cores`);
    console.log(`  Memory: ${(report.potentialSavings.memory/1024).toFixed(2)} GB`);
    console.log(`  Estimated monthly savings: $${rightSizingPlan.estimatedMonthlySavings.toFixed(2)}`);
  }

  if (report.overProvisionedWorkloads.length > 0) {
    console.log(chalk.yellow.bold('\n🔻 Over-Provisioned Workloads (Top 5):'));
    const overProvTable = new Table({
      head: ['Workload', 'CPU Usage', 'Memory Usage', 'Recommendation'],
      style: { head: ['cyan'] }
    });

    report.overProvisionedWorkloads.slice(0, 5).forEach(w => {
      overProvTable.push([
        w.name,
        `${w.cpu.usage}/${w.cpu.limit} (${w.cpu.usageRatio}%)`,
        `${w.memory.usage}/${w.memory.limit} MB (${w.memory.usageRatio}%)`,
        w.recommendation
      ]);
    });

    console.log(overProvTable.toString());
  }

  if (report.underProvisionedWorkloads.length > 0) {
    console.log(chalk.red.bold('\n🔺 Under-Provisioned Workloads:'));
    const underProvTable = new Table({
      head: ['Workload', 'CPU Usage', 'Memory Usage', 'Risk'],
      style: { head: ['cyan'] }
    });

    report.underProvisionedWorkloads.forEach(w => {
      underProvTable.push([
        w.name,
        chalk.red(`${w.cpu.usage}/${w.cpu.limit} (${w.cpu.usageRatio}%)`),
        chalk.red(`${w.memory.usage}/${w.memory.limit} MB (${w.memory.usageRatio}%)`),
        'Performance Impact'
      ]);
    });

    console.log(underProvTable.toString());
  }

  if (report.recommendations.length > 0) {
    console.log(chalk.blue.bold('\n📝 Recommendations:'));
    report.recommendations.forEach(rec => {
      const priorityColor = rec.priority === 'CRITICAL' ? 'red' : rec.priority === 'HIGH' ? 'yellow' : 'cyan';
      console.log(chalk[priorityColor](`  [${rec.priority}] ${rec.type}: ${rec.message}`));
      console.log(`    → ${rec.action}`);
      if (rec.potentialSavings) {
        console.log(`    💰 ${rec.potentialSavings}`);
      }
    });
  }
}

async function analyze(options) {
  try {
    let analyzer;

    if (options.cluster) {
      console.log(chalk.yellow('\n🔍 Analyzing live Kubernetes cluster...\n'));
      const k8s = new K8sIntegration();
      analyzer = await k8s.collectFromCluster();
    } else {
      analyzer = new ResourceAnalyzer();
      const data = await loadTestData(options.scenario || 'default');
      data.nodes.forEach(node => analyzer.addNode(node));
      data.workloads.forEach(workload => analyzer.addWorkload(workload));
    }

    const analysis = analyzer.analyzeUtilization();
    displayUtilizationReport(analysis);

    const consolidationPredictor = new ConsolidationPredictor(analyzer);
    const consolidationPlan = consolidationPredictor.generateMigrationPlan();
    displayConsolidationReport(consolidationPlan);

    const limitAnalyzer = new LimitAnalyzer(analyzer);
    const limitReport = limitAnalyzer.analyzeLimitsVsUsage();
    const rightSizingPlan = limitAnalyzer.generateRightSizingReport();
    displayLimitAnalysisReport(limitReport, rightSizingPlan);

    console.log(chalk.green.bold('\n✅ Analysis complete!\n'));
  } catch (error) {
    console.error(chalk.red('Error during analysis:'), error);
    process.exit(1);
  }
}

program
  .name('node-resource-optimizer')
  .description('Analyze and optimize compute resource allocation across nodes')
  .version('1.0.0');

program
  .command('analyze')
  .description('Analyze resource utilization and provide optimization recommendations')
  .option('-s, --scenario <type>', 'Test scenario to use (default, overprovisioned, mixed)', 'default')
  .option('-c, --cluster', 'Analyze live Kubernetes cluster using kubectl')
  .action(analyze);

program
  .command('test')
  .description('Run with test data to demonstrate functionality')
  .action(() => analyze({ scenario: 'mixed' }));

if (!process.argv.slice(2).length) {
  console.log(chalk.yellow('\n📦 Node Resource Optimizer\n'));
  console.log('This tool analyzes compute resource usage across nodes and predicts consolidation opportunities.\n');
  console.log('Usage:');
  console.log('  npm start analyze         - Analyze with default test data');
  console.log('  npm start analyze --cluster - Analyze live Kubernetes cluster');
  console.log('  npm start test            - Run comprehensive test scenario');
  console.log('  npm start analyze --scenario overprovisioned - Test overprovisioned scenario\n');
  program.outputHelp();
} else {
  program.parse();
}