# Node Resource Optimizer

A tool to analyze compute resource usage across nodes and predict consolidation opportunities for cost optimization.

## Features

- **Resource Utilization Analysis**: Monitor CPU and memory usage across all nodes
- **Consolidation Prediction**: Determine if workloads can be consolidated to fewer nodes
- **Limit vs Usage Analysis**: Identify over-provisioned and under-provisioned workloads
- **Right-sizing Recommendations**: Get specific recommendations for resource limits
- **Cost Savings Estimation**: Calculate potential monthly savings from optimization

## Installation

```bash
npm install
```

## Usage

### Analyze with default test data
```bash
npm start analyze
```

### Run comprehensive test scenario
```bash
npm start test
```

### Test specific scenarios
```bash
npm start analyze -- --scenario overprovisioned
npm start analyze -- --scenario mixed
```

## How It Works

1. **Resource Analysis**: The tool analyzes CPU and memory usage across all nodes and workloads
2. **Consolidation Check**: Determines if workloads can fit on fewer nodes with a safety margin
3. **Limit Analysis**: Compares actual usage against configured limits to find optimization opportunities
4. **Migration Plan**: Generates a step-by-step plan for workload migration if consolidation is feasible

## Scenarios

- **default**: Balanced scenario with moderate resource usage
- **overprovisioned**: Scenario with highly over-provisioned resources (common in production)
- **mixed**: Real-world scenario with mix of optimized and over-provisioned workloads

## Key Metrics

- **CPU/Memory Utilization**: Actual usage vs available resources
- **Efficiency Score**: How efficiently resources are being used
- **Over-provisioning Ratio**: Difference between limits and actual usage
- **Consolidation Feasibility**: Whether nodes can be reduced

## Example Output

The tool provides:
- Node utilization statistics
- Consolidation feasibility analysis
- Migration plan for workloads
- Right-sizing recommendations
- Estimated cost savings