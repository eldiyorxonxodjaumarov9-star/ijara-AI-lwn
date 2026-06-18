import { BadRequestException } from '@nestjs/common';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomBytes } from 'crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';
const MAX_FILE_SIZE_MB = Number(process.env.MAX_FILE_SIZE_MB || 5);

export function ensureUploadDir(): string {
  const dir = join(process.cwd(), UPLOAD_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export const multerOptions = {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, ensureUploadDir());
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${randomBytes(8).toString('hex')}`;
      cb(null, `${unique}${extname(file.originalname)}`);
    },
  }),
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024,
  },
  fileFilter: (
    _req: unknown,
    file: { mimetype: string },
    cb: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!file.mimetype.match(/^image\/(jpeg|jpg|png|webp|gif)$/)) {
      return cb(
        new BadRequestException('Faqat rasm fayllariga ruxsat beriladi'),
        false,
      );
    }
    cb(null, true);
  },
};

export function buildFileUrl(filename: string): string {
  return `/${UPLOAD_DIR}/${filename}`;
}
