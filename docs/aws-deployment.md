# AWS Deployment

This project is prepared for a single Node.js application on AWS Elastic
Beanstalk with mutable player state in Amazon RDS for PostgreSQL. Static game
catalogues remain in the deployment bundle as JSON. PokéAPI is never called at
runtime.

No AWS resources or credentials are created by this repository.

## A. Prerequisites

- An AWS account with billing alerts enabled
- AWS CLI v2 and, optionally, the Elastic Beanstalk CLI
- A domain and ACM certificate only if a custom HTTPS domain is wanted
- Node.js 20 or 22 locally
- Permission to manage RDS, Elastic Beanstalk, EC2 security groups, S3,
  CloudWatch Logs, IAM roles, and optionally Route 53/ACM

For a Sweden/European deployment, `eu-north-1` is a practical default. Choose
one region and keep RDS, Elastic Beanstalk, CloudWatch, and the deployment S3
bucket together.

Before using CLI commands, verify the intended account:

```bash
aws configure
aws sts get-caller-identity
```

Prefer short-lived AWS SSO credentials locally and GitHub OIDC in automation.
Never place AWS keys in `.env` or GitHub repository files.

## B. Create PostgreSQL in RDS

1. Create an RDS PostgreSQL instance in the same VPC as the future Elastic
   Beanstalk environment.
2. Use a private database where possible. Do not expose PostgreSQL publicly.
3. Create a dedicated database and application user with a generated password.
4. Retain automated backups and enable deletion protection for important data.
5. Record the endpoint, port, database name, username, and password in a secrets
   manager or password manager.

The database security group should allow inbound TCP `5432` only from the
Elastic Beanstalk instances' security group. It should not allow `0.0.0.0/0`.

Prisma expects a URL in this shape:

```text
postgresql://USER:PASSWORD@RDS_HOST:5432/DATABASE?schema=public&sslmode=require
```

Percent-encode reserved characters in the username or password. Do not print
the completed URL in logs or commit it.

## C. Create Elastic Beanstalk

Use the current AWS Node.js platform with Node.js 20 or 22:

```bash
eb init
eb create pokemon-production
```

Use a load-balanced environment for production. Attach an ACM certificate to
an HTTPS `443` listener and redirect HTTP `80` to HTTPS. Production session
cookies are deliberately `Secure` and will not authenticate over plain HTTP.

The repository includes:

- `Procfile`, which runs `npm start`
- `.platform/hooks/predeploy/01_prisma_migrate.sh`, which runs committed Prisma
  migrations before deployment
- `.ebextensions/01_cloudwatch.config`, which streams environment logs to
  CloudWatch for 14 days and preserves them when the environment is removed

The predeploy hook deliberately fails unless production PostgreSQL variables
are present. A failed migration stops the deployment instead of starting the
application against an unknown schema.

## D. Environment Variables

Configure these in the Elastic Beanstalk environment, not in source control:

```text
NODE_ENV=production
PERSISTENCE_MODE=postgres
DATABASE_URL=postgresql://...
SESSION_DAYS=30
TRUST_PROXY=1
```

Elastic Beanstalk supplies `PORT`; the app defaults to `3000` only when it is
not supplied. It binds to `0.0.0.0`. `TRUST_PROXY=1` allows Express to respect
the load balancer while secure, HTTP-only authentication cookies remain
enabled in production.

Production startup rejects JSON persistence, a missing `DATABASE_URL`, or an
unreachable PostgreSQL server. There is no silent save fallback.

## E. Migrations and Deployment

The production-safe migration command is:

```bash
npm run db:migrate
```

It runs `prisma migrate deploy`; never use `prisma migrate dev` in production.
Elastic Beanstalk runs it through the predeploy hook. To verify the same command
from a trusted machine that can reach RDS, set `DATABASE_URL` locally and run it
once before the first application deployment.

Deploy manually with the EB CLI:

```bash
eb deploy
```

The optional GitHub workflow is manual-only and uses OIDC. Before enabling it,
create a narrowly scoped IAM role and repository/environment variables:

- `AWS_ROLE_ARN`
- `AWS_REGION`
- `EB_APPLICATION_NAME`
- `EB_ENVIRONMENT_NAME`
- `EB_S3_BUCKET`

The role trust policy should restrict `sub` to this repository and the GitHub
`production` environment. Do not use long-lived AWS access-key secrets.

## F. Verification

Check the public health endpoint:

```bash
curl -fsS https://YOUR_ENVIRONMENT/api/health
```

Healthy PostgreSQL mode returns status `200` with `persistenceMode` set to
`postgres` and database status `connected`. It never returns the database URL.
A database outage returns `503`.

Then verify:

1. Register a test account and log in.
2. Catch or move a Pokémon and note the saved state.
3. Restart an Elastic Beanstalk instance or deploy the same version again.
4. Log back in and confirm party, storage, items, story, and League progress.
5. Confirm another account has isolated progress.

## G. CloudWatch Logs

Elastic Beanstalk log streaming is enabled by repository configuration. Review
the environment health dashboard and CloudWatch log groups for startup,
migration, request, and shutdown messages. Application errors intentionally
omit client stack traces and never log credentials.

Ensure the Elastic Beanstalk service role has the managed log-streaming
permissions required by the selected platform; the environment wizard normally
creates or offers the appropriate service role.

Set CloudWatch retention and alarms to match the environment. Useful alarms
include unhealthy hosts, repeated HTTP 5xx responses, high latency, and RDS
connection/storage pressure.

## H. Costs and Backups

AWS free-tier offers and eligibility change. RDS, Elastic Beanstalk EC2/load
balancers, NAT gateways, storage, snapshots, data transfer, and CloudWatch can
all incur charges. Check current AWS pricing before creating resources and set
a small AWS Budget alert.

Keep automated RDS backups and take a manual snapshot before schema changes.
The mutable database and the static JSON catalogues are both needed for a full
recovery.

## I. Cleanup

To avoid continuing charges:

1. Terminate the Elastic Beanstalk environment.
2. Delete unused application versions and deployment objects from S3.
3. Snapshot RDS if the data is needed, then delete the instance.
4. Remove retained CloudWatch log groups when no longer required.
5. Remove unused security groups, load balancers, target groups, IAM roles,
   Route 53 records, and NAT gateways.
6. Recheck Cost Explorer after cleanup.

Never delete RDS before confirming whether a final snapshot is required.
