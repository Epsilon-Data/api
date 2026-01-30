import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { unlink, writeFile } from 'node:fs/promises';
import { v4 as uuid } from 'uuid';
import { JobsService } from '../jobs/jobs.service';
import { GraphService } from '../graph/graph.service';

@Injectable()
export class UploadService {
  private readonly logger = new Logger('UploadService');

  constructor(
    private readonly jobs: JobsService,
    private readonly graphSvc: GraphService,
  ) {}

  processFile(
    file: Express.Multer.File,
    context?: string,
    modelId?: string,
  ): string {
    const jobId = uuid();

    let { path: filePath } = file;
    const { originalname: filename, mimetype, buffer } = file;

    this.logger.log(
      `File properties - File Path: ${filePath}, Buffer: ${buffer ? 'Present' : 'Missing'}, Name: ${filename}, Type: ${mimetype}`,
    );

    this.jobs.enqueue(jobId, async () => {
      try {
        if (!filePath) {
          if (!buffer) {
            throw new BadRequestException(
              'File content unavailable (no path or buffer)',
            );
          }
          // Create temp file from buffer
          // We need a temp path. Using /tmp directly or process.env
          const tempPath = `/tmp/${jobId}-${filename}`;
          await writeFile(tempPath, buffer);
          filePath = tempPath;
        }

        return await this.graphSvc.generateGraphFromFile(
          filename,
          filePath,
          mimetype,
          context,
          modelId,
        );
      } finally {
        // Only delete file if we created it (isTempFile) OR if it was a temp upload that we want to clean up (which is usually the case for upload endpoints)
        // Assuming we always want to clean up the uploaded file after processing
        if (filePath) {
          try {
            await unlink(filePath);
          } catch (cleanupError) {
            console.error(
              '`Failed to delete temporary file ${filePath}:`',
              cleanupError,
            );
          }
        }
      }
    });

    return jobId;
  }
}
