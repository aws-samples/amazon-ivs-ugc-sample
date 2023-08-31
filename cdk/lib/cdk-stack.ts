import * as cdk from 'aws-cdk-lib';
import { aws_s3 as s3 } from 'aws-cdk-lib';
import { CachePolicy, Distribution, ViewerProtocolPolicy } from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3Origin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { Instance, InstanceClass, InstanceSize, InstanceType, InterfaceVpcEndpointAwsService, MachineImage, Peer, Port, SecurityGroup, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { Rule } from 'aws-cdk-lib/aws-events';
import { LambdaFunction } from 'aws-cdk-lib/aws-events-targets';
import { Effect, PolicyStatement, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import { CfnRecordingConfiguration } from 'aws-cdk-lib/aws-ivs';
import { CfnLoggingConfiguration } from 'aws-cdk-lib/aws-ivschat';
import { Architecture, Code, Function, LayerVersion, Runtime } from 'aws-cdk-lib/aws-lambda';
import { LogGroup } from 'aws-cdk-lib/aws-logs';
import { Credentials, DatabaseInstance, DatabaseInstanceEngine, PostgresEngineVersion } from 'aws-cdk-lib/aws-rds';
import { Secret } from 'aws-cdk-lib/aws-secretsmanager';

export class CdkStack extends cdk.Stack {
  public static PROJECT_TAG: string = 'streamcat';

  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // DB master user credentials
    const dbCredentialsSecret = new Secret(this, 'DbCredentialsSecret', {
      secretName: '/streamcat/master-db-credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        passwordLength: 16,
        excludePunctuation: true,
      }
    });

    // vpc for db and lambda functions
    const vpc = new Vpc(this, 'Vpc', {
      vpcName: 'streamcat-vpc',
      maxAzs: 3,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: SubnetType.PRIVATE_WITH_EGRESS,
        },
        {
          cidrMask: 24,
          name: 'private-isolated-subnet',
          subnetType: SubnetType.PRIVATE_ISOLATED,
        },
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: SubnetType.PUBLIC,
        }
      ],
    });

    // add secrets manager endpoint
    // to allow lambda function in this VPC
    // access to retrieve secrets
    vpc.addInterfaceEndpoint('secrets-manager-endpoint', {
      service: InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
      privateDnsEnabled: true,
      subnets: { subnetType: SubnetType.PRIVATE_WITH_EGRESS }
    });

    // security group
    const securityGroup = new SecurityGroup(this, 'VpcSecurityGroup', {
      securityGroupName: 'streamcat-vpc-security-group',
      vpc: vpc,
    });
    // allow PostgreSQL access inside of the VPC
    securityGroup.addIngressRule(Peer.ipv4(vpc.vpcCidrBlock), Port.tcp(5432), 'Allow port 5432 from within the VPC');
    // allow SSH (for bastion host access)
    securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(22), 'Allow SSH');

    // PostgreSQL RDS instance
    const dbInstance = new DatabaseInstance(this, 'PostgresInstance', {
      vpc: vpc,
      vpcSubnets: { subnetType: SubnetType.PRIVATE_ISOLATED },
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      engine: DatabaseInstanceEngine.postgres({
        version: PostgresEngineVersion.VER_14_7,
      }),
      port: 5432,
      securityGroups: [securityGroup],
      instanceIdentifier: 'streamcat-test-db',
      databaseName: 'streamcat',
      credentials: Credentials.fromSecret(dbCredentialsSecret),
      backupRetention: cdk.Duration.days(0),
      deleteAutomatedBackups: true,
    });

    // bastion instance - depends on an existing SSH key named 'id_aws'
    // which must be manually created in the console
    const bastionHostInstance = new Instance(this, 'BastionHost', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      securityGroup: securityGroup,
      instanceName: 'streamcat-bastion-host',
      instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MICRO),
      machineImage: MachineImage.latestAmazonLinux2(),
      keyName: 'id_aws',
    });

    // s3 bucket for VOD storage
    const vodBucket = new s3.Bucket(this, 'VodStorageBucket', {
      bucketName: 'streamcat-vod-storage',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [{
        allowedMethods: [
          s3.HttpMethods.GET,
        ],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
      }],
    });

    // lambda functions for chat moderation and handling stream events

    // layer to include dependencies
    const lambdaLayer = new LayerVersion(this, 'LambdaLayer', {
      layerVersionName: 'LambdaLayer',
      compatibleRuntimes: [
        Runtime.NODEJS_18_X,
      ],
      code: Code.fromAsset('./resources/dependencies/nodejs'),
    });

    // secrets and parameters layer (to retrieve secrets without SDK)
    const secretsAndParametersLayer = LayerVersion.fromLayerVersionArn(this, 'SecretsAndParametersLayer',
      'arn:aws:lambda:us-east-1:177933569100:layer:AWS-Parameters-and-Secrets-Lambda-Extension-Arm64:4'
    );

    // lambda to handle stream state change events
    const streamStateChangeHandler = new Function(this, 'StreamStateChangeHandler', {
      vpc: vpc,
      vpcSubnets: {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
      },
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset('resources'),
      handler: 'index.streamStateChanged',
      environment: {
        PARAMETERS_SECRETS_EXTENSION_LOG_LEVEL: 'info',
        PARAMETERS_SECRETS_EXTENSION_CACHE_ENABLED: 'true',
        SECRET_NAME: '/streamcat/db-creds',
      },
      layers: [lambdaLayer, secretsAndParametersLayer],
      architecture: Architecture.ARM_64,
      timeout: cdk.Duration.seconds(5),
    });

    // policy statement for stream state change lambda
    const streamStateChangePolicy = new PolicyStatement({
      effect: Effect.ALLOW,
      resources: ['*'],
      actions: ['secretsmanager:GetSecretValue', 'logs:FilterLogEvents'],
    });
    streamStateChangeHandler.addToRolePolicy(streamStateChangePolicy);

    // chat moderation handler lambda
    const moderateChatHandler = new Function(this, 'ModerateIvsChatHandler', {
      runtime: Runtime.NODEJS_18_X,
      code: Code.fromAsset('resources'),
      handler: 'index.moderateChat',
      layers: [lambdaLayer],
    });
    moderateChatHandler.addPermission('PermitModerateChatInvoke', {
      principal: new ServicePrincipal('ivschat.amazonaws.com'),
    });

    // event bridge rule to trigger stream state 
    // change lambda when an IVS channel's state changes
    const streamStateChangeEventRule = new Rule(this, 'StreamStateChangeEventRule', {
      description: 'Rule to handle IVS Stream State Changes',
      ruleName: 'streamcat-stream-change',
      eventPattern: {
        source: ['aws.ivs'],
        detailType: ['IVS Stream State Change', 'IVS Recording State Change'],
      },
      targets: [new LambdaFunction(streamStateChangeHandler)],
    });
    streamStateChangeHandler.addPermission('PermitStreamStateInvoke', {
      principal: new ServicePrincipal('events.amazonaws.com'),
      sourceArn: streamStateChangeEventRule.ruleArn,
    });

    // IVS recording configuration
    // CfnRecordingConfiguration does not yet support storage on ThumbnailConfiguration
    /*
    const ivsRecordingConfig = new CfnRecordingConfiguration(this, 'IvsRecordingConfiguration', {
      name: 'streamcat-recording-config',
      recordingReconnectWindowSeconds: 60,
      destinationConfiguration: {
        s3: {
          bucketName: vodBucket.bucketName,
        }
      },
      thumbnailConfiguration: {
        recordingMode: 'INTERVAL',
        storage: ['LATEST'],
        targetIntervalSeconds: 5,
      }
    });
    */
    const ivsRecordingConfig = new CfnRecordingConfiguration(this, 'IvsRecordingConfiguration', {
      name: 'streamcat-recording-config',
      recordingReconnectWindowSeconds: 60,
      destinationConfiguration: {
        s3: {
          bucketName: vodBucket.bucketName,
        }
      },
      thumbnailConfiguration: {
        recordingMode: 'INTERVAL',
        targetIntervalSeconds: 5,
      }
    });

    // CloudFront distribution for VOD playback
    const s3Origin = new S3Origin(vodBucket);
    // don't cache recent thumbnails (since they're overwritten every 5 seconds)
    const noCacheThumbnailPolicy = new CachePolicy(this, 'NoCacheThumbnailPolicy', {
      defaultTtl: cdk.Duration.seconds(0),
      minTtl: cdk.Duration.seconds(0),
      maxTtl: cdk.Duration.seconds(0),
    });
    const vodCfDistribution: Distribution = new Distribution(this, "VodCfDistribution", {
      defaultBehavior: {
        origin: s3Origin,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/ivs/*/media/latest_thumbnail/thumb.jpg': {
          origin: s3Origin,
          viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: noCacheThumbnailPolicy,
        }
      }
    });

    // policy to grant cloudfront permission to VOD s3 bucket
    // seems to be added by CDK automagically
    /*
    const s3CloudFrontPolicy = new PolicyStatement({
      actions: ['s3:GetObject'],
      principals: [new ServicePrincipal('cloudfront.amazonaws.com')],
      resources: [`arn:aws:s3:::${vodBucket.bucketName}/*`],
      conditions: {
        "StringEquals": {
          "aws:SourceArn": `arn:aws:cloudfront::${this.account}:distribution/${vodCfDistribution.distributionId}`
        },
      }
    });
    vodBucket.addToResourcePolicy(s3CloudFrontPolicy);
    */

    // cloudwatch log group for chat logs
    const chatLogGroup = new LogGroup(this, 'ChatLogGroup', {
      logGroupName: 'streamcat-chat-log-group',
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ivs chat logging configuration
    const ivsChatLogConfig = new CfnLoggingConfiguration(this, 'IvsChatLogConfig', {
      name: 'streamcat-chat-logging-config',
      destinationConfiguration: {
        cloudWatchLogs: {
          logGroupName: chatLogGroup.logGroupName
        }
      }
    });

    // stack outputs
    new cdk.CfnOutput(this, 'CloudFrontDomain', {
      description: 'The domain of the CloudFront distribution (set as CF_DOMAIN in .env file)',
      value: vodCfDistribution.domainName,
    });

    new cdk.CfnOutput(this, 'BastionHostIp', {
      description: 'The public IP of the bastion host',
      value: bastionHostInstance.instancePublicIp,
    });

    new cdk.CfnOutput(this, 'SecurityGroupId', {
      description: 'The security group ID',
      value: securityGroup.securityGroupId,
    });

    new cdk.CfnOutput(this, 'DbHost', {
      description: 'RDS Instance Host Address (set as PG_HOST in application, and create a secret `/streamcat/db-creds` with key `dbHost` containing this)',
      value: dbInstance.dbInstanceEndpointAddress,
    });

    new cdk.CfnOutput(this, 'DbMasterPasswordArn', {
      description: 'RDS Instance Master Password ARN (use to lookup the value of the generated secret)',
      value: dbCredentialsSecret.secretArn,
    });

    new cdk.CfnOutput(this, 'IvsChatLoggingConfigurationArn', {
      description: 'IVS Chat Logging Config ARN (set as CHAT_LOGGING_CONFIGURATION_ARN in .env file)',
      value: ivsChatLogConfig.attrArn,
    });

    new cdk.CfnOutput(this, 'RecordingConfigurationArn', {
      description: 'IVS Recording Config ARN (set as RECORDING_CONFIGURATION_ARN in .env file)',
      value: ivsRecordingConfig.attrArn,
    });

    new cdk.CfnOutput(this, 'StreamStateChangedLambdaArn', {
      description: 'Stream State Change Lambda Handler ARN',
      value: streamStateChangeHandler.functionArn,
    });

    new cdk.CfnOutput(this, 'ModerateChatLambdaArn', {
      description: 'Chat Moderation Lambda Handler ARN (set as MODERATE_CHAT_FUNCTION_ARN in .env file)',
      value: moderateChatHandler.functionArn,
    });

    cdk.Tags.of(this).add('project', CdkStack.PROJECT_TAG);
  }
}