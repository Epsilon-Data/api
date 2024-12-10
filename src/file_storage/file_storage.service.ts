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
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FileStorageService {
  private readonly s3: S3Client;

  constructor(config: ConfigService) {
    this.s3 = new S3Client({
      endpoint: config.get('S3_URI'),
      credentials: {
        accessKeyId: config.get('S3_KEY_ID'),
        secretAccessKey: config.get('S3_SECRET_KEY'),
      },
      region: 'us-east-1',
      forcePathStyle: true,
    });
  }

  async listFiles(bucketName: string, prefix: string): Promise<string[]> {
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

  async fileExists(bucketName: string, key: string): Promise<boolean> {
    const params = {
      Bucket: bucketName,
      Key: key,
    };

    const command = new HeadObjectCommand(params);
    try {
      await this.s3.send(command);
      return true;
    } catch (error) {
      if (error.name === 'NotFound' || error.$metadata.httpStatusCode === 404) {
        return false;
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
    } catch (error) {
      if (
        error.name === 'NotFound' ||
        error.$metadata?.httpStatusCode === 404
      ) {
        // Bucket does not exist, so create it
        const createCommand = new CreateBucketCommand({ Bucket: bucketName });
        await this.s3.send(createCommand);
      } else {
        throw new Error(`Error checking bucket: ${error.message}`);
      }
    }
  }
}
