import { Injectable } from '@nestjs/common';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectCommandOutput,
  HeadBucketCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileStorageService {
  private readonly s3: S3Client;

  constructor(config: ConfigService) {
    this.s3 = new S3Client({
      endpoint: config.get<string>('s3.uri')!,
      credentials: {
        accessKeyId: config.get<string>('s3.keyId')!,
        secretAccessKey: config.get<string>('s3.secretKey')!,
      },
      region: 'us-east-1',
      forcePathStyle: true,
    });
  }

  async listFiles(bucketName: string, prefix: string) {
    const params = {
      Bucket: bucketName,
      Prefix: prefix,
    };

    const command = new ListObjectsV2Command(params);
    const data = await this.s3.send(command);
    return data.Contents?.map((item) => item.Key) || [];
  }

  async getFile(bucketName: string, key: string): Promise<Readable> {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const data: GetObjectCommandOutput = await this.s3.send(command);

    return data.Body as Readable;
  }

  async putFile(
    bucketName: string,
    key: string,
    file: Express.Multer.File,
  ): Promise<void> {
    const params = {
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    const command = new PutObjectCommand(params);
    await this.s3.send(command);
  }

  async deleteFile(bucketName: string, key: string): Promise<void> {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new DeleteObjectCommand(params);
    await this.s3.send(command);
  }

  async fileExists(bucketName: string, key: string) {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new HeadObjectCommand(params);
    try {
      await this.s3.send(command);
      return true;
    } catch (error: unknown) {
      if (error instanceof S3ServiceException) {
        if (
          error.name === 'NotFound' ||
          error.$metadata.httpStatusCode === 404
        ) {
          return false;
        }
        // other checking error
        throw new Error(
          `S3 error checking bucket "${bucketName}": ${error.name} (${error.$metadata?.httpStatusCode ?? 'n/a'})`,
        );
      }
    }
  }

  async getFileUrl(
    bucketName: string,
    key: string,
    expiresIn: number = 3600,
  ): Promise<string> {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new GetObjectCommand(params);
    const url = await getSignedUrl(this.s3, command, { expiresIn });
    return url;
  }

  async createBucketIfNotExists(bucketName: string): Promise<void> {
    try {
      // Check if the bucket exists
      const headCommand = new HeadBucketCommand({ Bucket: bucketName });
      await this.s3.send(headCommand);
    } catch (error: unknown) {
      if (error instanceof S3ServiceException) {
        // 404 -> bucket does not exist
        if (
          error.$metadata?.httpStatusCode === 404 ||
          error.name === 'NotFound'
        ) {
          await this.s3.send(new CreateBucketCommand({ Bucket: bucketName }));
          return;
        }
        // checking error
        throw new Error(
          `S3 error checking bucket "${bucketName}": ${error.name} (${error.$metadata?.httpStatusCode ?? 'n/a'})`,
        );
      }

      // Non-AWS error (network, runtime, etc.)
      throw new Error(
        `Unknown error checking bucket "${bucketName}": ${String(error)}`,
      );
    }
  }
}
