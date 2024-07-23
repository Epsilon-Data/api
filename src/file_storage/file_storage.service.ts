import { Injectable } from '@nestjs/common';
import {
  GetObjectCommand,
  GetObjectCommandOutput,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

@Injectable()
export class FileStorageService {
  private readonly s3: S3Client;

  constructor() {
    this.s3 = new S3Client({
      endpoint: 'http://localhost:9000',
      credentials: {
        accessKeyId: 'admin',
        secretAccessKey: 'supersecret',
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
}
