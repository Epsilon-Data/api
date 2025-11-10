/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AtlasProcessor } from './atlas.processor';
import { DockerService } from 'src/docker/docker.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { Job } from 'bull';

import { ArchetypeJobDataDto } from './dto';
import { ArchetypeDto } from 'src/archetype/dto';
import { AtlasArchetypeTypeName } from 'src/atlas/dto';

jest.mock('nanoid', () => ({
  customAlphabet: jest.fn(() => jest.fn(() => '2Tyz5UfLBCXF')),
}));

describe('AtlasProcessor', () => {
  let service: AtlasProcessor;
  let atlasService: AtlasService;
  let prismaService: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AtlasProcessor,
        {
          provide: DockerService,
          useValue: { run: jest.fn(), stop: jest.fn() },
        },
        {
          provide: AtlasService,
          useValue: {
            post: jest.fn(),
            put: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: { project: { update: jest.fn() } },
        },
      ],
    }).compile();

    service = module.get<AtlasProcessor>(AtlasProcessor);
    dockerService = module.get<DockerService>(DockerService);
    atlasService = module.get<AtlasService>(AtlasService);
    prismaService = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('handleAddArchetypeJob', () => {
    it('should handle new archetype creation', async () => {
      const job = {
        id: '1',
        data: {
          owner: 'owner',
          projectId: 'ac87bc38-bc56-4322-b569-bd7b4b68f7a7',
          archetype: {
            projectId: 'ac87bc38-bc56-4322-b569-bd7b4b68f7a7',
            name: 'Test template',
            nodes: [
              {
                id: 'node_0',
                data: { label: 'Patient', level: 0 },
                position: { x: 304, y: 100 },
                type: 'root',
              },
              {
                id: 'node_2',
                data: { label: 'Health', level: 1 },
                position: { x: -168.796875, y: 284 },
                type: 'category',
              },
              {
                id: 'node_3',
                data: { label: 'Medications', level: 1 },
                position: { x: 927.5138761541593, y: 304.8921088895832 },
                type: 'category',
              },
              {
                id: 'node_4',
                data: { label: 'Demographics', level: 1 },
                position: { x: 182.203125, y: 297 },
                type: 'category',
              },
              {
                id: 'node_5',
                data: { label: 'Condition', level: 1 },
                position: { x: 542.203125, y: 308 },
                type: 'category',
              },
              {
                id: 'node_6',
                data: { label: 'Critical', level: 2 },
                position: { x: 696.9084316749986, y: 391.1078911104168 },
                type: 'category',
              },
              {
                id: 'node_7',
                data: { label: 'Diagnosis', level: 2 },
                position: { x: 444.203125, y: 394 },
                type: 'category',
              },
              {
                id: 'node_8',
                data: { label: 'Age', level: 2 },
                position: { x: 177.203125, y: 393 },
                type: 'category',
              },
              {
                id: 'node_9',
                data: { label: 'Heart rate', level: 2 },
                position: { x: -377.18653725832723, y: 395.67632666874965 },
                type: 'category',
              },
              {
                id: '612e9b6d-5402-4e03-9435-36085e674f7f',
                data: { label: 'heart_rate', level: 3 },
                position: { x: -363.0496661416615, y: 536.2157822208335 },
                type: 'column',
              },
              {
                id: 'd3bedeb3-8e46-4f9d-9527-d001546eb33e',
                data: { label: 'age', level: 3 },
                position: { x: 177.203125, y: 543 },
                type: 'column',
              },
              {
                id: '08723348-30dc-43f9-a411-b61030f0231a',
                data: { label: 'diagnosis', level: 3 },
                position: { x: 444.203125, y: 544 },
                type: 'column',
              },
              {
                id: 'a2f95901-28f6-4dd8-a640-4b732ca567ec',
                data: { label: 'critical', level: 3 },
                position: { x: 696.9084316749986, y: 541.1078911104169 },
                type: 'column',
              },
              {
                id: '169a64d4-e800-41d3-9c13-e2acd8f4acbe',
                data: { label: 'medications', level: 2 },
                position: { x: 935.0823117124922, y: 471.92108889583216 },
                type: 'column',
              },
            ],
            edges: [
              { id: 'edge_node_0_node_2', source: 'node_0', target: 'node_2' },
              { id: 'edge_node_0_node_3', source: 'node_0', target: 'node_3' },
              { id: 'edge_node_0_node_4', source: 'node_0', target: 'node_4' },
              { id: 'edge_node_0_node_5', source: 'node_0', target: 'node_5' },
              { id: 'edge_node_5_node_6', source: 'node_5', target: 'node_6' },
              { id: 'edge_node_5_node_7', source: 'node_5', target: 'node_7' },
              { id: 'edge_node_4_node_8', source: 'node_4', target: 'node_8' },
              { id: 'edge_node_2_node_9', source: 'node_2', target: 'node_9' },
              {
                id: 'edge_node_9_612e9b6d-5402-4e03-9435-36085e674f7f',
                source: 'node_9',
                target: '612e9b6d-5402-4e03-9435-36085e674f7f',
              },
              {
                id: 'edge_node_8_d3bedeb3-8e46-4f9d-9527-d001546eb33e',
                source: 'node_8',
                target: 'd3bedeb3-8e46-4f9d-9527-d001546eb33e',
              },
              {
                id: 'edge_node_7_08723348-30dc-43f9-a411-b61030f0231a',
                source: 'node_7',
                target: '08723348-30dc-43f9-a411-b61030f0231a',
              },
              {
                id: 'edge_node_6_a2f95901-28f6-4dd8-a640-4b732ca567ec',
                source: 'node_6',
                target: 'a2f95901-28f6-4dd8-a640-4b732ca567ec',
              },
              {
                id: 'edge_node_3_169a64d4-e800-41d3-9c13-e2acd8f4acbe',
                source: 'node_3',
                target: '169a64d4-e800-41d3-9c13-e2acd8f4acbe',
              },
            ],
            permissions: [
              { id: 'node_5', permission: 'DETAILED' },
              { id: 'node_2', permission: 'DETAILED' },
              { id: 'node_4', permission: 'HIGH_LEVEL' },
              { id: 'node_3', permission: 'HIGH_LEVEL' },
            ],
            status: 'DRAFT',
          } as ArchetypeDto,
        } as ArchetypeJobDataDto,
      } as Job;

      const postEntities = [
        {
          guid: '-2',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Patient',
            name: 'Patient',
            owner: 'owner',
            level: 0,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_0',
            position: { x: 304, y: 100 },
          },
          classifications: [{ typeName: 'root_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
          },
        },
        {
          guid: '-3',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Health',
            name: 'Health',
            owner: 'owner',
            level: 1,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_2',
            position: { x: -168.796875, y: 284 },
          },
          classifications: [
            { typeName: 'branch_node', propagate: false },
            {
              typeName: 'archetype_node_analysis_permissions',
              propagate: true,
              removePropagationsOnEntityDelete: true,
              attributes: { access_level: 'DETAILED' },
            },
          ],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
          },
        },
        {
          guid: '-4',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Medications',
            name: 'Medications',
            owner: 'owner',
            level: 1,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_3',
            position: { x: 927.5138761541593, y: 304.8921088895832 },
          },
          classifications: [
            { typeName: 'leaf_node', propagate: false },
            {
              typeName: 'archetype_node_analysis_permissions',
              propagate: true,
              removePropagationsOnEntityDelete: true,
              attributes: { access_level: 'HIGH_LEVEL' },
            },
          ],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
            column: {
              guid: '169a64d4-e800-41d3-9c13-e2acd8f4acbe',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-5',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Demographics',
            name: 'Demographics',
            owner: 'owner',
            level: 1,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_4',
            position: { x: 182.203125, y: 297 },
          },
          classifications: [
            { typeName: 'branch_node', propagate: false },
            {
              typeName: 'archetype_node_analysis_permissions',
              propagate: true,
              removePropagationsOnEntityDelete: true,
              attributes: { access_level: 'HIGH_LEVEL' },
            },
          ],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
          },
        },
        {
          guid: '-6',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Condition',
            name: 'Condition',
            owner: 'owner',
            level: 1,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_5',
            position: { x: 542.203125, y: 308 },
          },
          classifications: [
            { typeName: 'branch_node', propagate: false },
            {
              typeName: 'archetype_node_analysis_permissions',
              propagate: true,
              removePropagationsOnEntityDelete: true,
              attributes: { access_level: 'DETAILED' },
            },
          ],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
          },
        },
        {
          guid: '-7',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Critical',
            name: 'Critical',
            owner: 'owner',
            level: 2,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_6',
            position: { x: 696.9084316749986, y: 391.1078911104168 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-6' },
            column: {
              guid: 'a2f95901-28f6-4dd8-a640-4b732ca567ec',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-8',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Diagnosis',
            name: 'Diagnosis',
            owner: 'owner',
            level: 2,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_7',
            position: { x: 444.203125, y: 394 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-6' },
            column: {
              guid: '08723348-30dc-43f9-a411-b61030f0231a',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-9',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Age',
            name: 'Age',
            owner: 'owner',
            level: 2,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_8',
            position: { x: 177.203125, y: 393 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-5' },
            column: {
              guid: 'd3bedeb3-8e46-4f9d-9527-d001546eb33e',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-10',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Heart rate',
            name: 'Heart rate',
            owner: 'owner',
            level: 2,
            qualifiedName:
              'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF@node_9',
            position: { x: -377.18653725832723, y: 395.67632666874965 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'GUID_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-3' },
            column: {
              guid: '612e9b6d-5402-4e03-9435-36085e674f7f',
              typeName: 'rdbms_column',
            },
          },
        },
      ];

      // Spies for methods
      const spySeparate = jest.spyOn(service as any, 'separateColumnsNodes');
      const spyToAtlas = jest.spyOn(
        service as any,
        'archetypeTemplateToAtlasEntities',
      );
      (atlasService.post as jest.Mock)
        .mockResolvedValueOnce({ guidAssignments: { t1: 'GUID_123' } }) // for /entity
        .mockResolvedValueOnce({ success: true }); // for /entity/bulk
      (prismaService.project.update as jest.Mock).mockResolvedValueOnce({});

      // mock prisma update
      (prismaService.project.update as jest.Mock).mockResolvedValueOnce({});

      const result = await service.handleAddArchetypeJob(job);

      // verify archetypeId generated
      expect(result).toBe('2Tyz5UfLBCXF');

      // Verify real methods ran
      expect(spySeparate).toHaveBeenCalledTimes(1);
      expect(spyToAtlas).toHaveBeenCalledTimes(1);

      // Inspect actual return from helper
      const separateResult = spySeparate.mock.results[0].value;
      const atlasEntitiesResult = spyToAtlas.mock.results[0].value as Record<
        string,
        unknown
      >;

      expect(separateResult).toHaveProperty('nodes');
      expect(separateResult).toHaveProperty('columns');

      expect(atlasEntitiesResult.entities).toEqual(postEntities);

      // Verify that the /entity/bulk call used those real entities
      expect(atlasService.post).toHaveBeenCalledWith('/entity/bulk', {
        entities: atlasEntitiesResult.entities,
      });

      expect(atlasService.post).toHaveBeenCalledWith(
        '/entity',
        expect.objectContaining({
          entity: expect.objectContaining({
            typeName: AtlasArchetypeTypeName.Template,
            attributes: expect.objectContaining({
              qualifiedName:
                'ac87bc38-bc56-4322-b569-bd7b4b68f7a7@2Tyz5UfLBCXF',
            }),
          }),
        }),
        undefined,
      );

      expect(prismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'ac87bc38-bc56-4322-b569-bd7b4b68f7a7' },
        }),
      );
    });
  });

  //   describe('handleUpdateArchetypeJob', () => {
  //     it('should process update archetype job', async () => {
  //       const job = {
  //         id: '2',
  //         data: { archetype: { guid: 'abc' } },
  //       } as unknown as Job;

  //       jest
  //         .spyOn(atlasService, 'updateEntity')
  //         .mockResolvedValueOnce({ updated: true } as any);

  //       await service.handleUpdateArchetypeJob(job);

  //       expect(atlasService.updateEntity).toHaveBeenCalled();
  //     });
  //   });

  //   describe('handleDeleteArchetypeJob', () => {
  //     it('should process delete archetype job', async () => {
  //       const job = { id: '3', data: { guid: 'xyz' } } as unknown as Job;

  //       jest
  //         .spyOn(atlasService, 'deleteEntity')
  //         .mockResolvedValueOnce({ deleted: true } as any);

  //       await service.handleDeleteArchetypeJob(job);

  //       expect(atlasService.deleteEntity).toHaveBeenCalled();
  //     });
  //   });
});
