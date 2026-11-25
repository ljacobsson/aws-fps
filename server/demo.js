// A fake but plausible account so the game works without credentials (and so the
// intern has something to break).

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (a, b) => Math.floor(a + rnd() * (b - a + 1));
const hex = (n) => Array.from({ length: n }, () => '0123456789abcdef'[int(0, 15)]).join('');
const ACCOUNT = '123456789012';
const REGION = 'eu-west-1';
const arn = (svc, res, region = REGION) => `arn:aws:${svc}:${region}:${ACCOUNT}:${res}`;
const days = (n) => new Date(Date.now() - n * 86400000).toISOString();

const apps = ['checkout', 'orders', 'payments', 'inventory', 'search', 'auth', 'notifications', 'billing', 'catalog', 'shipping', 'recommendations', 'analytics'];
const verbs = ['handler', 'processor', 'worker', 'api', 'consumer', 'scheduler', 'resolver', 'authorizer', 'transformer', 'sync'];
const runtimes = ['nodejs22.x', 'nodejs20.x', 'python3.12', 'python3.13', 'java21', 'provided.al2023', 'nodejs22.x', 'python3.12'];
const zombieRuntimes = ['nodejs12.x', 'python2.7', 'go1.x', 'nodejs14.x'];

export function demoScan() {
  seed = 42;
  const lambdas = [];
  for (let i = 0; i < 46; i++) {
    const app = pick(apps);
    const name = `${app}-${pick(verbs)}-${i < 30 ? 'prod' : 'dev'}`;
    const zombie = i % 13 === 7;
    const runtime = zombie ? pick(zombieRuntimes) : pick(runtimes);
    lambdas.push({
      id: arn('lambda', `function:${name}`), name, kind: 'lambda', sub: runtime, status: 'Active', deprecated: zombie,
      subnets: [], vpcId: null,
      info: {
        Runtime: runtime, Handler: 'index.handler', MemorySize: pick([128, 256, 512, 1024, 1769, 3008]), Timeout: pick([3, 10, 30, 900]),
        CodeSize: int(1000, 50_000_000), Architectures: [pick(['arm64', 'x86_64'])], PackageType: 'Zip', LastModified: days(int(0, 900)),
        Description: zombie ? 'TODO: upgrade runtime (ticket filed 2019)' : `Handles ${app} things`, Role: arn('iam', `role/${name}-role`, ''),
        Environment: { Variables: { TABLE_NAME: '•••• (masked by the intern)', LOG_LEVEL: '•••• (masked by the intern)' } },
      },
    });
  }

  const tables = apps.slice(0, 9).map((a) => {
    const size = int(1e5, 5e11);
    return {
      id: arn('dynamodb', `table/${a}`), name: a.charAt(0).toUpperCase() + a.slice(1) + 'Table', kind: 'dynamodb',
      sub: pick(['PAY_PER_REQUEST', 'PROVISIONED']), status: 'ACTIVE', size,
      info: { TableStatus: 'ACTIVE', ItemCount: Math.floor(size / 700), TableSizeBytes: size, KeySchema: [{ AttributeName: 'pk', KeyType: 'HASH' }, { AttributeName: 'sk', KeyType: 'RANGE' }], BillingMode: 'PAY_PER_REQUEST', DeletionProtectionEnabled: rnd() > 0.5 },
    };
  });

  const rds = [
    { id: arn('rds', 'cluster:orders-aurora'), name: 'orders-aurora', kind: 'rds', sub: 'aurora-postgresql cluster', status: 'available', info: { Engine: 'aurora-postgresql', EngineVersion: '16.4', MultiAZ: true, Members: ['orders-aurora-1', 'orders-aurora-2'] } },
    { id: arn('rds', 'db:orders-aurora-1'), name: 'orders-aurora-1', kind: 'rds', sub: 'aurora-postgresql db.r7g.large', status: 'available', info: { Engine: 'aurora-postgresql', DBInstanceClass: 'db.r7g.large', Status: 'available' } },
    { id: arn('rds', 'db:orders-aurora-2'), name: 'orders-aurora-2', kind: 'rds', sub: 'aurora-postgresql db.r7g.large', status: 'available', info: { Engine: 'aurora-postgresql', DBInstanceClass: 'db.r7g.large', Status: 'available' } },
    { id: arn('rds', 'db:legacy-mysql'), name: 'legacy-mysql-do-not-touch', kind: 'rds', sub: 'mysql db.t2.micro', status: 'available', info: { Engine: 'mysql', EngineVersion: '5.7.44', DBInstanceClass: 'db.t2.micro', Status: 'available', note: 'Extended support charges: yes.' } },
  ];

  const svc = (kind, items) => ({ items });
  const subnetsFor = (vpcId, azs, cidrBase) => azs.flatMap((az, i) => [
    { id: `subnet-${hex(8)}`, name: `public-${az.slice(-1)}`, kind: 'subnet', sub: `${cidrBase}.${i * 32}.0/20`, az, public: true, info: { AvailabilityZone: az } },
    { id: `subnet-${hex(8)}`, name: `private-${az.slice(-1)}`, kind: 'subnet', sub: `${cidrBase}.${128 + i * 32}.0/20`, az, public: false, info: { AvailabilityZone: az } },
  ]);
  const mkVpc = (name, cidrBase, isDefault, instanceCount) => {
    const id = `vpc-${hex(8)}`;
    const subnets = subnetsFor(id, ['eu-west-1a', 'eu-west-1b', 'eu-west-1c'], cidrBase);
    const instances = Array.from({ length: instanceCount }, (_, i) => {
      const s = pick(subnets);
      const type = pick(['t3.micro', 't3.large', 'm7g.xlarge', 'c7i.2xlarge', 'r6g.4xlarge', 't2.nano']);
      const iid = `i-0${hex(16)}`;
      return { id: iid, name: `${pick(apps)}-${pick(['bastion', 'worker', 'batch', 'legacy', 'jenkins', 'pet'])}-${i}`, kind: 'ec2', sub: type, status: rnd() > 0.2 ? 'running' : 'stopped', subnetId: s.id, info: { InstanceType: type, SubnetId: s.id, PrivateIpAddress: `${cidrBase}.${int(0, 255)}.${int(1, 254)}` } };
    });
    return {
      id, name, kind: 'vpc', sub: `${cidrBase}.0.0/16`, status: 'available', isDefault,
      info: { VpcId: id, CidrBlock: `${cidrBase}.0.0/16`, IsDefault: isDefault },
      subnets, instances,
      natGateways: isDefault ? [] : [{ id: `nat-${hex(17)}`, name: 'nat-a', kind: 'nat', status: 'available', subnetId: subnets[0].id, info: { State: 'available', note: '$0.045/hour + $0.045/GB. Hello darkness my old friend.' } }],
      internetGateways: [{ id: `igw-${hex(8)}`, name: 'igw', kind: 'igw', status: 'attached', info: {} }],
      securityGroups: [
        { id: `sg-${hex(8)}`, name: 'default', description: 'default VPC security group', ingress: [`all traffic ← sg-self`], egress: ['all traffic ← 0.0.0.0/0'] },
        { id: `sg-${hex(8)}`, name: 'launch-wizard-1', description: 'launch-wizard-1 created 2017-03-14', ingress: ['tcp 22 ← 0.0.0.0/0 (yikes)'], egress: ['all traffic ← 0.0.0.0/0'] },
      ],
    };
  };
  const vpcs = [mkVpc('prod-vpc', '10.0', false, 14), mkVpc('staging-vpc', '10.1', false, 6), mkVpc('default VPC', '172.31', true, 2)];
  // Put a few Lambdas inside the prod VPC.
  lambdas.slice(0, 5).forEach((f) => { f.vpcId = vpcs[0].id; f.subnets = [vpcs[0].subnets[1].id]; });

  const stackNames = [
    'orders-service', 'payments-service', 'checkout-api', 'inventory-sync', 'auth-cognito', 'notifications-fanout',
    'search-opensearch', 'data-lake', 'CDKToolkit', 'network-baseline', 'observability', 'sam-app', 'sam-app-2',
    'sam-app-final', 'sam-app-final-FINAL', 'billing-pipeline', 'shipping-workflows', 'catalog-cdn', 'test-delete-me',
  ];
  const statuses = ['CREATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_COMPLETE', 'UPDATE_ROLLBACK_COMPLETE', 'CREATE_COMPLETE', 'ROLLBACK_COMPLETE'];
  const stacks = stackNames.map((n, i) => ({
    id: arn('cloudformation', `stack/${n}/${hex(8)}-${hex(4)}`), name: n, kind: 'cfnStack', status: i === 18 ? 'ROLLBACK_COMPLETE' : pick(statuses),
    nested: false, parentId: null,
    info: { StackName: n, StackStatus: 'UPDATE_COMPLETE', TemplateDescription: `${n} — deployed by a pipeline nobody understands`, CreationTime: days(int(30, 1500)), LastUpdatedTime: days(int(0, 30)) },
  }));
  stacks.push({ id: arn('cloudformation', `stack/orders-service-DatabaseNestedStack-${hex(6)}/x`), name: `orders-service-DatabaseNestedStack-${hex(6).toUpperCase()}`, kind: 'cfnStack', status: 'UPDATE_COMPLETE', nested: true, parentId: stacks[0].id, info: { StackName: 'nested' } });
  stacks.forEach((s) => { s.resourceTypes = demoStackResources(s.name).reduce((m, r) => ((m[r.ResourceType] = (m[r.ResourceType] || 0) + 1), m), {}); s.resourceCount = Object.values(s.resourceTypes).reduce((a, b) => a + b, 0); });

  const deletedStacks = ['hackathon-2019', 'poc-blockchain', 'my-first-stack', 'serverless-wordpress', 'test-stack-123', 'kubernetes-the-hard-way', 'temp-fix', 'jeffs-experiment'].map((n, i) => ({
    id: arn('cloudformation', `stack/${n}/${hex(8)}`), name: n, kind: 'cfnStack', status: 'DELETE_COMPLETE',
    info: { StackName: n, StackStatus: 'DELETE_COMPLETE', CreationTime: days(400 + i * 50), DeletionTime: days(int(1, 80)) },
  }));

  const fromCfn = (kind, names, stack) => names.map((n) => ({ id: n, name: n, kind, sub: `${stack} / ${n}`, status: 'CREATE_COMPLETE', info: { PhysicalResourceId: n, Stack: stack, note: 'Discovered via CloudFormation — this service\'s own List APIs are billed per request, so we don\'t call them.' } }));

  const services = {
    lambda: svc('lambda', lambdas),
    dynamodb: svc('dynamodb', tables),
    rds: svc('rds', rds),
    elasticache: svc('elasticache', [
      { id: 'sessions-redis', name: 'sessions-redis-001', kind: 'elasticache', sub: 'redis cache.r7g.large', status: 'available', info: { Engine: 'redis', NumCacheNodes: 1 } },
      { id: 'catalog-valkey', name: 'catalog-valkey-001', kind: 'elasticache', sub: 'valkey cache.t4g.small', status: 'available', info: { Engine: 'valkey' } },
    ]),
    ecs: svc('ecs', ['prod-cluster', 'batch-cluster', 'jenkins-forever'].map((n, i) => ({ id: arn('ecs', `cluster/${n}`), name: n, kind: 'ecs', sub: `${[12, 3, 1][i]} running tasks`, status: 'ACTIVE', count: [6, 2, 1][i], info: { RunningTasks: [12, 3, 1][i], ActiveServices: [6, 2, 1][i], Services: ['web', 'api', 'worker', 'cron', 'admin', 'legacy'].slice(0, [6, 2, 1][i]) } }))),
    sfn: svc('sfn', ['OrderFulfilment', 'PaymentSaga', 'NightlyBatch', 'RetryTheRetries'].map((n) => ({ id: arn('states', `stateMachine:${n}`), name: n, kind: 'sfn', sub: pick(['STANDARD', 'EXPRESS']), status: 'ACTIVE', info: { Type: 'STANDARD' } }))),
    apigw: svc('apigw', ['orders-api', 'public-graphql', 'webhooks', 'internal-admin'].map((n) => ({ id: hex(10), name: n, kind: 'apigw', sub: pick(['REST REGIONAL', 'HTTP']), status: 'DEPLOYED', info: { Type: 'REST' } }))),
    eventbridge: svc('eventbridge', [
      { id: arn('events', 'event-bus/default'), name: 'default', kind: 'eventbridge', sub: 'event bus', status: 'ACTIVE', info: {} },
      { id: arn('events', 'event-bus/orders'), name: 'orders', kind: 'eventbridge', sub: 'event bus', status: 'ACTIVE', info: {} },
      ...DEMO_RULES.map((n) => ({
        id: arn('events', `rule/${n}`), name: n, kind: 'eventbridge', sub: DEMO_SCHEDULES[n] ? 'scheduled rule' : 'rule', status: n === 'PaymentFailed' ? 'DISABLED' : 'ENABLED',
        info: DEMO_SCHEDULES[n] ? { ScheduleExpression: DEMO_SCHEDULES[n], State: 'ENABLED' } : { EventPattern: { source: ['com.example.orders'], 'detail-type': [n] }, State: 'ENABLED' },
      })),
    ]),
    cloudfront: svc('cloudfront', ['www.example.com', 'cdn.example.com', 'd1234abcd.cloudfront.net'].map((n) => ({ id: hex(14).toUpperCase(), name: n, kind: 'cloudfront', sub: `${hex(13)}.cloudfront.net`, status: 'Deployed', info: { PriceClass: 'PriceClass_All', Enabled: true } }))),
    route53: svc('route53', ['example.com.', 'internal.example.com.', 'its-always-dns.com.'].map((n, i) => ({ id: `/hostedzone/Z${hex(12).toUpperCase()}`, name: n, kind: 'route53', sub: i === 1 ? 'private zone' : 'public zone', status: 'ACTIVE', info: { RecordSetCount: int(2, 80) } }))),
    iam: svc('iam', [
      ...['admin', 'ci-deployer', 'jeff', 'intern-do-not-give-admin'].map((n) => ({ id: arn('iam', `user/${n}`, ''), name: n, kind: 'iam', sub: 'user', status: 'ACTIVE', info: {} })),
      ...lambdas.slice(0, 20).map((f) => ({ id: f.info.Role, name: `${f.name}-role`, kind: 'iam', sub: 'role', status: 'ACTIVE', info: {} })),
      ...['AWSServiceRoleForSupport', 'AWSServiceRoleForTrustedAdvisor', 'OrganizationAccountAccessRole', 'AWSReservedSSO_AdministratorAccess_abc123'].map((n) => ({ id: arn('iam', `role/${n}`, ''), name: n, kind: 'iam', sub: n.startsWith('AWSService') ? 'service-linked role' : 'role', status: 'ACTIVE', info: {} })),
    ]),
    vpc: svc('vpc', vpcs),
    cfn: { items: stacks },
    s3: { viaCloudFormation: true, items: fromCfn('s3', ['orders-service-artifacts-1a2b3c', 'data-lake-raw-zone', 'data-lake-curated', 'cdk-hnb659fds-assets-123456789012-eu-west-1', 'catalog-cdn-origin', 'logs-bucket-of-doom', 'sam-cli-managed-default-samclisourcebucket-xyz'], 'various') },
    sqs: { viaCloudFormation: true, items: fromCfn('sqs', ['orders-queue', 'orders-dlq', 'payments-queue.fifo', 'notifications-queue', 'the-queue-nobody-reads'], 'orders-service') },
    sns: { viaCloudFormation: true, items: fromCfn('sns', ['order-events', 'alarms-topic', 'marketing-blast'], 'notifications-fanout') },
    kms: { viaCloudFormation: true, items: fromCfn('kms', ['1234abcd-12ab-34cd-56ef-1234567890ab', 'data-lake-key'], 'data-lake') },
    secrets: { viaCloudFormation: true, items: fromCfn('secrets', ['prod/db/password', 'stripe-api-key', 'definitely-not-in-git'], 'payments-service') },
    logs: { viaCloudFormation: true, items: lambdas.slice(0, 18).map((f) => ({ id: `/aws/lambda/${f.name}`, name: `/aws/lambda/${f.name}`, kind: 'logs', sub: 'retention: never expire', status: 'CREATE_COMPLETE', info: { RetentionInDays: null, note: 'Never expire. Like your regrets.' } })) },
    alarm: { items: [
      ...DEMO_ALARMS.map((n, i) => ({
        id: arn('cloudwatch', `alarm:${n}`), name: n, kind: 'alarm', sub: 'AWS/Lambda Errors', status: [3, 9].includes(i) ? 'ALARM' : i === 5 ? 'INSUFFICIENT_DATA' : 'OK',
        info: { StateValue: [3, 9].includes(i) ? 'ALARM' : 'OK', Threshold: int(1, 100), ComparisonOperator: 'GreaterThanThreshold' },
      })),
    ] },
  };

  return {
    meta: { profile: 'demo', region: REGION, accountId: ACCOUNT, arn: `arn:aws:sts::${ACCOUNT}:assumed-role/AWSReservedSSO_DataCenterTechnician/intern`, scannedAt: new Date().toISOString(), demo: true },
    services,
    graveyard: { deletedStacks, deprecatedLambdas: lambdas.filter((f) => f.deprecated) },
  };
}

const DEMO_SCHEDULES = { 'nightly-cleanup': 'cron(0 3 * * ? *)', 'every-minute-for-no-reason': 'rate(1 minute)', 'weekly-report': 'cron(0 9 ? * MON *)' };
const DEMO_RULES = ['OrderPlaced', 'OrderShipped', 'nightly-cleanup', 'PaymentFailed', 'every-minute-for-no-reason', 'weekly-report', 'InventoryLow'];
const DEMO_ALARMS = ['orders-5xx', 'payments-latency-p99', 'dlq-not-empty', 'billing-over-budget', 'lambda-throttles', 'checkout-errors', 'rds-cpu-high', 'disk-almost-full', 'api-latency', 'nightly-batch-failed', 'concurrency-near-limit', 'cost-anomaly'];

const TYPE_POOL = {
  service: ['AWS::Lambda::Function', 'AWS::Lambda::Function', 'AWS::Lambda::Function', 'AWS::IAM::Role', 'AWS::IAM::Role', 'AWS::DynamoDB::Table', 'AWS::SQS::Queue', 'AWS::SNS::Topic', 'AWS::Logs::LogGroup', 'AWS::Logs::LogGroup', 'AWS::Lambda::Permission', 'AWS::Lambda::EventSourceMapping', 'AWS::ApiGateway::RestApi', 'AWS::ApiGateway::Deployment', 'AWS::ApiGateway::Stage', 'AWS::Events::Rule', 'AWS::StepFunctions::StateMachine', 'AWS::S3::Bucket', 'AWS::CloudWatch::Alarm', 'AWS::SSM::Parameter', 'AWS::KMS::Key', 'AWS::SecretsManager::Secret'],
  network: ['AWS::EC2::VPC', 'AWS::EC2::Subnet', 'AWS::EC2::Subnet', 'AWS::EC2::Subnet', 'AWS::EC2::RouteTable', 'AWS::EC2::InternetGateway', 'AWS::EC2::NatGateway', 'AWS::EC2::SecurityGroup', 'AWS::EC2::Instance', 'AWS::EC2::Instance'],
};

export function demoStackResources(stackName) {
  let h = 0;
  for (const ch of stackName) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  seed = (h % 100000) + 1;
  const pool = stackName.includes('network') ? TYPE_POOL.network : TYPE_POOL.service;
  const n = stackName === 'CDKToolkit' ? 8 : int(6, 34);
  const out = [];
  for (let i = 0; i < n; i++) {
    const type = pick(pool);
    const short = type.split('::').pop();
    out.push({
      LogicalResourceId: `${short}${i}${hex(4).toUpperCase()}`,
      PhysicalResourceId: type === 'AWS::CloudWatch::Alarm' ? pick(DEMO_ALARMS) : type === 'AWS::Events::Rule' ? pick(DEMO_RULES) : `${stackName}-${short.toLowerCase()}-${hex(6)}`,
      ResourceType: type,
      ResourceStatus: rnd() > 0.95 ? 'UPDATE_FAILED' : 'CREATE_COMPLETE',
      LastUpdatedTimestamp: days(int(0, 200)),
    });
  }
  if (stackName === 'orders-service') {
    out.push({ LogicalResourceId: 'DatabaseNestedStack', PhysicalResourceId: arn('cloudformation', 'stack/orders-service-DatabaseNestedStack-ABC/x'), ResourceType: 'AWS::CloudFormation::Stack', ResourceStatus: 'UPDATE_COMPLETE', LastUpdatedTimestamp: days(3) });
  }
  return out;
}

export function demoDetails(kind, id) {
  if (kind === 'cfnStack') {
    const name = id.includes('stack/') ? id.split('stack/')[1].split('/')[0] : id;
    return {
      stack: {
        StackName: name, StackId: id, StackStatus: 'UPDATE_COMPLETE', Description: `${name} — deployed by a pipeline nobody understands`,
        Parameters: [{ ParameterKey: 'Stage', ParameterValue: 'prod' }, { ParameterKey: 'LogLevel', ParameterValue: 'DEBUG (oops)' }],
        Outputs: [{ OutputKey: 'ApiUrl', OutputValue: `https://${hex(10)}.execute-api.eu-west-1.amazonaws.com/prod` }, { OutputKey: 'TableName', OutputValue: `${name}-table` }],
        Tags: [{ Key: 'owner', Value: 'someone-who-left' }], TerminationProtection: false,
      },
      resources: demoStackResources(name),
    };
  }
  if (kind === 'cfnTemplate') {
    return { TemplateBody: `AWSTemplateFormatVersion: '2010-09-09'\nTransform: AWS::Serverless-2016-10-31\nDescription: ${id.split('/')[1] || id}\n\nResources:\n  MyFunction:\n    Type: AWS::Serverless::Function\n    Properties:\n      Runtime: nodejs22.x\n      Handler: index.handler\n      # TODO: remove before prod (2018)\n      Policies: AdministratorAccess\n` };
  }
  return null;
}

export function demoMetrics(scan) {
  seed = 7;
  const now = Date.now();
  const Period = 300;
  const n = 73;
  const series = (base, noise, shape) => Array.from({ length: n }, (_, i) => {
    const t = i / n;
    const daily = shape === 'spiky' ? (rnd() > 0.93 ? base * 4 * rnd() : 0) : Math.sin(t * Math.PI * 2 + base) * base * 0.4;
    return Math.max(0, base + daily + (rnd() - 0.5) * noise);
  });
  const graphs = [];
  const add = (title, MetricName, group, base, noise, shape, unit = 'Count') => graphs.push({ title, MetricName, Namespace: `AWS/${group}`, group, Statistic: 'Sum', unit, points: series(base, noise, shape), hasData: true });
  add('Lambda · Invocations (account)', 'Invocations', 'Lambda', 1200, 400);
  add('Lambda · Errors (account)', 'Errors', 'Lambda', 2, 3, 'spiky');
  add('Lambda · Throttles (account)', 'Throttles', 'Lambda', 0.5, 1, 'spiky');
  add('Lambda · ConcurrentExecutions', 'ConcurrentExecutions', 'Lambda', 40, 20);
  add('Lambda · Duration avg (account)', 'Duration', 'Lambda', 180, 90, null, 'Milliseconds');
  scan.services.lambda.items.slice(0, 14).forEach((f, i) => add(`λ ${f.name} · Invocations`, 'Invocations', 'Lambda', 20 + i * 15, 30, i % 4 === 0 ? 'spiky' : null));
  scan.services.dynamodb.items.slice(0, 6).forEach((t) => add(`DDB ${t.name} · Read CU`, 'ConsumedReadCapacityUnits', 'DynamoDB', 300, 200));
  scan.services.vpc.items[0].instances.slice(0, 8).forEach((x) => add(`EC2 ${x.name} · CPU %`, 'CPUUtilization', 'EC2', 35, 30, null, 'Percent'));
  add('RDS orders-aurora-1 · CPU %', 'CPUUtilization', 'RDS', 55, 25, null, 'Percent');
  add('API orders-api · Requests', 'Count', 'ApiGateway', 900, 300);
  add('SQS orders-dlq · Visible msgs', 'ApproximateNumberOfMessagesVisible', 'SQS', 3, 6, 'spiky');
  return {
    graphs,
    window: { start: new Date(now - 6 * 3600e3).toISOString(), end: new Date(now).toISOString(), period: Period },
    errors: [], callsUsed: 0, budgetLeft: 150, demo: true,
  };
}
