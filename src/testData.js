export async function loadTestData(scenario = 'default') {
  const scenarios = {
    default: {
      nodes: [
        {
          id: 'node-1',
          name: 'worker-node-1',
          cpu: { total: 16, used: 0, allocated: 0 },
          memory: { total: 32768, used: 0, allocated: 0 }
        },
        {
          id: 'node-2',
          name: 'worker-node-2',
          cpu: { total: 16, used: 0, allocated: 0 },
          memory: { total: 32768, used: 0, allocated: 0 }
        }
      ],
      workloads: [
        {
          id: 'app-1',
          name: 'web-frontend',
          nodeId: 'node-1',
          cpu: { limit: 2, request: 1, usage: 0.5 },
          memory: { limit: 2048, request: 1024, usage: 800 }
        },
        {
          id: 'app-2',
          name: 'api-backend',
          nodeId: 'node-1',
          cpu: { limit: 4, request: 2, usage: 1.2 },
          memory: { limit: 4096, request: 2048, usage: 1500 }
        },
        {
          id: 'app-3',
          name: 'database',
          nodeId: 'node-2',
          cpu: { limit: 8, request: 4, usage: 2.5 },
          memory: { limit: 8192, request: 4096, usage: 3000 }
        },
        {
          id: 'app-4',
          name: 'cache-service',
          nodeId: 'node-2',
          cpu: { limit: 2, request: 1, usage: 0.3 },
          memory: { limit: 4096, request: 2048, usage: 500 }
        }
      ]
    },

    overprovisioned: {
      nodes: [
        {
          id: 'node-1',
          name: 'expensive-node-1',
          cpu: { total: 32, used: 0, allocated: 0 },
          memory: { total: 65536, used: 0, allocated: 0 }
        },
        {
          id: 'node-2',
          name: 'expensive-node-2',
          cpu: { total: 32, used: 0, allocated: 0 },
          memory: { total: 65536, used: 0, allocated: 0 }
        },
        {
          id: 'node-3',
          name: 'expensive-node-3',
          cpu: { total: 32, used: 0, allocated: 0 },
          memory: { total: 65536, used: 0, allocated: 0 }
        }
      ],
      workloads: [
        {
          id: 'app-1',
          name: 'overprovisioned-web',
          nodeId: 'node-1',
          cpu: { limit: 8, request: 4, usage: 0.5 },
          memory: { limit: 16384, request: 8192, usage: 1024 }
        },
        {
          id: 'app-2',
          name: 'overprovisioned-api',
          nodeId: 'node-1',
          cpu: { limit: 8, request: 4, usage: 0.8 },
          memory: { limit: 16384, request: 8192, usage: 2048 }
        },
        {
          id: 'app-3',
          name: 'overprovisioned-worker',
          nodeId: 'node-2',
          cpu: { limit: 16, request: 8, usage: 1.2 },
          memory: { limit: 32768, request: 16384, usage: 3000 }
        },
        {
          id: 'app-4',
          name: 'overprovisioned-batch',
          nodeId: 'node-2',
          cpu: { limit: 8, request: 4, usage: 0.4 },
          memory: { limit: 16384, request: 8192, usage: 1500 }
        },
        {
          id: 'app-5',
          name: 'idle-service',
          nodeId: 'node-3',
          cpu: { limit: 4, request: 2, usage: 0.1 },
          memory: { limit: 8192, request: 4096, usage: 512 }
        }
      ]
    },

    mixed: {
      nodes: [
        {
          id: 'node-1',
          name: 'mixed-node-1',
          cpu: { total: 24, used: 0, allocated: 0 },
          memory: { total: 49152, used: 0, allocated: 0 }
        },
        {
          id: 'node-2',
          name: 'mixed-node-2',
          cpu: { total: 24, used: 0, allocated: 0 },
          memory: { total: 49152, used: 0, allocated: 0 }
        },
        {
          id: 'node-3',
          name: 'mixed-node-3',
          cpu: { total: 16, used: 0, allocated: 0 },
          memory: { total: 32768, used: 0, allocated: 0 }
        }
      ],
      workloads: [
        {
          id: 'app-1',
          name: 'production-web',
          nodeId: 'node-1',
          cpu: { limit: 4, request: 3, usage: 3.2 },
          memory: { limit: 8192, request: 6144, usage: 7000 }
        },
        {
          id: 'app-2',
          name: 'production-api',
          nodeId: 'node-1',
          cpu: { limit: 6, request: 4, usage: 4.5 },
          memory: { limit: 12288, request: 8192, usage: 10000 }
        },
        {
          id: 'app-3',
          name: 'overprovisioned-batch',
          nodeId: 'node-1',
          cpu: { limit: 8, request: 4, usage: 0.5 },
          memory: { limit: 16384, request: 8192, usage: 2000 }
        },
        {
          id: 'app-4',
          name: 'database-primary',
          nodeId: 'node-2',
          cpu: { limit: 10, request: 8, usage: 7.5 },
          memory: { limit: 20480, request: 16384, usage: 18000 }
        },
        {
          id: 'app-5',
          name: 'cache-cluster',
          nodeId: 'node-2',
          cpu: { limit: 4, request: 2, usage: 1.8 },
          memory: { limit: 16384, request: 8192, usage: 12000 }
        },
        {
          id: 'app-6',
          name: 'monitoring-stack',
          nodeId: 'node-2',
          cpu: { limit: 4, request: 2, usage: 0.3 },
          memory: { limit: 8192, request: 4096, usage: 1000 }
        },
        {
          id: 'app-7',
          name: 'dev-environment',
          nodeId: 'node-3',
          cpu: { limit: 8, request: 4, usage: 0.2 },
          memory: { limit: 16384, request: 8192, usage: 1024 }
        },
        {
          id: 'app-8',
          name: 'staging-app',
          nodeId: 'node-3',
          cpu: { limit: 4, request: 2, usage: 0.4 },
          memory: { limit: 8192, request: 4096, usage: 1500 }
        },
        {
          id: 'app-9',
          name: 'ml-training',
          nodeId: 'node-3',
          cpu: { limit: 2, request: 1.5, usage: 1.8 },
          memory: { limit: 4096, request: 3072, usage: 3900 }
        }
      ]
    }
  };

  return scenarios[scenario] || scenarios.default;
}