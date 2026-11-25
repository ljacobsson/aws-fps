// The single gate every AWS call goes through.
//
// Two rules, enforced at runtime:
//   1. Read-only: only Describe*/Get*/List* operations.
//   2. Free: only control-plane operations that AWS does not bill per request.
//
// Deliberately NOT allowed (billable per request, even if only fractions of a cent):
//   S3 ListBuckets/GetBucket*   (LIST/GET request pricing)
//   SQS / SNS                   (every API action counts as a billable request)
//   KMS / Secrets Manager       (per-request API pricing)
//   CloudWatch GetMetricData    (always billed per metric)
//   Cost Explorer               ($0.01 per request — the irony would be too much)
// Those resources still show up when they were created through CloudFormation,
// because ListStackResources is free.
//
// One exception, chosen deliberately: the CloudWatch surveillance room draws real graphs
// with GetMetricStatistics (+ DescribeAlarms). These fall under CloudWatch's free tier of
// 1M API requests/month, so they are hard-capped per server session (see BUDGETS).

const FREE_READ_OPERATIONS = {
  sts: ['GetCallerIdentity'],
  ec2: [
    'DescribeVpcs', 'DescribeSubnets', 'DescribeInstances', 'DescribeNatGateways',
    'DescribeInternetGateways', 'DescribeRouteTables', 'DescribeSecurityGroups',
  ],
  lambda: ['ListFunctions', 'GetFunctionConfiguration'],
  dynamodb: ['ListTables', 'DescribeTable'],
  rds: ['DescribeDBInstances', 'DescribeDBClusters'],
  elasticache: ['DescribeCacheClusters'],
  ecs: ['ListClusters', 'DescribeClusters', 'ListServices'],
  sfn: ['ListStateMachines', 'DescribeStateMachine'],
  apigateway: ['GetRestApis'],
  apigatewayv2: ['GetApis'],
  eventbridge: ['ListEventBuses', 'ListRules'],
  cloudfront: ['ListDistributions'],
  route53: ['ListHostedZones'],
  iam: ['ListRoles', 'ListUsers'],
  cloudformation: ['ListStacks', 'DescribeStacks', 'ListStackResources', 'GetTemplate'],
  cloudwatch: ['DescribeAlarms', 'GetMetricStatistics'],
};

// Per-server-session call budgets for operations that are only free within a free tier.
const BUDGETS = {
  'cloudwatch:GetMetricStatistics': 150,
  'cloudwatch:DescribeAlarms': 10,
};
const used = {};

const ALLOWED = new Set(
  Object.entries(FREE_READ_OPERATIONS).flatMap(([svc, ops]) => ops.map((op) => `${svc}:${op}`)),
);

export class ForbiddenOperationError extends Error {}

/** Send a command after checking it against the read-only, cost-free allowlist. */
export async function safeSend(service, client, command) {
  const op = command.constructor.name.replace(/Command$/, '');
  if (!/^(Describe|Get|List)/.test(op) || !ALLOWED.has(`${service}:${op}`)) {
    throw new ForbiddenOperationError(
      `Blocked ${service}:${op} — this game only uses free, read-only API calls.`,
    );
  }
  const key = `${service}:${op}`;
  if (key in BUDGETS) {
    if ((used[key] || 0) >= BUDGETS[key]) {
      throw new ForbiddenOperationError(`Budget for ${key} exhausted (${BUDGETS[key]} calls). Restart the server to reset it.`);
    }
    used[key] = (used[key] || 0) + 1;
  }
  return client.send(command);
}

export function budgetRemaining(key) {
  return (BUDGETS[key] ?? Infinity) - (used[key] || 0);
}

export function budgets() {
  return Object.fromEntries(Object.entries(BUDGETS).map(([k, max]) => [k, { max, used: used[k] || 0 }]));
}

export function allowlist() {
  return FREE_READ_OPERATIONS;
}
