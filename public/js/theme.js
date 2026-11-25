// Service registry: colours follow the AWS architecture icon categories so the rooms
// feel familiar to anyone who has stared at too many architecture diagrams.

export const CAT = {
  compute: '#ED7100',
  storage: '#7AA116',
  database: '#C925D1',
  networking: '#8C4FFF',
  integration: '#E7157B',
  management: '#E7157B',
  security: '#DD344C',
  neutral: '#8b95a7',
};

export const AWS_ORANGE = '#FF9900';
export const SQUID_INK = '#232F3E';

export const SERVICES = {
  lambda: { title: 'AWS Lambda', short: 'Lambda', room: 'Lambda Function Hall', color: CAT.compute, category: 'Compute', flavor: 'Serverless: there are servers. They are right here. Shh.' },
  ecs: { title: 'Amazon ECS', short: 'ECS', room: 'Container Yard', color: CAT.compute, category: 'Containers', flavor: 'It worked on my container.' },
  dynamodb: { title: 'Amazon DynamoDB', short: 'DynamoDB', room: 'DynamoDB Rack Hall', color: CAT.database, category: 'Database', flavor: 'Single-table design: one table to rule them all, and in the GSI bind them.' },
  rds: { title: 'Amazon RDS', short: 'RDS', room: 'Relational Database Racks', color: CAT.database, category: 'Database', flavor: 'Multi-AZ: because one AZ of regret is not enough.' },
  elasticache: { title: 'Amazon ElastiCache', short: 'ElastiCache', room: 'ElastiCache Cold Room', color: CAT.database, category: 'Database', flavor: 'Two hard things: cache invalidation, naming things and off-by-one errors.' },
  s3: { title: 'Amazon S3', short: 'S3', room: 'S3 Bucket Warehouse', color: CAT.storage, category: 'Storage', flavor: '11 nines of durability. 0 nines of naming consistency.', viaCfn: true },
  sqs: { title: 'Amazon SQS', short: 'SQS', room: 'SQS Conveyor Floor', color: CAT.integration, category: 'Application Integration', flavor: 'At-least-once delivery. At-least-twice if you are unlucky.', viaCfn: true },
  sns: { title: 'Amazon SNS', short: 'SNS', room: 'SNS Broadcast Tower', color: CAT.integration, category: 'Application Integration', flavor: 'Fan-out: like office gossip, but with retries.', viaCfn: true },
  eventbridge: { title: 'Amazon EventBridge', short: 'EventBridge', room: 'EventBridge Switchyard', color: CAT.integration, category: 'Application Integration', flavor: 'Loosely coupled. Like my sleep schedule.' },
  sfn: { title: 'AWS Step Functions', short: 'Step Functions', room: 'Step Functions Workshop', color: CAT.integration, category: 'Application Integration', flavor: 'Retry. Catch. Retry. Cry. Retry.' },
  apigw: { title: 'Amazon API Gateway', short: 'API Gateway', room: 'API Gateway Turnstiles', color: CAT.networking, category: 'Networking', flavor: '29 seconds. That is all you get. Make them count.' },
  cloudfront: { title: 'Amazon CloudFront', short: 'CloudFront', room: 'CloudFront Edge Lounge', color: CAT.networking, category: 'Networking', flavor: 'Cache hit ratio: 3%. Ship it.' },
  route53: { title: 'Amazon Route 53', short: 'Route 53', room: 'Route 53 DNS Shrine', color: CAT.networking, category: 'Networking', flavor: 'It is not DNS. There is no way it is DNS. It was DNS.' },
  iam: { title: 'AWS IAM', short: 'IAM', room: 'IAM Security Office', color: CAT.security, category: 'Security', flavor: '"Action": "*", "Resource": "*" — every tutorial, ever.' },
  kms: { title: 'AWS KMS', short: 'KMS', room: 'KMS Key Vault', color: CAT.security, category: 'Security', flavor: 'Your keys, our HSMs, their compliance audit.', viaCfn: true },
  secrets: { title: 'AWS Secrets Manager', short: 'Secrets', room: 'Secrets Manager Safe Room', color: CAT.security, category: 'Security', flavor: 'Values not shown. Someone committed the .env file anyway.', viaCfn: true },
  logs: { title: 'Amazon CloudWatch Logs', short: 'Logs', room: 'Log Group Archives', color: CAT.management, category: 'Management', flavor: 'Retention: Never expire. The bill: also never expires.', viaCfn: true },
  alarm: { title: 'Amazon CloudWatch', short: 'CloudWatch', room: 'CloudWatch Surveillance Center', color: CAT.management, category: 'Management', flavor: 'We are watching. Mostly the 5xx graph.' },
  vpc: { title: 'Amazon VPC', short: 'VPC', room: 'VPC Air Tunnel', color: CAT.networking, category: 'Networking', flavor: 'Cold aisle containment for your private networks.' },
  cfn: { title: 'AWS CloudFormation', short: 'CloudFormation', room: 'CloudFormation Stacks', color: CAT.management, category: 'Management', flavor: 'Infrastructure as code. Drift as a lifestyle.' },
  ec2: { title: 'Amazon EC2', short: 'EC2', color: CAT.compute, category: 'Compute' },
  subnet: { title: 'Subnet', short: 'Subnet', color: CAT.networking },
  nat: { title: 'NAT Gateway', short: 'NAT', color: CAT.networking },
  igw: { title: 'Internet Gateway', short: 'IGW', color: CAT.networking },
  net: { title: 'Network resource', short: 'Network', color: CAT.networking },
  cfnStack: { title: 'CloudFormation Stack', short: 'Stack', color: CAT.management },
  generic: { title: 'Resource', short: 'Resource', color: '#b07c3c' },
  grave: { title: 'Retired service', short: 'RIP', color: '#7a8190' },
  npc: { title: 'Colleague', short: 'NPC', color: AWS_ORANGE },
  kiosk: { title: 'Terminal', short: 'Terminal', color: '#3fb6ff' },
};

// Map CloudFormation resource types to prop kinds.
export function typeToKind(type = '') {
  const [, ns = '', res = ''] = type.split('::');
  const exact = {
    'Lambda:Function': 'lambda', 'Serverless:Function': 'lambda',
    'DynamoDB:Table': 'dynamodb', 'DynamoDB:GlobalTable': 'dynamodb', 'Serverless:SimpleTable': 'dynamodb',
    'S3:Bucket': 's3', 'SQS:Queue': 'sqs', 'SNS:Topic': 'sns',
    'Events:Rule': 'eventbridge', 'Events:EventBus': 'eventbridge', 'Scheduler:Schedule': 'eventbridge',
    'StepFunctions:StateMachine': 'sfn', 'Serverless:StateMachine': 'sfn',
    'ApiGateway:RestApi': 'apigw', 'ApiGatewayV2:Api': 'apigw', 'Serverless:Api': 'apigw', 'Serverless:HttpApi': 'apigw',
    'IAM:Role': 'iam', 'IAM:User': 'iam', 'IAM:Policy': 'iam', 'IAM:ManagedPolicy': 'iam', 'IAM:InstanceProfile': 'iam',
    'KMS:Key': 'kms', 'KMS:Alias': 'kms', 'SecretsManager:Secret': 'secrets',
    'Logs:LogGroup': 'logs', 'CloudWatch:Alarm': 'alarm', 'CloudWatch:Dashboard': 'alarm',
    'EC2:Instance': 'ec2', 'RDS:DBInstance': 'rds', 'RDS:DBCluster': 'rds',
    'ECS:Cluster': 'ecs', 'ECS:Service': 'ecs', 'ECS:TaskDefinition': 'ecs',
    'CloudFront:Distribution': 'cloudfront', 'Route53:HostedZone': 'route53', 'Route53:RecordSet': 'route53',
    'ElastiCache:CacheCluster': 'elasticache', 'ElastiCache:ReplicationGroup': 'elasticache', 'ElastiCache:ServerlessCache': 'elasticache',
    'CloudFormation:Stack': 'cfnStack', 'Serverless:Application': 'cfnStack',
    'EC2:NatGateway': 'nat', 'EC2:InternetGateway': 'igw',
  };
  if (exact[`${ns}:${res}`]) return exact[`${ns}:${res}`];
  if (ns === 'EC2') return 'net';
  return 'generic';
}

export function serviceOfType(type = '') {
  return type.split('::')[1] || 'Other';
}

export function statusColor(status = '') {
  const s = String(status).toUpperCase();
  if (/FAILED|ALARM|ROLLBACK|STOPPED|ERROR|DELETE/.test(s) && !/OK/.test(s)) return '#ff3b3b';
  if (/PROGRESS|PENDING|INSUFFICIENT|STOPPING|MODIFYING|UPDATING|CREATING/.test(s)) return '#ffb020';
  return '#2fe37a';
}
