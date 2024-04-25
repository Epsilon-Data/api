import { Module } from '@nestjs/common';
import { BrowseDatasetController } from './browse_dataset.controller';
import { BrowseDatasetService } from './browse_dataset.service';

@Module({
  controllers: [BrowseDatasetController],
  providers: [BrowseDatasetService],
})
export class BrowseDatasetModule {}
