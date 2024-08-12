import { Global, Module } from '@nestjs/common';
import { AtlasService } from './atlas.service';

@Global()
@Module({
  providers: [AtlasService],
  exports: [AtlasService],
})
export class AtlasModule {}
