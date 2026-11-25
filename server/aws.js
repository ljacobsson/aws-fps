import { fromIni } from '@aws-sdk/credential-providers';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import {
  EC2Client, DescribeVpcsCommand, DescribeSubnetsCommand, DescribeInstancesCommand,
  DescribeNatGatewaysCommand, DescribeInternetGatewaysCommand, DescribeRouteTablesCommand,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';
import { LambdaClient, ListFunctionsCommand, GetFunctionConfigurationCommand } from '@aws-sdk/client-lambda';
import { DynamoDBClient, ListTablesCommand, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { RDSClient, DescribeDBInstancesCommand, DescribeDBClustersCommand } from '@aws-sdk/client-rds';
import { ElastiCacheClient, DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache';
import { ECSClient, ListClustersCommand, DescribeClustersCommand, ListServicesCommand } from '@aws-sdk/client-ecs';
import { SFNClient, ListStateMachinesCommand, DescribeStateMachineCommand } from '@aws-sdk/client-sfn';
import { APIGatewayClient, GetRestApisCommand } from '@aws-sdk/client-api-gateway';
import { ApiGatewayV2Client, GetApisCommand } from '@aws-sdk/client-apigatewayv2';
import { EventBridgeClient, ListEventBusesCommand, ListRulesCommand } from '@aws-sdk/client-eventbridge';
import { CloudFrontClient, ListDistributionsCommand } from '@aws-sdk/client-cloudfront';
import { Route53Client, ListHostedZonesCommand } from '@aws-sdk/client-route-53';
import { IAMClient, ListRolesCommand, ListUsersCommand } from '@aws-sdk/client-iam';
import {
  CloudFormationClient, ListStacksCommand, DescribeStacksCommand, ListStackResourcesCommand,
  GetTemplateCommand,
} from '@aws-sdk/client-cloudformation';
import { CloudWatchClient, DescribeAlarmsCommand, GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { safeSend, budgetRemaining } from './readonly.js';

const MAX_PER_SERVICE = 400;
const MAX_STACKS_WITH_RESOURCES = 250;

const credentialCache = new Map();

export function credentialsFor(profile) {
  if (!credentialCache.has(profile)) credentialCache.set(profile, fromIni({ profile }));
  return credentialCache.get(profile);
}

export function forgetCredentials(profile) {
  credentialCache.delete(profile);
}

function clientFactory(profile, region) {
  const credentials = credentialsFor(profile);
  const cache = new Map();
  return (Ctor, regionOverride) => {
    const key = `${Ctor.name}:${regionOverride || region}`;
    if (!cache.has(key)) {
      cache.set(key, new Ctor({
        region: regionOverride || region,
        credentials,
        maxAttempts: 6,
        retryMode: 'adaptive',
      }));
    }
    return cache.get(key);
  };
}

/** Follow NextToken/Marker style pagination with a hard cap. */
async function paginate(fetchPage, { tokenIn, tokenOut = tokenIn, itemsKey, max = MAX_PER_SERVICE }) {
  const items = [];
  let token;
  do {
    const res = await fetchPage(token ? { [tokenIn]: token } : {});
    items.push(...(res[itemsKey] || []));
    token = res[tokenOut];
  } while (token && items.length < max);
  return items.slice(0, max);
}

async function mapLimit(list, limit, fn) {
  const out = new Array(list.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (i < list.length) {
      const idx = i++;
      try { out[idx] = await fn(list[idx], idx); } catch (e) { out[idx] = { __error: e }; }
    }
  });
  await Promise.all(workers);
  return out;
}

const tagName = (tags) => (tags || []).find((t) => t.Key === 'Name')?.Value;

export function friendlyError(e) {
  const name = e?.name || 'Error';
  const msg = e?.message || String(e);
  if (/token.*(expired|invalid)|SSO session|refresh failed|Unable to load SSO|could not load credentials|ExpiredToken|The SSO session/i.test(msg + name)) {
    return { code: 'SSO_LOGIN_REQUIRED', message: msg };
  }
  if (/AccessDenied|UnauthorizedOperation|not authorized/i.test(msg + name)) {
    return { code: 'ACCESS_DENIED', message: msg };
  }
  return { code: name, message: msg };
}

export async function whoAmI(profile, region) {
  const client = clientFactory(profile, region || 'us-east-1');
  const res = await safeSend('sts', client(STSClient), new GetCallerIdentityCommand({}));
  return { accountId: res.Account, arn: res.Arn, userId: res.UserId };
}

// ---------------------------------------------------------------------------
// Scanners. Each returns { items: [...] } of normalised resources:
//   { id, name, kind, sub, status, info }
// ---------------------------------------------------------------------------

const DEPRECATED_RUNTIMES = new Set([
  'nodejs', 'nodejs4.3', 'nodejs4.3-edge', 'nodejs6.10', 'nodejs8.10', 'nodejs10.x', 'nodejs12.x',
  'nodejs14.x', 'nodejs16.x', 'nodejs18.x', 'python2.7', 'python3.6', 'python3.7', 'python3.8', 'python3.9',
  'dotnetcore1.0', 'dotnetcore2.0', 'dotnetcore2.1', 'dotnetcore3.1', 'dotnet5.0', 'dotnet6', 'dotnet7',
  'ruby2.5', 'ruby2.7', 'ruby3.2', 'java8', 'go1.x', 'provided',
]);

function maskEnv(env) {
  if (!env?.Variables) return env;
  return {
    ...env,
    Variables: Object.fromEntries(Object.keys(env.Variables).map((k) => [k, '•••• (masked by the intern)'])),
  };
}

async function scanLambda(c) {
  const fns = await paginate(
    (p) => safeSend('lambda', c(LambdaClient), new ListFunctionsCommand(p)),
    { tokenIn: 'Marker', tokenOut: 'NextMarker', itemsKey: 'Functions' },
  );
  return {
    items: fns.map((f) => ({
      id: f.FunctionArn,
      name: f.FunctionName,
      kind: 'lambda',
      sub: f.Runtime || f.PackageType,
      status: f.State || 'Active',
      deprecated: DEPRECATED_RUNTIMES.has(f.Runtime),
      subnets: f.VpcConfig?.SubnetIds || [],
      vpcId: f.VpcConfig?.VpcId || null,
      info: {
        Runtime: f.Runtime, Handler: f.Handler, MemorySize: f.MemorySize, Timeout: f.Timeout,
        CodeSize: f.CodeSize, Architectures: f.Architectures, PackageType: f.PackageType,
        LastModified: f.LastModified, Description: f.Description, Role: f.Role,
        Environment: maskEnv(f.Environment), VpcConfig: f.VpcConfig, Layers: f.Layers,
        EphemeralStorage: f.EphemeralStorage, TracingConfig: f.TracingConfig,
      },
    })),
  };
}

async function scanDynamo(c) {
  const names = await paginate(
    (p) => safeSend('dynamodb', c(DynamoDBClient), new ListTablesCommand(p)),
    { tokenIn: 'ExclusiveStartTableName', tokenOut: 'LastEvaluatedTableName', itemsKey: 'TableNames' },
  );
  const described = await mapLimit(names.slice(0, 100), 6, (TableName) =>
    safeSend('dynamodb', c(DynamoDBClient), new DescribeTableCommand({ TableName })));
  return {
    items: names.map((name, i) => {
      const t = described[i]?.Table;
      return {
        id: t?.TableArn || name,
        name,
        kind: 'dynamodb',
        sub: t?.BillingModeSummary?.BillingMode || (t ? 'PROVISIONED' : undefined),
        status: t?.TableStatus || 'ACTIVE',
        info: t ? {
          TableStatus: t.TableStatus, ItemCount: t.ItemCount, TableSizeBytes: t.TableSizeBytes,
          KeySchema: t.KeySchema, AttributeDefinitions: t.AttributeDefinitions,
          BillingMode: t.BillingModeSummary?.BillingMode || 'PROVISIONED',
          ProvisionedThroughput: t.ProvisionedThroughput,
          GlobalSecondaryIndexes: t.GlobalSecondaryIndexes?.map((g) => ({ IndexName: g.IndexName, KeySchema: g.KeySchema })),
          StreamSpecification: t.StreamSpecification, DeletionProtectionEnabled: t.DeletionProtectionEnabled,
          CreationDateTime: t.CreationDateTime, TableClass: t.TableClassSummary?.TableClass,
        } : { note: 'Not described (only the first 100 tables are described during the scan).' },
        size: t?.TableSizeBytes || 0,
      };
    }),
  };
}

async function scanRds(c) {
  const [instances, clusters] = await Promise.all([
    paginate((p) => safeSend('rds', c(RDSClient), new DescribeDBInstancesCommand(p)), { tokenIn: 'Marker', itemsKey: 'DBInstances' }),
    paginate((p) => safeSend('rds', c(RDSClient), new DescribeDBClustersCommand(p)), { tokenIn: 'Marker', itemsKey: 'DBClusters' }),
  ]);
  return {
    items: [
      ...clusters.map((d) => ({
        id: d.DBClusterArn, name: d.DBClusterIdentifier, kind: 'rds', sub: `${d.Engine} cluster`, status: d.Status,
        info: {
          Engine: d.Engine, EngineVersion: d.EngineVersion, EngineMode: d.EngineMode, Status: d.Status,
          Endpoint: d.Endpoint, ReaderEndpoint: d.ReaderEndpoint, MultiAZ: d.MultiAZ,
          Members: d.DBClusterMembers?.map((m) => m.DBInstanceIdentifier), StorageEncrypted: d.StorageEncrypted,
          ServerlessV2ScalingConfiguration: d.ServerlessV2ScalingConfiguration, DeletionProtection: d.DeletionProtection,
        },
      })),
      ...instances.map((d) => ({
        id: d.DBInstanceArn, name: d.DBInstanceIdentifier, kind: 'rds', sub: `${d.Engine} ${d.DBInstanceClass}`, status: d.DBInstanceStatus,
        vpcId: d.DBSubnetGroup?.VpcId,
        info: {
          Engine: d.Engine, EngineVersion: d.EngineVersion, DBInstanceClass: d.DBInstanceClass,
          Status: d.DBInstanceStatus, AllocatedStorage: d.AllocatedStorage, MultiAZ: d.MultiAZ,
          Endpoint: d.Endpoint, AvailabilityZone: d.AvailabilityZone, Cluster: d.DBClusterIdentifier,
          PubliclyAccessible: d.PubliclyAccessible, StorageEncrypted: d.StorageEncrypted, VpcId: d.DBSubnetGroup?.VpcId,
        },
      })),
    ],
  };
}

async function scanElastiCache(c) {
  const clusters = await paginate(
    (p) => safeSend('elasticache', c(ElastiCacheClient), new DescribeCacheClustersCommand(p)),
    { tokenIn: 'Marker', itemsKey: 'CacheClusters' },
  );
  return {
    items: clusters.map((x) => ({
      id: x.ARN || x.CacheClusterId, name: x.CacheClusterId, kind: 'elasticache',
      sub: `${x.Engine} ${x.CacheNodeType}`, status: x.CacheClusterStatus,
      info: {
        Engine: x.Engine, EngineVersion: x.EngineVersion, CacheNodeType: x.CacheNodeType, NumCacheNodes: x.NumCacheNodes,
        Status: x.CacheClusterStatus, PreferredAvailabilityZone: x.PreferredAvailabilityZone, ReplicationGroupId: x.ReplicationGroupId,
      },
    })),
  };
}

async function scanEcs(c) {
  const arns = await paginate((p) => safeSend('ecs', c(ECSClient), new ListClustersCommand(p)), { tokenIn: 'nextToken', itemsKey: 'clusterArns' });
  const clusters = [];
  for (let i = 0; i < arns.length; i += 100) {
    const res = await safeSend('ecs', c(ECSClient), new DescribeClustersCommand({ clusters: arns.slice(i, i + 100) }));
    clusters.push(...(res.clusters || []));
  }
  const services = await mapLimit(clusters.slice(0, 40), 4, (cl) =>
    paginate((p) => safeSend('ecs', c(ECSClient), new ListServicesCommand({ cluster: cl.clusterArn, ...p })), { tokenIn: 'nextToken', itemsKey: 'serviceArns', max: 50 }));
  return {
    items: clusters.map((cl, i) => ({
      id: cl.clusterArn, name: cl.clusterName, kind: 'ecs', sub: `${cl.runningTasksCount} running tasks`, status: cl.status,
      info: {
        Status: cl.status, RunningTasks: cl.runningTasksCount, PendingTasks: cl.pendingTasksCount,
        ActiveServices: cl.activeServicesCount, ContainerInstances: cl.registeredContainerInstancesCount,
        CapacityProviders: cl.capacityProviders,
        Services: Array.isArray(services[i]) ? services[i].map((a) => a.split('/').pop()) : undefined,
      },
      count: cl.activeServicesCount || 1,
    })),
  };
}

async function scanSfn(c) {
  const sms = await paginate((p) => safeSend('sfn', c(SFNClient), new ListStateMachinesCommand(p)), { tokenIn: 'nextToken', itemsKey: 'stateMachines' });
  return {
    items: sms.map((s) => ({
      id: s.stateMachineArn, name: s.name, kind: 'sfn', sub: s.type, status: 'ACTIVE',
      info: { Type: s.type, CreationDate: s.creationDate, StateMachineArn: s.stateMachineArn },
    })),
  };
}

async function scanApiGateway(c) {
  const [rest, v2] = await Promise.all([
    paginate((p) => safeSend('apigateway', c(APIGatewayClient), new GetRestApisCommand(p)), { tokenIn: 'position', itemsKey: 'items' }),
    paginate((p) => safeSend('apigatewayv2', c(ApiGatewayV2Client), new GetApisCommand(p)), { tokenIn: 'NextToken', itemsKey: 'Items' }),
  ]);
  return {
    items: [
      ...rest.map((a) => ({
        id: a.id, name: a.name, kind: 'apigw', sub: `REST ${a.endpointConfiguration?.types?.join(',') || ''}`.trim(), status: 'DEPLOYED',
        info: { Id: a.id, Type: 'REST', Description: a.description, CreatedDate: a.createdDate, EndpointConfiguration: a.endpointConfiguration, ApiKeySource: a.apiKeySource, Tags: a.tags },
      })),
      ...v2.map((a) => ({
        id: a.ApiId, name: a.Name, kind: 'apigw', sub: a.ProtocolType, status: 'DEPLOYED',
        info: { Id: a.ApiId, Type: a.ProtocolType, Endpoint: a.ApiEndpoint, Description: a.Description, CreatedDate: a.CreatedDate, RouteSelectionExpression: a.RouteSelectionExpression, Tags: a.Tags },
      })),
    ],
  };
}

async function scanEventBridge(c) {
  const buses = await paginate((p) => safeSend('eventbridge', c(EventBridgeClient), new ListEventBusesCommand(p)), { tokenIn: 'NextToken', itemsKey: 'EventBuses' });
  const rules = await mapLimit(buses.slice(0, 20), 3, (b) =>
    paginate((p) => safeSend('eventbridge', c(EventBridgeClient), new ListRulesCommand({ EventBusName: b.Name, ...p })), { tokenIn: 'NextToken', itemsKey: 'Rules', max: 200 }));
  const items = [];
  buses.forEach((b, i) => {
    items.push({ id: b.Arn, name: b.Name, kind: 'eventbridge', sub: 'event bus', status: 'ACTIVE', info: { Arn: b.Arn, Description: b.Description } });
    (Array.isArray(rules[i]) ? rules[i] : []).forEach((r) => items.push({
      id: r.Arn, name: r.Name, kind: 'eventbridge', sub: r.ScheduleExpression ? 'scheduled rule' : 'rule', status: r.State,
      info: { Bus: b.Name, State: r.State, ScheduleExpression: r.ScheduleExpression, EventPattern: safeJson(r.EventPattern), Description: r.Description, ManagedBy: r.ManagedBy },
    }));
  });
  return { items };
}

async function scanCloudFront(c) {
  const res = await paginate(
    async (p) => {
      const r = await safeSend('cloudfront', c(CloudFrontClient, 'us-east-1'), new ListDistributionsCommand(p));
      return { Items: r.DistributionList?.Items || [], NextMarker: r.DistributionList?.IsTruncated ? r.DistributionList.NextMarker : undefined };
    },
    { tokenIn: 'Marker', tokenOut: 'NextMarker', itemsKey: 'Items' },
  );
  return {
    items: res.map((d) => ({
      id: d.ARN, name: d.Aliases?.Items?.[0] || d.DomainName, kind: 'cloudfront', sub: d.DomainName, status: d.Status,
      info: {
        Id: d.Id, DomainName: d.DomainName, Aliases: d.Aliases?.Items, Enabled: d.Enabled, Status: d.Status, PriceClass: d.PriceClass,
        Origins: d.Origins?.Items?.map((o) => o.DomainName), HttpVersion: d.HttpVersion, WebACLId: d.WebACLId || undefined,
      },
    })),
  };
}

async function scanRoute53(c) {
  const zones = await paginate((p) => safeSend('route53', c(Route53Client, 'us-east-1'), new ListHostedZonesCommand(p)), { tokenIn: 'Marker', tokenOut: 'NextMarker', itemsKey: 'HostedZones' });
  return {
    items: zones.map((z) => ({
      id: z.Id, name: z.Name, kind: 'route53', sub: z.Config?.PrivateZone ? 'private zone' : 'public zone', status: 'ACTIVE',
      info: { Id: z.Id, Name: z.Name, RecordSetCount: z.ResourceRecordSetCount, PrivateZone: z.Config?.PrivateZone, Comment: z.Config?.Comment },
    })),
  };
}

async function scanIam(c) {
  const [roles, users] = await Promise.all([
    paginate((p) => safeSend('iam', c(IAMClient, 'us-east-1'), new ListRolesCommand(p)), { tokenIn: 'Marker', itemsKey: 'Roles' }),
    paginate((p) => safeSend('iam', c(IAMClient, 'us-east-1'), new ListUsersCommand(p)), { tokenIn: 'Marker', itemsKey: 'Users' }),
  ]);
  return {
    items: [
      ...users.map((u) => ({
        id: u.Arn, name: u.UserName, kind: 'iam', sub: 'user', status: 'ACTIVE',
        info: { Arn: u.Arn, Path: u.Path, CreateDate: u.CreateDate, PasswordLastUsed: u.PasswordLastUsed },
      })),
      ...roles.map((r) => ({
        id: r.Arn, name: r.RoleName, kind: 'iam', sub: r.Path?.startsWith('/aws-service-role/') ? 'service-linked role' : 'role', status: 'ACTIVE',
        info: {
          Arn: r.Arn, Path: r.Path, CreateDate: r.CreateDate, Description: r.Description, MaxSessionDuration: r.MaxSessionDuration,
          AssumeRolePolicyDocument: safeJson(decodeURIComponent(r.AssumeRolePolicyDocument || '')),
        },
      })),
    ],
  };
}

async function scanNetwork(c) {
  const ec2 = () => c(EC2Client);
  const [vpcs, subnets, reservations, nats, igws, routeTables, sgs] = await Promise.all([
    paginate((p) => safeSend('ec2', ec2(), new DescribeVpcsCommand(p)), { tokenIn: 'NextToken', itemsKey: 'Vpcs' }),
    paginate((p) => safeSend('ec2', ec2(), new DescribeSubnetsCommand(p)), { tokenIn: 'NextToken', itemsKey: 'Subnets', max: 1000 }),
    paginate((p) => safeSend('ec2', ec2(), new DescribeInstancesCommand(p)), { tokenIn: 'NextToken', itemsKey: 'Reservations', max: 1000 }),
    paginate((p) => safeSend('ec2', ec2(), new DescribeNatGatewaysCommand(p)), { tokenIn: 'NextToken', itemsKey: 'NatGateways' }),
    paginate((p) => safeSend('ec2', ec2(), new DescribeInternetGatewaysCommand(p)), { tokenIn: 'NextToken', itemsKey: 'InternetGateways' }),
    paginate((p) => safeSend('ec2', ec2(), new DescribeRouteTablesCommand(p)), { tokenIn: 'NextToken', itemsKey: 'RouteTables', max: 1000 }),
    paginate((p) => safeSend('ec2', ec2(), new DescribeSecurityGroupsCommand(p)), { tokenIn: 'NextToken', itemsKey: 'SecurityGroups', max: 1000 }),
  ]);

  // A subnet is "public" if its route table (explicit or the VPC main table) routes 0.0.0.0/0 to an IGW.
  const mainTable = new Map();
  const explicitTable = new Map();
  for (const rt of routeTables) {
    for (const a of rt.Associations || []) {
      if (a.Main) mainTable.set(rt.VpcId, rt);
      if (a.SubnetId) explicitTable.set(a.SubnetId, rt);
    }
  }
  const isPublic = (s) => {
    const rt = explicitTable.get(s.SubnetId) || mainTable.get(s.VpcId);
    return Boolean(rt?.Routes?.some((r) => r.DestinationCidrBlock === '0.0.0.0/0' && r.GatewayId?.startsWith('igw-')));
  };

  const instances = reservations.flatMap((r) => r.Instances || []).filter((i) => i.State?.Name !== 'terminated');

  return {
    items: vpcs.map((v) => ({
      id: v.VpcId,
      name: tagName(v.Tags) || (v.IsDefault ? 'default VPC' : v.VpcId),
      kind: 'vpc',
      sub: v.CidrBlock,
      status: v.State,
      isDefault: v.IsDefault,
      info: { VpcId: v.VpcId, CidrBlock: v.CidrBlock, IsDefault: v.IsDefault, State: v.State, Tags: v.Tags, DhcpOptionsId: v.DhcpOptionsId },
      subnets: subnets.filter((s) => s.VpcId === v.VpcId).map((s) => ({
        id: s.SubnetId, name: tagName(s.Tags) || s.SubnetId, kind: 'subnet', sub: s.CidrBlock, az: s.AvailabilityZone,
        public: isPublic(s),
        info: { SubnetId: s.SubnetId, CidrBlock: s.CidrBlock, AvailabilityZone: s.AvailabilityZone, AvailableIpAddressCount: s.AvailableIpAddressCount, MapPublicIpOnLaunch: s.MapPublicIpOnLaunch, Tags: s.Tags },
      })),
      instances: instances.filter((i) => i.VpcId === v.VpcId).map((i) => ({
        id: i.InstanceId, name: tagName(i.Tags) || i.InstanceId, kind: 'ec2', sub: i.InstanceType, status: i.State?.Name,
        subnetId: i.SubnetId,
        info: {
          InstanceId: i.InstanceId, InstanceType: i.InstanceType, State: i.State?.Name, LaunchTime: i.LaunchTime,
          PrivateIpAddress: i.PrivateIpAddress, PublicIpAddress: i.PublicIpAddress, ImageId: i.ImageId,
          Platform: i.PlatformDetails, Architecture: i.Architecture, SubnetId: i.SubnetId,
          SecurityGroups: i.SecurityGroups, IamInstanceProfile: i.IamInstanceProfile?.Arn, Tags: i.Tags,
        },
      })),
      natGateways: nats.filter((n) => n.VpcId === v.VpcId && n.State !== 'deleted').map((n) => ({
        id: n.NatGatewayId, name: tagName(n.Tags) || n.NatGatewayId, kind: 'nat', sub: n.ConnectivityType, status: n.State, subnetId: n.SubnetId,
        info: { NatGatewayId: n.NatGatewayId, State: n.State, SubnetId: n.SubnetId, ConnectivityType: n.ConnectivityType, Addresses: n.NatGatewayAddresses?.map((a) => a.PublicIp || a.PrivateIp) },
      })),
      internetGateways: igws.filter((g) => g.Attachments?.some((a) => a.VpcId === v.VpcId)).map((g) => ({
        id: g.InternetGatewayId, name: tagName(g.Tags) || g.InternetGatewayId, kind: 'igw', status: 'attached',
        info: { InternetGatewayId: g.InternetGatewayId, Tags: g.Tags },
      })),
      securityGroups: sgs.filter((s) => s.VpcId === v.VpcId).map((s) => ({
        id: s.GroupId, name: s.GroupName, description: s.Description,
        ingress: (s.IpPermissions || []).map(describePermission),
        egress: (s.IpPermissionsEgress || []).map(describePermission),
      })),
    })),
  };
}

function describePermission(p) {
  const port = p.IpProtocol === '-1' ? 'all traffic' : `${p.IpProtocol} ${p.FromPort === p.ToPort ? p.FromPort : `${p.FromPort}-${p.ToPort}`}`;
  const sources = [
    ...(p.IpRanges || []).map((r) => r.CidrIp),
    ...(p.Ipv6Ranges || []).map((r) => r.CidrIpv6),
    ...(p.UserIdGroupPairs || []).map((g) => g.GroupId),
    ...(p.PrefixListIds || []).map((g) => g.PrefixListId),
  ];
  return `${port} ← ${sources.join(', ') || '(nobody)'}`;
}

async function scanAlarms(c) {
  const alarms = await paginate(
    (p) => safeSend('cloudwatch', c(CloudWatchClient), new DescribeAlarmsCommand({ MaxRecords: 100, ...p })),
    { tokenIn: 'NextToken', itemsKey: 'MetricAlarms', max: 300 },
  );
  return {
    items: alarms.map((a) => ({
      id: a.AlarmArn, name: a.AlarmName, kind: 'alarm', sub: `${a.Namespace || ''} ${a.MetricName || ''}`.trim(), status: a.StateValue,
      info: {
        StateValue: a.StateValue, StateReason: a.StateReason, StateUpdatedTimestamp: a.StateUpdatedTimestamp,
        Namespace: a.Namespace, MetricName: a.MetricName, Dimensions: a.Dimensions, Statistic: a.Statistic,
        Period: a.Period, Threshold: a.Threshold, ComparisonOperator: a.ComparisonOperator, EvaluationPeriods: a.EvaluationPeriods,
        ActionsEnabled: a.ActionsEnabled, AlarmActions: a.AlarmActions, AlarmDescription: a.AlarmDescription,
      },
    })),
  };
}

const ACTIVE_STACK_STATUSES = [
  'CREATE_IN_PROGRESS', 'CREATE_FAILED', 'CREATE_COMPLETE', 'ROLLBACK_IN_PROGRESS', 'ROLLBACK_FAILED', 'ROLLBACK_COMPLETE',
  'DELETE_IN_PROGRESS', 'DELETE_FAILED', 'UPDATE_IN_PROGRESS', 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS', 'UPDATE_COMPLETE',
  'UPDATE_FAILED', 'UPDATE_ROLLBACK_IN_PROGRESS', 'UPDATE_ROLLBACK_FAILED', 'UPDATE_ROLLBACK_COMPLETE_CLEANUP_IN_PROGRESS',
  'UPDATE_ROLLBACK_COMPLETE', 'REVIEW_IN_PROGRESS', 'IMPORT_IN_PROGRESS', 'IMPORT_COMPLETE', 'IMPORT_ROLLBACK_IN_PROGRESS',
  'IMPORT_ROLLBACK_FAILED', 'IMPORT_ROLLBACK_COMPLETE',
];

function stackSummary(s) {
  return {
    id: s.StackId, name: s.StackName, kind: 'cfnStack', status: s.StackStatus,
    nested: Boolean(s.ParentId), parentId: s.ParentId || null,
    info: {
      StackName: s.StackName, StackStatus: s.StackStatus, StackStatusReason: s.StackStatusReason, TemplateDescription: s.TemplateDescription,
      CreationTime: s.CreationTime, LastUpdatedTime: s.LastUpdatedTime, DeletionTime: s.DeletionTime,
      DriftStatus: s.DriftInformation?.StackDriftStatus, ParentId: s.ParentId, RootId: s.RootId,
    },
  };
}

async function scanStacks(c) {
  const cfn = () => c(CloudFormationClient);
  const [active, deleted] = await Promise.all([
    paginate((p) => safeSend('cloudformation', cfn(), new ListStacksCommand({ StackStatusFilter: ACTIVE_STACK_STATUSES, ...p })), { tokenIn: 'NextToken', itemsKey: 'StackSummaries', max: 1000 }),
    paginate((p) => safeSend('cloudformation', cfn(), new ListStacksCommand({ StackStatusFilter: ['DELETE_COMPLETE'], ...p })), { tokenIn: 'NextToken', itemsKey: 'StackSummaries', max: 120 }),
  ]);
  return { items: active.map(stackSummary), deleted: deleted.map(stackSummary) };
}

export async function listStackResources(c, stackName) {
  return paginate(
    (p) => safeSend('cloudformation', c(CloudFormationClient), new ListStackResourcesCommand({ StackName: stackName, ...p })),
    { tokenIn: 'NextToken', itemsKey: 'StackResourceSummaries', max: 1000 },
  );
}

// Resource types we can only discover through CloudFormation (their own List APIs are billed).
const CFN_ONLY_KINDS = {
  'AWS::S3::Bucket': 's3',
  'AWS::SQS::Queue': 'sqs',
  'AWS::SNS::Topic': 'sns',
  'AWS::KMS::Key': 'kms',
  'AWS::SecretsManager::Secret': 'secrets',
  'AWS::Logs::LogGroup': 'logs',
  'AWS::CloudWatch::Alarm': 'alarm',
};

function resourceName(type, physicalId) {
  if (!physicalId) return '(not created)';
  if (type === 'AWS::SQS::Queue') return physicalId.split('/').pop();
  if (physicalId.startsWith('arn:')) return physicalId.split(/[:/]/).pop();
  return physicalId;
}

// ---------------------------------------------------------------------------

export async function scanAccount({ profile, region, onProgress }) {
  const c = clientFactory(profile, region);
  const log = (msg) => onProgress?.({ msg });
  const identity = await whoAmI(profile, region);
  log(`Badge accepted: ${identity.arn}`);

  const scanners = {
    lambda: scanLambda, dynamodb: scanDynamo, rds: scanRds, elasticache: scanElastiCache, ecs: scanEcs,
    sfn: scanSfn, apigw: scanApiGateway, eventbridge: scanEventBridge, cloudfront: scanCloudFront,
    route53: scanRoute53, iam: scanIam, vpc: scanNetwork, cfn: scanStacks, alarm: scanAlarms,
  };
  const total = Object.keys(scanners).length + 1;
  let done = 0;
  const services = {};
  await Promise.all(Object.entries(scanners).map(async ([key, fn]) => {
    try {
      services[key] = await fn(c);
      log(`${key}: found ${services[key].items.length}`);
    } catch (e) {
      services[key] = { items: [], error: friendlyError(e) };
      log(`${key}: ${services[key].error.code}`);
    }
    onProgress?.({ progress: ++done / total });
  }));

  // Derive the CloudFormation-only services from stack resources (free!).
  const realAlarms = services.alarm;
  for (const kind of Object.values(CFN_ONLY_KINDS)) services[kind] = { items: [], viaCloudFormation: true };
  if (realAlarms && !realAlarms.error) services.alarm = { items: realAlarms.items };
  const stacks = services.cfn.items.filter((s) => !s.status.startsWith('DELETE'));
  const resources = await mapLimit(stacks.slice(0, MAX_STACKS_WITH_RESOURCES), 4, async (s, i) => {
    const r = await listStackResources(c, s.id);
    if (i % 10 === 0) log(`Reading stack resources… ${i}/${Math.min(stacks.length, MAX_STACKS_WITH_RESOURCES)}`);
    return r;
  });
  stacks.slice(0, MAX_STACKS_WITH_RESOURCES).forEach((s, i) => {
    const list = Array.isArray(resources[i]) ? resources[i] : [];
    s.resourceCount = list.length;
    s.resourceTypes = summariseTypes(list);
    for (const r of list) {
      const kind = CFN_ONLY_KINDS[r.ResourceType];
      if (!kind || !r.PhysicalResourceId) continue;
      if (kind === 'alarm' && !services.alarm.viaCloudFormation) continue; // already have the real ones
      services[kind].items.push({
        id: r.PhysicalResourceId, name: resourceName(r.ResourceType, r.PhysicalResourceId), kind,
        sub: `${s.name} / ${r.LogicalResourceId}`, status: r.ResourceStatus,
        info: {
          LogicalResourceId: r.LogicalResourceId, PhysicalResourceId: r.PhysicalResourceId, ResourceType: r.ResourceType,
          ResourceStatus: r.ResourceStatus, Stack: s.name, LastUpdatedTimestamp: r.LastUpdatedTimestamp,
          note: 'Discovered via CloudFormation — this service\'s own List/Describe APIs are billed per request, so we don\'t call them.',
        },
      });
    }
  });
  onProgress?.({ progress: 1 });

  const deprecatedLambdas = services.lambda.items.filter((f) => f.deprecated);

  return {
    meta: { profile, region, ...identity, scannedAt: new Date().toISOString(), demo: false },
    services,
    graveyard: { deletedStacks: services.cfn.deleted || [], deprecatedLambdas },
  };
}

function summariseTypes(list) {
  const counts = {};
  for (const r of list) counts[r.ResourceType] = (counts[r.ResourceType] || 0) + 1;
  return counts;
}

function safeJson(s) {
  if (!s) return s;
  try { return JSON.parse(s); } catch { return s; }
}

// ---------------------------------------------------------------------------
// On-demand details (still only free read calls)
// ---------------------------------------------------------------------------

export async function getDetails({ profile, region, kind, id }) {
  const c = clientFactory(profile, region);
  switch (kind) {
    case 'lambda': {
      const f = await safeSend('lambda', c(LambdaClient), new GetFunctionConfigurationCommand({ FunctionName: id }));
      delete f.$metadata;
      return { ...f, Environment: maskEnv(f.Environment) };
    }
    case 'dynamodb': {
      const name = id.includes(':table/') ? id.split(':table/')[1] : id;
      const t = await safeSend('dynamodb', c(DynamoDBClient), new DescribeTableCommand({ TableName: name }));
      return t.Table;
    }
    case 'sfn': {
      const s = await safeSend('sfn', c(SFNClient), new DescribeStateMachineCommand({ stateMachineArn: id }));
      delete s.$metadata;
      return { ...s, definition: safeJson(s.definition) };
    }
    case 'cfnStack': {
      const [desc, resources] = await Promise.all([
        safeSend('cloudformation', c(CloudFormationClient), new DescribeStacksCommand({ StackName: id })),
        listStackResources(c, id),
      ]);
      const s = desc.Stacks?.[0] || {};
      return {
        stack: {
          StackName: s.StackName, StackId: s.StackId, StackStatus: s.StackStatus, StackStatusReason: s.StackStatusReason,
          Description: s.Description, CreationTime: s.CreationTime, LastUpdatedTime: s.LastUpdatedTime,
          Parameters: s.Parameters, Outputs: s.Outputs, Tags: s.Tags, Capabilities: s.Capabilities,
          TerminationProtection: s.EnableTerminationProtection, DriftStatus: s.DriftInformation?.StackDriftStatus,
          ParentId: s.ParentId, RootId: s.RootId,
        },
        resources: resources.map((r) => ({
          LogicalResourceId: r.LogicalResourceId, PhysicalResourceId: r.PhysicalResourceId, ResourceType: r.ResourceType,
          ResourceStatus: r.ResourceStatus, LastUpdatedTimestamp: r.LastUpdatedTimestamp, DriftStatus: r.DriftInformation?.StackResourceDriftStatus,
        })),
      };
    }
    case 'cfnTemplate': {
      const t = await safeSend('cloudformation', c(CloudFormationClient), new GetTemplateCommand({ StackName: id, TemplateStage: 'Original' }));
      return { TemplateBody: typeof t.TemplateBody === 'string' ? t.TemplateBody : JSON.stringify(t.TemplateBody, null, 2) };
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// CloudWatch graphs for the surveillance room.
// GetMetricStatistics only (never the always-billed GetMetricData), capped per fetch and per
// server session, and cached so walking in and out of the room doesn't spend more calls.
// ---------------------------------------------------------------------------

const MAX_GRAPHS_PER_FETCH = 60;
const METRIC_CACHE_MS = 10 * 60 * 1000;
const metricCache = new Map();

function planMetrics(scan) {
  const s = scan.services;
  const plan = [];
  const add = (title, Namespace, MetricName, Dimensions, Statistic, group) =>
    plan.push({ title, Namespace, MetricName, Dimensions, Statistic, group });

  add('Lambda · Invocations (account)', 'AWS/Lambda', 'Invocations', [], 'Sum', 'Lambda');
  add('Lambda · Errors (account)', 'AWS/Lambda', 'Errors', [], 'Sum', 'Lambda');
  add('Lambda · Throttles (account)', 'AWS/Lambda', 'Throttles', [], 'Sum', 'Lambda');
  add('Lambda · ConcurrentExecutions', 'AWS/Lambda', 'ConcurrentExecutions', [], 'Maximum', 'Lambda');
  add('Lambda · Duration avg (account)', 'AWS/Lambda', 'Duration', [], 'Average', 'Lambda');

  const fns = [...(s.lambda?.items || [])].sort((a, b) => String(b.info?.LastModified).localeCompare(String(a.info?.LastModified)));
  fns.slice(0, 14).forEach((f) => add(`λ ${f.name} · Invocations`, 'AWS/Lambda', 'Invocations', [{ Name: 'FunctionName', Value: f.name }], 'Sum', 'Lambda'));
  fns.slice(0, 6).forEach((f) => add(`λ ${f.name} · Duration`, 'AWS/Lambda', 'Duration', [{ Name: 'FunctionName', Value: f.name }], 'Average', 'Lambda'));
  (s.dynamodb?.items || []).slice(0, 6).forEach((t) => {
    add(`DDB ${t.name} · Read CU`, 'AWS/DynamoDB', 'ConsumedReadCapacityUnits', [{ Name: 'TableName', Value: t.name }], 'Sum', 'DynamoDB');
    add(`DDB ${t.name} · Write CU`, 'AWS/DynamoDB', 'ConsumedWriteCapacityUnits', [{ Name: 'TableName', Value: t.name }], 'Sum', 'DynamoDB');
  });
  (s.vpc?.items || []).flatMap((v) => v.instances).filter((i) => i.status === 'running').slice(0, 8)
    .forEach((i) => add(`EC2 ${i.name} · CPU %`, 'AWS/EC2', 'CPUUtilization', [{ Name: 'InstanceId', Value: i.id }], 'Average', 'EC2'));
  (s.rds?.items || []).filter((d) => !d.sub?.endsWith('cluster')).slice(0, 4).forEach((d) => {
    add(`RDS ${d.name} · CPU %`, 'AWS/RDS', 'CPUUtilization', [{ Name: 'DBInstanceIdentifier', Value: d.name }], 'Average', 'RDS');
    add(`RDS ${d.name} · Connections`, 'AWS/RDS', 'DatabaseConnections', [{ Name: 'DBInstanceIdentifier', Value: d.name }], 'Maximum', 'RDS');
  });
  (s.apigw?.items || []).slice(0, 6).forEach((a) => {
    const dims = a.info?.Type === 'REST' ? [{ Name: 'ApiName', Value: a.name }] : [{ Name: 'ApiId', Value: a.id }];
    add(`API ${a.name} · Requests`, 'AWS/ApiGateway', 'Count', dims, 'Sum', 'API Gateway');
  });
  (s.sqs?.items || []).slice(0, 4).forEach((q) =>
    add(`SQS ${q.name} · Visible msgs`, 'AWS/SQS', 'ApproximateNumberOfMessagesVisible', [{ Name: 'QueueName', Value: q.name }], 'Maximum', 'SQS'));
  (s.sfn?.items || []).slice(0, 4).forEach((m) =>
    add(`SFN ${m.name} · Executions`, 'AWS/States', 'ExecutionsStarted', [{ Name: 'StateMachineArn', Value: m.id }], 'Sum', 'Step Functions'));
  return plan.slice(0, MAX_GRAPHS_PER_FETCH);
}

export async function getMetrics({ profile, region, scan }) {
  const key = `${profile}:${region}`;
  const cached = metricCache.get(key);
  if (cached && Date.now() - cached.at < METRIC_CACHE_MS) return { ...cached.data, cached: true };

  const c = clientFactory(profile, region);
  const budget = budgetRemaining('cloudwatch:GetMetricStatistics');
  const plan = planMetrics(scan).slice(0, Math.max(0, budget));
  const EndTime = new Date();
  const StartTime = new Date(EndTime.getTime() - 6 * 3600 * 1000);
  const Period = 300;
  const results = await mapLimit(plan, 4, async (m) => {
    const res = await safeSend('cloudwatch', c(CloudWatchClient), new GetMetricStatisticsCommand({
      Namespace: m.Namespace, MetricName: m.MetricName, Dimensions: m.Dimensions,
      StartTime, EndTime, Period, Statistics: [m.Statistic],
    }));
    const byTime = new Map((res.Datapoints || []).map((d) => [Math.floor(d.Timestamp.getTime() / 1000 / Period), d[m.Statistic]]));
    const points = [];
    const startBucket = Math.floor(StartTime.getTime() / 1000 / Period);
    const endBucket = Math.floor(EndTime.getTime() / 1000 / Period);
    for (let b = startBucket; b <= endBucket; b++) {
      points.push(byTime.has(b) ? byTime.get(b) : (m.Statistic === 'Sum' ? 0 : null));
    }
    return { ...m, unit: res.Datapoints?.[0]?.Unit || '', points, hasData: byTime.size > 0 };
  });
  const graphs = results.filter((r) => r && !r.__error);
  const data = {
    graphs,
    window: { start: StartTime.toISOString(), end: EndTime.toISOString(), period: Period },
    errors: results.filter((r) => r?.__error).map((r) => friendlyError(r.__error).message).slice(0, 5),
    callsUsed: plan.length,
    budgetLeft: budgetRemaining('cloudwatch:GetMetricStatistics'),
  };
  metricCache.set(key, { at: Date.now(), data });
  return data;
}
