# Amazon IVS UGC Sample

This project contains a sample application called StreamCat which is a user-generated content live streaming application.

To learn more about this application, please refer to the videos located at:

TODO: add link

This project is intended for education purposes only and not for production usage.

## Getting Started

Create an [SSH Key Pair](https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#KeyPairs:) named `id_aws` for Bastion Host

## Deploy Pre-Built Architecture

In the `cdk` directory, run `cdk deploy`.

Use the values from the CDK Output in the commands below.

Get the generated master db password:

```bash
aws secretsmanager get-secret-value --secret-id [DBMasterPasswordArn]
```

Connect to new Postgres database using the a [bastion host](https://repost.aws/knowledge-center/rds-connect-using-bastion-host-linux), the user `postgres` and the generated password that you retrieved above.

```bash
ssh -i ~/.ssh/id_aws.pem -f -N -l ec2-user -L 5432:[DbHost]:5432 ec2-user@[BastionHostIp]
```

Connect to DB from localhost.

```bash
psql -h localhost -U postgres
```

Create and user `streamcat`, setting the user's password.

```sql
create user streamcat with password '[NEW USER PASSWORD]';
```

Connect to DB with `streamcat` user:

```bash
psql -h localhost -U streamcat streamcat
```

Update Environment Variables

- Rename `.env.example` to `.env`
- Set DB Credentials in `.env`
- Run `node ace migration:run`
- Run `node ace db:seed`

Create DB Credentials secret (used by Lambda function to connect to DB):

```bash
aws secretsmanager create-secret --name '/streamcat/db-creds' --secret-string '{"dbUser": "streamcat", "dbPassword": "[NEW USER PASSWORD]", "dbHost": "[DbHost]", "dbDatabase": "streamcat"}'
```

## Running the Application

Using the CDK output, populate the `.env` file located in `web/` with the necessary values.

To run the application:

```bash
$ node ace serve --watch
```

## Destroy

Run `cdk destroy`.

**Note**: This application will create additional resources "on-demand" via the AWS SDK for JavaScript. Running `cdk destroy` will not delete these resources. To manually delete the on-demand resources, search for resources tagged with 'project=streamcat' as shown below.

Finding all resources created by this application.

```bash
$ aws resourcegroupstaggingapi get-resources --tag-filters Key=project,Values=streamcat
```
