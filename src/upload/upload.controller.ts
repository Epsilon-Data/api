import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage, FileFilterCallback } from 'multer';
import { UploadDto, UploadResponseDto } from './dto/upload.dto';
import { UploadService } from './upload.service';
import { UPLOAD_MAX_FILE_SIZE } from './upload.constants';
import { Request } from 'express';
import { v4 as uuid } from 'uuid';
import * as path from 'path';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

@ApiTags('uploads')
@Controller('uploads')
export class UploadController {
  constructor(private readonly uploadSvc: UploadService) {}

  @Post()
  @ApiOperation({
    summary: 'Upload and analyze file',
    description:
      'Upload a PDF or CSV file for hierarchical structure analysis. Returns a job ID for tracking analysis progress.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'filetype'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'PDF or CSV file (max 10MB)',
        },
        filetype: {
          type: 'string',
          enum: ['pdf', 'csv'],
          description: 'File type being uploaded',
        },
        context: {
          type: 'string',
          maxLength: 2000,
          description: 'Optional analysis context',
        },
        modelId: {
          type: 'string',
          description: 'Optional LLM model ID',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'File uploaded successfully, analysis job created',
    type: UploadResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid file type, size, or mimetype mismatch',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.UPLOAD_TMPDIR || '/tmp/archetype-discovery',
        filename: (
          _req: Request,
          file: Express.Multer.File,
          cb: (error: Error | null, filename: string) => void,
        ) => {
          const sanitizedOriginalName = path
            .parse(file.originalname)
            .name.replace(/[^a-zA-Z0-9.-]/g, '_')
            .substring(0, 100);
          const extension = path.extname(file.originalname);
          const safeFilename = `${uuid()}-${sanitizedOriginalName}${extension}`;
          cb(null, safeFilename);
        },
      }),
      limits: { fileSize: UPLOAD_MAX_FILE_SIZE },
      fileFilter: (
        _req: Request,
        file: Express.Multer.File,
        cb: FileFilterCallback,
      ) => {
        const allowed = ['application/pdf', 'text/csv'];
        if (allowed.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Unsupported mimetype: ' + file.mimetype));
        }
      },
    }),
  )
  handleUpload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDto,
  ) {
    const expectedMimetypes: Record<string, string> = {
      pdf: 'application/pdf',
      csv: 'text/csv',
    };

    const actual = file.mimetype;
    const expected = expectedMimetypes[dto.filetype.toLowerCase()];
    if (!expected || actual !== expected) {
      throw new BadRequestException(
        `Mimetype mismatch: expected ${expected}, got ${actual}`,
      );
    }

    const jobId = this.uploadSvc.processFile(file, dto.context, dto.modelId);
    return { jobId };
  }
}
