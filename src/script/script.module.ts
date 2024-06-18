import { Global, Module } from '@nestjs/common';
import { ScriptService } from './script.service';

@Global()
@Module({
  providers: [ScriptService],
  exports: [ScriptService],
})
export class ScriptModule {}
