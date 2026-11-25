export const TIPS = [
  'Tip: It is always DNS.',
  'Tip: There is no cloud. It is just someone else\'s data center. Welcome to it.',
  'Tip: us-east-1 is down? Have you tried us-east-2?',
  'Tip: Your free tier expired three years ago.',
  'Tip: S3 bucket names are globally unique. So is your pain.',
  'Tip: Eventually consistent tips will appear eventually.',
  'Tip: Press V to switch between first-person and bird\'s eye. The birds have better IAM permissions.',
  'Tip: Everything fails, all the time. Especially on Fridays.',
  'Tip: A NAT Gateway costs more than your car insurance.',
  'Tip: Nobody knows what the CDKToolkit stack does. Nobody.',
  'Tip: Tag your resources. Future you is begging you.',
  'Tip: This game only uses free, read-only API calls. The intern still managed to cost $0.40.',
  'Tip: The Lambda cold start is a feature. It is called "mindfulness".',
  'Tip: Press F in the graveyard to pay respects.',
  'Tip: "Undifferentiated heavy lifting" — that is you, carrying racks.',
  'Tip: Day 1. It is always Day 1. Your on-call shift is also Day 1.',
  'Tip: When in doubt, add another layer of abstraction. Then a Step Function.',
  'Tip: A well-architected framework has six pillars. Your account has zero.',
];

export const PAGER = [
  ['PagerDuty', 'CPUUtilization > 99% on i-0b4d4ss. It is fine. It is always like that.'],
  ['PagerDuty', 'orders-dlq has 1 message. It has had 1 message since 2021.'],
  ['AWS Health', 'Increased error rates in us-east-1. We are investigating. (Grab popcorn.)'],
  ['Slack #general', 'Who launched a p5.48xlarge for "testing"?'],
  ['AWS Blog', '47 new features launched this morning. You are already behind.'],
  ['Trusted Advisor', 'You have 14 security groups open to 0.0.0.0/0 on port 22. Bold.'],
  ['Billing', 'Your forecasted bill is $∞. Please contact your TAM. And a therapist.'],
  ['Finance', 'Can you explain this line item called "NatGateway-Bytes"? We will wait.'],
  ['Slack #incidents', 'Root cause identified: someone ran `terraform apply` on a Friday.'],
  ['AWS Support', 'Thank you for your case. Have you tried turning the region off and on again?'],
  ['Security Hub', 'An S3 bucket named "backup-do-not-make-public" is public.'],
  ['Slack #random', 'Re:Invent tickets are sold out. So is my patience with YAML.'],
  ['CloudWatch', 'ALARM: HappinessIndex < 1 for 3 consecutive periods.'],
  ['Your manager', 'Quick sync? (It is never quick. It is never a sync.)'],
  ['Cost Anomaly Detection', 'Spend on "Lambda" increased 4000%. Somebody wrote a recursive function.'],
  ['Slack #platform', 'Reminder: Kubernetes is not a personality.'],
];

export const POSTERS = [
  ['CUSTOMER OBSESSION', 'They watch the status page. We watch them.'],
  ['DIVE DEEP', 'Into the CloudWatch logs. Bring a snorkel.'],
  ['BIAS FOR ACTION', 'Deploy first. Read the docs on the rollback.'],
  ['FRUGALITY', 'Turn off the dev environment on weekends. PLEASE.'],
  ['EVERYTHING FAILS', '“Everything fails, all the time.” Plan accordingly.'],
  ['IT\'S ALWAYS DNS', 'Days since last DNS incident: 0'],
  ['DAY 1', 'Every day is Day 1. That is why nothing is finished.'],
  ['DISAGREE & COMMIT', 'git commit -m "I disagree"'],
  ['INVENT & SIMPLIFY', 'Simplify: add one more microservice.'],
  ['OWNERSHIP', 'You build it, you run it, you get paged at 3am.'],
  ['LEAST PRIVILEGE', 'Except for the CI role. The CI role is god.'],
  ['WELL-ARCHITECTED', 'Six pillars. Zero load-bearing.'],
];

export const NPC_LINES = {
  'Solutions Architect': [
    'Have you considered making it serverless?',
    'This would be a great fit for a Step Function. Everything is a great fit for a Step Function.',
    'Let me draw you an architecture diagram. It has 74 icons.',
    'The answer is "it depends". What was the question?',
    'You could put an EventBridge in front of that EventBridge.',
  ],
  'Security Guard': [
    'Badge please. ...ReadOnlyAccess? Fine. Do not touch anything.',
    'I guard the root account. Nobody has the MFA device. Nobody knows where it went.',
    'Least privilege, kid. Least. Privilege.',
    'I once saw an access key in a public GitHub repo. I still have nightmares.',
  ],
  'Intern': [
    'I accidentally deleted prod. Just kidding! ...unless?',
    'What does "eventually consistent" mean? I asked yesterday and the answer has not arrived yet.',
    'They gave me AdministratorAccess on day one. Is that normal?',
    'I wrote a Lambda that calls itself. The bill is very exciting.',
  ],
  'Developer Advocate': [
    'Did you see the 47 launches this morning? I am writing 48 blog posts about them.',
    'Have you tried the new service? It is like the old service, but with "Q" in the name.',
    'Let us build it live on stream. What could go wrong?',
  ],
  'On-call Engineer': [
    'I have been on call since re:Invent 2019.',
    'The dashboard is green. That is how I know something is wrong.',
    'Do not look at the 5xx graph. Do not make eye contact with it.',
    'If that alarm goes red again I am moving to a cabin with no internet.',
  ],
};

export const READONLY_QUIPS = [
  'Nice try. This badge is read-only.',
  'AccessDenied: you are not authorized to perform: intern:TouchAnything',
  'Your change request has been filed under /dev/null.',
  'Please raise a ticket. The ticket queue is an SQS FIFO queue with 9,000 messages.',
  'You reached for the power cable. The power cable reached back. Do not.',
  'ReadOnlyAccess: look, but do not `terraform destroy`.',
];

// Retired / closed-to-new-customers AWS services. Dates are when retirement was announced or took effect.
export const RETIRED_SERVICES = [
  { name: 'EC2-Classic', years: '2006 – 2023', epitaph: 'Flat networking. No VPC. No regrets. It walked so VPCs could run.', big: true },
  { name: 'AWS CodeCommit', years: '2015 – 2024', epitaph: 'git push --force\'d into the afterlife.' },
  { name: 'AWS Cloud9', years: '2016 – 2024', epitaph: 'Now on cloud nothing.' },
  { name: 'AWS CodeStar', years: '2017 – 2024', epitaph: 'A star that burned out before anyone found the console page.' },
  { name: 'AWS OpsWorks', years: '2013 – 2024', epitaph: 'Chef\'d its last recipe. Puppet\'d its last string.' },
  { name: 'AWS Snowmobile', years: '2016 – 2024', epitaph: 'A 45-foot truck full of hard drives. Drove off into the sunset.' },
  { name: 'Amazon Honeycode', years: '2020 – 2024', epitaph: 'No code. No customers. No more.' },
  { name: 'Amazon QLDB', years: '2019 – 2025', epitaph: 'Its history was immutable. Its future was not.' },
  { name: 'Amazon WorkDocs', years: '2014 – 2025', epitaph: 'Final_v2_REAL_final.docx' },
  { name: 'Elastic Transcoder', years: '2013 – 2025', epitaph: 'Transcoded into MediaConvert.' },
  { name: 'AWS IoT Analytics', years: '2018 – 2025', epitaph: 'Its toaster telemetry lives on in our hearts.' },
  { name: 'Amazon Sumerian', years: '2018 – 2023', epitaph: 'Was VR. Is now IRL (In Retirement, Literally).' },
  { name: 'Elastic Inference', years: '2018 – 2024', epitaph: 'Inferred that it was no longer needed.' },
  { name: 'Lookout for Vision', years: '2020 – 2025', epitaph: 'Did not see it coming.' },
  { name: 'Lookout for Metrics', years: '2020 – 2025', epitaph: 'Anomaly detected: itself.' },
  { name: 'AWS Data Pipeline', years: '2012 – 2024', epitaph: 'The pipeline is closed to new data. And new customers.' },
  { name: 'AWS Mobile Hub', years: '2016 – 2019', epitaph: 'Amplified into something else.' },
  { name: 'Amazon SimpleDB', years: '2007 – ?', epitaph: 'Missing, presumed legacy. Some say it still answers queries at night.' },
  { name: 'Amazon Chime', years: '2017 – 2026', epitaph: 'The meeting has ended. Nobody noticed.' },
  { name: 'AWS App Mesh', years: '2019 – 2026', epitaph: 'Untangled at last.' },
  { name: 'Python 2.7 runtime', years: '2015 – 2021', epitaph: 'print "goodbye"' },
  { name: 'Node.js 0.10 runtime', years: '2014 – 2016', epitaph: 'callback(null, "rest in peace")' },
  { name: 'go1.x runtime', years: '2018 – 2024', epitaph: 'if err != nil { return heaven }' },
];

export function pickRandom(list) {
  return list[Math.floor(Math.random() * list.length)];
}
