import { Controller, Get, Req } from '@nestjs/common';
import { DatasetService } from './dataset.service';
import { Request } from 'express';

@Controller('dataset')
export class DatasetController {
  constructor(private datasetService: DatasetService) {}

  @Get('list')
  list(@Req() request: Request) {
    return this.datasetService.list(request);
  }
}
