import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';

export const coverOptions: MulterOptions = {
  limits: { fileSize: 2000000 },
  fileFilter: (req, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
      return callback(new Error('Only image files are allowed!'), false);
    }
    callback(null, true);
  },
};

export const scriptOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 5000000 },
  fileFilter: (req, file, callback) => {
    if (!file.originalname.match(/\.(R)$/)) {
      return callback(new Error('Only R files are allowed!'), false);
    }
    callback(null, true);
  },
};
