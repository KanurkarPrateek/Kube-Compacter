# Migration Control Modes

## Safety-First Design Philosophy

The migration system provides **4 distinct modes** to give users complete control over when and how workloads are moved:

## 1. 🔍 OBSERVE ONLY Mode (Default - Safest)
**Perfect for:** Initial analysis, reporting, planning

```bash
npm start analyze --cluster --mode=observe
```

**What it does:**
- Generates detailed recommendations
- Provides migration commands you can run manually
- Shows risk assessment for each workload
- NO automated actions taken

**Output Example:**
```yaml
Recommendation #1:
  Workload: production-api
  From: node-3
  To: node-1
  Risk: MEDIUM (API gateway - user-facing service)
  Estimated Downtime: 15 seconds
  Manual Command: kubectl delete pod production-api-xxx -n default
  Savings: $150/month
```

## 2. 📝 MANUAL APPROVAL Mode
**Perfect for:** Production environments requiring human oversight

```bash
npm start analyze --cluster --mode=manual
```

**What it does:**
- Generates migration plan
- Waits for explicit approval for EACH migration
- Provides approve/reject commands
- Executes only approved migrations

**Interactive Flow:**
```
Migration Plan Generated:
┌──────────────┬────────┬─────────┬──────┬─────────────┐
│ Workload     │ Risk   │ From    │ To   │ Action      │
├──────────────┼────────┼─────────┼──────┼─────────────┤
│ web-frontend │ LOW    │ node-2  │ node-1 │ [APPROVE] [REJECT] │
│ database     │ HIGH   │ node-3  │ node-1 │ [APPROVE] [REJECT] │
│ cache        │ MEDIUM │ node-2  │ node-1 │ [APPROVE] [REJECT] │
└──────────────┴────────┴─────────┴──────┴─────────────┘

Approve specific migrations:
kubectl optimize approve mig-123456
kubectl optimize approve mig-789012 --schedule="02:00"
```

## 3. 🤖 SEMI-AUTO Mode
**Perfect for:** Staging environments, non-critical production

```bash
npm start analyze --cluster --mode=semi-auto --safety-threshold=medium
```

**What it does:**
- Auto-executes LOW risk migrations
- Requires approval for MEDIUM/HIGH risk
- Respects safe migration windows
- Provides rollback for all actions

**Safety Thresholds:**
- `conservative`: Only auto-migrate stateless, non-critical workloads
- `medium`: Auto-migrate low and medium risk workloads
- `aggressive`: Auto-migrate all except databases

**Example Decision Tree:**
```
nginx-static (LOW risk) → Auto-migrate at 2 AM
redis-cache (MEDIUM risk) → Auto-migrate if threshold=medium
postgres-db (HIGH risk) → Always require manual approval
```

## 4. ⚡ FULL AUTO Mode (Not Recommended)
**Perfect for:** Dev/test environments only

```bash
npm start analyze --cluster --mode=full-auto --confirm-full-auto
```

**What it does:**
- Executes ALL migrations automatically
- Still respects safe windows
- Requires explicit confirmation flag
- Logs all actions for audit

⚠️ **WARNING:** Never use in production without extensive testing!

## Safe Migration Windows

The system automatically detects low-traffic windows:

```javascript
Safe Windows Configuration:
- Weekdays: 2 AM - 5 AM
- Weekends: 1 AM - 7 AM
- Holidays: All day (configurable)
- Custom: Define via config file
```

## Risk Assessment Factors

Each workload is assessed for risk based on:

1. **Workload Type**
   - Database: HIGH risk (50 points)
   - API Gateway: MEDIUM-HIGH risk (40 points)
   - Cache: MEDIUM risk (30 points)
   - Stateless apps: LOW risk (10 points)

2. **Resource Usage**
   - High CPU/Memory: +20 points
   - Large persistent volumes: +30 points

3. **Availability**
   - Single replica: +30 points
   - No health checks: +20 points

## Configuration Examples

### Conservative Production Setup
```yaml
apiVersion: optimizer.io/v1
kind: MigrationPolicy
metadata:
  name: production-policy
spec:
  mode: manual
  approvalRequired:
    - namespace: production
    - labels:
      app: database
    - labels:
      tier: critical
  autoApprove:
    - labels:
      tier: development
  safeWindows:
    - start: "02:00"
      end: "05:00"
      days: ["Mon", "Tue", "Wed", "Thu", "Fri"]
```

### Staging Environment Setup
```yaml
apiVersion: optimizer.io/v1
kind: MigrationPolicy
metadata:
  name: staging-policy
spec:
  mode: semi-auto
  safetyThreshold: medium
  autoMigrate:
    riskLevels: ["low", "medium"]
    excludeLabels:
      persistent: "true"
  notifications:
    slack: "#ops-channel"
    email: "ops-team@company.com"
```

## Rollback Capabilities

Every migration can be rolled back:

```bash
# Rollback specific migration
kubectl optimize rollback mig-123456

# Rollback all migrations in last hour
kubectl optimize rollback --since=1h

# Emergency stop all migrations
kubectl optimize stop-all
```

## Best Practices

1. **Start with OBSERVE mode** - Understand the recommendations
2. **Test in staging** - Use SEMI-AUTO mode in staging first
3. **Use MANUAL mode in production** - Maintain human oversight
4. **Configure safe windows** - Respect your traffic patterns
5. **Set up monitoring** - Watch metrics after migrations
6. **Have rollback plan** - Know how to revert quickly

## Comparison with VPA

| Feature | VPA | Our Migration Controller |
|---------|-----|-------------------------|
| Changes Resources | ✅ Automatically | ❌ Never changes limits/requests |
| Moves Workloads | ❌ | ✅ Intelligently relocates |
| Requires Restart | ✅ Always | ✅ Only for migration |
| User Control | Limited | Full control (4 modes) |
| Risk Assessment | ❌ | ✅ Comprehensive |
| Safe Windows | ❌ | ✅ Time-based |
| Rollback | ❌ | ✅ Built-in |

The key difference: **VPA changes pod resources, we change pod placement** - both important for optimization but serving different purposes!