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

export const syntheticDataOptions: MulterOptions = {
  storage: memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, callback) => {
    if (!file.originalname.match(/\.csv$/i)) {
      return callback(new Error('Only CSV files are allowed!'), false);
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

export const resourcePrefix = 'project:';
export const projectScopes = [
  {
    name: 'view',
  },
  {
    name: 'stats',
  },
  {
    name: 'edit',
  },
  {
    name: 'approve',
  },
  {
    name: 'analysis',
  },
  {
    name: 'delete',
  },
  {
    name: 'connect',
  },
];
export const ownerPolicyPrefix = 'Owner of ';
export const ownerPermissionPrefix = 'Owner ';
export const ownerPermissions = [
  'view',
  'edit',
  'delete',
  'approve',
  'analysis',
  'stats',
];
export const groupPrefix = 'Collaborators of ';
export const groupPolicyPrefix = 'Collaborators on ';
export const groupPermissionPrefix = 'Collaborators ';
export const groupPermissions = [
  'view',
  'edit',
  'approve',
  'analysis',
  'stats',
];
export const custodianPolicyPrefix = 'Custodian of ';
export const custodianPermissionPrefix = `Custodian `;
export const custodianPermissions = ['view', 'edit', 'connect'];
export const analysisPolicyPrefix = 'Analysis of ';
export const analysisPermissionPrefix = `Analysis `;
export const analysisPermissions = ['analysis'];
