import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ScriptService } from './script.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { scriptOptions } from 'src/options';
import { Request } from 'express';

@Controller('script')
export class ScriptController {
  constructor(private readonly scriptService: ScriptService) {}

  @Post(':analysisId')
  @UseInterceptors(FileInterceptor('file', scriptOptions))
  uploadScript(
    @Req() request: Request,
    @UploadedFile(new ParseFilePipe())
    file: Express.Multer.File,
    @Param('analysisId', ParseUUIDPipe) analysisId: string,
  ) {
    return this.scriptService.uploadScript(request, analysisId, file);
  }

  @Delete(':scriptId')
  deleteScript(@Param('scriptId', ParseUUIDPipe) scriptId: string) {
    return this.scriptService.deleteScript(scriptId);
  }

  @Get(':scriptId')
  async getScriptMapping(
    @Param('scriptId', ParseUUIDPipe) scriptId: string,
    @Req() request: Request,
  ) {
    const token = request.auth.token;
    return await this.scriptService.getScriptMapping(scriptId, request, token);
  }

  @Post(':scriptId/mapping')
  async addScriptMapping(
    @Param('scriptId', ParseUUIDPipe) scriptId: string,
    @Body() mapping: { data: string },
  ) {
    return await this.scriptService.addScriptMapping(scriptId, mapping.data);
  }
}
