import { Test, TestingModule } from '@nestjs/testing';
import { DockerService } from './docker.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

// TODO: needs actual tests
beforeAll(() => {
  jest.spyOn(Logger.prototype as any, 'error').mockImplementation(() => {});
});

// Mock dockerode constructor
// test hooks
const dockerCreateMock = jest.fn();
jest.mock('dockerode', () => {
  return jest.fn().mockImplementation((...args: unknown[]) => {
    dockerCreateMock(...args);
    return {
      // add any docker instance methods you may call later (e.g., listContainers)
    };
  });
});

describe('DockerService', () => {
  let service: DockerService;
  let config: jest.Mocked<ConfigService>;
  let prisma: jest.Mocked<PrismaService>;

  const ATLAS_URI = 'http://atlas.local:21000';
  const ATLAS_USER = 'admin';
  const ATLAS_PASS = 'supersecret';
  const BROKER_IMAGE = 'ghcr.io/org/broker:latest';
  const IS_DEV = true;

  beforeEach(async () => {
    config = {
      get: jest.fn((key: string) => {
        switch (key) {
          case 'atlas.uri':
            return ATLAS_URI;
          case 'atlas.adminUsername':
            return ATLAS_USER;
          case 'atlas.adminPassword':
            return ATLAS_PASS;
          case 'brokerImage':
            return BROKER_IMAGE;
          case 'isDev':
            return IS_DEV;
          default:
            return undefined as unknown;
        }
      }),
    } as unknown as jest.Mocked<ConfigService>;

    prisma = {} as unknown as jest.Mocked<PrismaService>;

    dockerCreateMock.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DockerService,
        { provide: ConfigService, useValue: config },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(DockerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
