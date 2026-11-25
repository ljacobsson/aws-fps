# Grand Theft Auto Scaling — Data Center Technician Edition

A GTA-style 3D browser game where you play an AWS data center technician walking around
*your own* AWS account. Rooms, racks and doors are generated from what's actually deployed.
Everything is read-only.

```bash
npm install
npm start            # → http://localhost:8086
```

Pick a profile from `~/.aws/config` (SSO profiles get a 🔐) and a region, then **Clock in**.
If your SSO session has expired, the game offers to run `aws sso login --profile <name>` for you.
There is also a **Demo account** that works without credentials.

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrows | Move (`Shift` to sprint) |
| Mouse | Look (click the game to capture the mouse) |
| `V` | Toggle first-person ↔ bird's-eye view (mouse wheel zooms) |
| `E` | Inspect a resource, talk to a colleague, read a terminal |
| `F` | Pay respects (graveyard) |
| `L` | Teleport back to the lobby |
| `X` | Try to unplug something (you can't) |
| `N` | Mute · `H` help · `Esc` release the mouse / close panels |

Walk into an open door to go through it.

## The map

- **Lobby**: a door per service (Lambda, ECS, DynamoDB, RDS, ElastiCache, S3, SQS, SNS, EventBridge,
  Step Functions, API Gateway, CloudFront, Route 53, IAM, KMS, Secrets Manager, Log groups),
  plus the special areas below. Doors you lack permissions for are locked.
- **VPC Air Tunnel**: a cold-aisle tunnel with a door per VPC. Each VPC hall has fenced subnets
  (public/private, by AZ) holding EC2 instances, VPC Lambdas and NAT gateways, an Internet Gateway
  gate, and a security-group terminal.
- **CloudFormation Stacks**: a door vault with one door per stack, coloured by status. Each stack
  room is purpose-built from its resources, grouped into zones by service. It has the stack's
  parameters and outputs on the wall, a template terminal, and doors into nested stacks.
- **CloudWatch Surveillance Center**: walls of screens with real metric graphs, a spinning
  jumbotron, mission-control desks with alarm monitors, and red beacons when something is in ALARM.
- **Service Graveyard**: retired AWS services, your recently deleted stacks, and "undead" Lambda
  functions still on deprecated runtimes.

The HUD's "money" is your account ID, and the wanted stars count CloudWatch alarms in `ALARM`.

## What it calls (and what it costs)

Every AWS call goes through one allowlist in [server/readonly.js](server/readonly.js). Anything
that isn't a listed `Describe*`/`Get*`/`List*` operation is rejected before it's sent.

**Free control-plane reads:** STS `GetCallerIdentity`; EC2 `DescribeVpcs/Subnets/Instances/NatGateways/InternetGateways/RouteTables/SecurityGroups`;
Lambda `ListFunctions`, `GetFunctionConfiguration`; DynamoDB `ListTables`, `DescribeTable`;
RDS `DescribeDBInstances/DBClusters`; ElastiCache `DescribeCacheClusters`; ECS `ListClusters`, `DescribeClusters`, `ListServices`;
Step Functions `ListStateMachines`, `DescribeStateMachine`; API Gateway `GetRestApis`, `GetApis`;
EventBridge `ListEventBuses`, `ListRules`; CloudFront `ListDistributions`; Route 53 `ListHostedZones`;
IAM `ListRoles`, `ListUsers`; CloudFormation `ListStacks`, `DescribeStacks`, `ListStackResources`, `GetTemplate`.

**Deliberately not called**, because they're billed per request: S3 (`ListBuckets` is a LIST
request), SQS, SNS, KMS, Secrets Manager, CloudWatch `GetMetricData`, Cost Explorer. Buckets,
queues, topics, keys, secrets and log groups still appear when they were created by
CloudFormation, because `ListStackResources` is free.

**The one exception — the surveillance room's graphs.** It uses CloudWatch `GetMetricStatistics`
and `DescribeAlarms`. These are covered by CloudWatch's free tier of 1M API requests/month,
which is shared across an AWS Organization. They're hard-capped per server session: 150
`GetMetricStatistics` calls and 10 `DescribeAlarms` pages. One visit uses at most 60 graph calls,
and results are cached for 10 minutes. Restarting the server resets the cap.

Other safety notes:

- The server binds to `127.0.0.1` and rejects requests whose `Host` isn't localhost.
- Lambda environment variable values are masked.
- Secret values are never fetched.

## License

MIT, see [LICENSE](LICENSE).
