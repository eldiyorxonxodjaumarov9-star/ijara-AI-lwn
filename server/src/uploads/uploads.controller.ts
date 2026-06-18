import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { buildFileUrl, multerOptions } from '../common/upload/multer.config';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  @Post()
  @ApiOperation({ summary: 'Rasm(lar) yuklash (max 10 ta)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 10, multerOptions))
  upload(@UploadedFiles() files: Array<{ filename: string }>) {
    const urls = (files ?? []).map((file) => buildFileUrl(file.filename));
    return { urls };
  }
}
