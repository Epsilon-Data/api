import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';

const imageFilter = (
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error, acceptFile: boolean) => void,
) => {
  if (!Boolean(file.mimetype.match(/(jpg|jpeg)/))) callback(null, false);
  callback(null, true);
};

export const imageOptions: MulterOptions = {
  limits: { fileSize: 200000 },
  fileFilter: imageFilter,
};
