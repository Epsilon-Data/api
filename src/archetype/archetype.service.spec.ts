/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ArchetypeService } from './archetype.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import {
  AtlasArchetypeTypeName,
  AtlasEntityDto,
  AtlasEntityResponseDto,
  AtlasPutEntityResponseDto,
  AtlasQueryType,
  AtlasSearchBasicHeadlessResponseDto,
  AtlasSearchBasicResponseDto,
} from 'src/atlas/dto';
import { ArchetypeStatus } from './dto';
import { BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { $Enums } from '@prisma/client';

describe('ArchetypeService', () => {
  let service: ArchetypeService;
  let atlas: jest.Mocked<AtlasService>;
  let prisma: jest.Mocked<PrismaService>;
  let logSpy: jest.SpyInstance<any, unknown[], unknown>;
  let moduleRef: TestingModule;

  const mockQueue = {} as unknown as jest.Mocked<QueueService>;

  beforeAll(() => {
    logSpy = jest
      .spyOn(Logger.prototype as any, 'error')
      .mockImplementation(() => {});
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        ArchetypeService,
        {
          provide: AtlasService,
          useValue: { get: jest.fn(), post: jest.fn(), put: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            project: { update: jest.fn() },
          },
        },
        { provide: QueueService, useValue: mockQueue },
      ],
    }).compile();

    service = moduleRef.get(ArchetypeService);
    atlas = moduleRef.get(AtlasService);
    prisma = moduleRef.get(PrismaService);
    jest.clearAllMocks();
  });

  describe('fetchArchetypes', () => {
    const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
    const token = 'test-token';

    it('calls Atlas /search/basic with correct body and token, and maps results', async () => {
      const ts = 1761812843720;
      const modTs = 1761926760710;

      const atlasResponse = {
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        entities: [
          {
            typeName: 'archetype_template',
            attributes: {
              owner: 'owner',
              qualifiedName: `${projectId}@Xa7BAIWZCA8u`,
              __createdBy: 'admin',
              __modificationTimestamp: modTs,
              name: 'Test Draft Update 8',
              description: '',
              projectId,
              __timestamp: ts,
              status: 'DRAFT',
            },
            guid: '329fedeb-c6ac-4b37-996c-f658c2cdeafd',
            status: 'ACTIVE',
            displayText: 'Test Draft Update 8',
            classificationNames: [],
            meaningNames: [],
            meanings: [],
            isIncomplete: false,
            labels: [],
          },

          {
            typeName: 'archetype_template',
            attributes: {
              owner: 'owner',
              qualifiedName: `${projectId}@Xmh_T6fKZnqY`,
              __createdBy: 'admin',
              __modificationTimestamp: modTs + 1000,
              name: 'Details Updated 6',
              description: '',
              projectId,
              __timestamp: ts + 1000,
              status: 'PUBLISHED',
            },
            guid: '4bd46479-d4b8-4ca4-8221-19a08b7e1f34',
            status: 'ACTIVE',
            displayText: 'Details Updated 6',
            classificationNames: [],
            meaningNames: [],
            meanings: [],
            isIncomplete: false,
            labels: [],
          },
        ],
        approximateCount: 2,
      };

      atlas.post.mockResolvedValueOnce(atlasResponse);

      const result = await service.fetchArchetypes(projectId, token);

      // Assert atlas.post called with endpoint, body, token
      expect(atlas.post).toHaveBeenCalledTimes(1);
      const [endpoint, bodyArg, tokenArg] = atlas.post.mock.calls[0];

      expect(endpoint).toBe('/search/basic');
      expect(tokenArg).toBe(token);

      // Body shape checks
      expect(bodyArg).toMatchObject({
        typeName: AtlasArchetypeTypeName.Template,
        excludeDeletedEntities: true,
        includeClassificationAttributes: false,
        includeSubTypes: false,
        includeSubClassifications: false,
        excludeHeaderAttributes: false,
        entityFilters: {
          attributeName: 'projectId',
          operator: 'eq',
          attributeValue: projectId,
        },
        attributes: [
          'name',
          'qualifiedName',
          'status',
          '__createdBy',
          '__timestamp',
          '__modificationTimestamp',
        ],
      });

      // Mapping checks
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'Xa7BAIWZCA8u',
        name: 'Test Draft Update 8',
        status: 'DRAFT',
        createdBy: 'owner',
        created: new Date(ts),
        lastModified: new Date(modTs),
      });
      expect(result[1]).toEqual({
        id: 'Xmh_T6fKZnqY',
        name: 'Details Updated 6',
        status: 'PUBLISHED',
        createdBy: 'owner',
        created: new Date(ts + 1000),
        lastModified: new Date(modTs + 1000),
      });
    });

    it('returns [] when response has no entities', async () => {
      const atlasResponse: AtlasSearchBasicResponseDto = {
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        approximateCount: 0,
      };
      atlas.post.mockResolvedValueOnce(atlasResponse);
      await expect(service.fetchArchetypes(projectId)).resolves.toEqual([]);
    });

    // TODO: this needs to be better tested
    it('forwards thrown errors from AtlasService.post', async () => {
      atlas.post.mockRejectedValueOnce(new Error('atlas down'));
      await expect(service.fetchArchetypes(projectId)).rejects.toThrow(
        'atlas down',
      );
    });
  });

  describe('updateArchetypeDetails', () => {
    it('updates status and attributes, unpublishes previous published archetype, and updates project', async () => {
      const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
      const archetypeId = 'Xa7BAIWZCA8u';
      const token = 'test-token';
      const qualifiedName = `${projectId}@${archetypeId}`;

      const attributes = {
        name: 'New Name',
        status: ArchetypeStatus.PUBLISHED,
      };

      // Search result: current archetype ACTIVE, another one already PUBLISHED
      const searchResult: AtlasSearchBasicHeadlessResponseDto = {
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        attributes: {
          name: ['qualifiedName', 'status'],
          values: [
            [qualifiedName, ArchetypeStatus.ACTIVE], // current one
            [`${projectId}@OTHER`, ArchetypeStatus.PUBLISHED], // previously published
          ],
        },
        approximateCount: 2,
      };

      atlas.post.mockResolvedValueOnce(searchResult);

      // atlas.put is used by updateAtlasTemplateAttributes (current + previous)
      atlas.put.mockResolvedValue({} as AtlasPutEntityResponseDto);

      // allow any transition in this test
      const canTransitionSpy = jest
        .spyOn(service as any, 'canTransition')
        .mockReturnValue(true);

      (prisma.project.update as jest.Mock).mockResolvedValue({});

      await expect(
        service.updateArchetypeDetails(
          projectId,
          archetypeId,
          attributes,
          token,
        ),
      ).resolves.toBeUndefined();

      // search/basic called correctly
      expect(atlas.post).toHaveBeenCalledTimes(1);
      expect(atlas.post).toHaveBeenCalledWith(
        '/search/basic',
        {
          typeName: AtlasArchetypeTypeName.Template,
          excludeDeletedEntities: true,
          includeSubClassifications: false,
          excludeHeaderAttributes: true,
          includeSubTypes: false,
          includeClassificationAttributes: false,
          entityFilters: {
            attributeName: 'projectId',
            operator: 'eq',
            attributeValue: projectId,
          },
          attributes: ['qualifiedName', 'status'],
        },
        token,
      );

      // transition check
      expect(canTransitionSpy).toHaveBeenCalledWith(
        ArchetypeStatus.ACTIVE,
        ArchetypeStatus.PUBLISHED,
      );

      // atlas.put called twice: current archetype + previous published
      expect(atlas.put).toHaveBeenCalledTimes(2);

      // first call: update current archetype with provided attributes
      expect(atlas.put).toHaveBeenNthCalledWith(
        1,
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          entity: {
            typeName: AtlasArchetypeTypeName.Template,
            attributes,
          },
        },
        {
          'attr:qualifiedName': qualifiedName,
        },
        token,
      );

      // second call: unpublish previous published archetype (set status ACTIVE)
      expect(atlas.put).toHaveBeenNthCalledWith(
        2,
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          entity: {
            typeName: AtlasArchetypeTypeName.Template,
            attributes: { status: ArchetypeStatus.ACTIVE },
          },
        },
        {
          'attr:qualifiedName': `${projectId}@OTHER`,
        },
        token,
      );

      // 4) project updated to MAPPED with lastModified set
      expect(prisma.project.update).toHaveBeenCalledTimes(1);
      expect(prisma.project.update).toHaveBeenCalledWith({
        where: { projectId },
        data: {
          lastModified: expect.any(Date),
          status: $Enums.ProjectStatus.MAPPED,
        },
      });
    });

    it('rejects update because of transition not allowed', async () => {
      const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
      const archetypeId = 'Xa7BAIWZCA8u';
      const qualifiedName = `${projectId}@${archetypeId}`;

      const attributes = {
        name: 'New Name',
        status: ArchetypeStatus.DRAFT,
      };

      // Search result: current archetype ACTIVE, another one already PUBLISHED
      const searchResult: AtlasSearchBasicHeadlessResponseDto = {
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        attributes: {
          name: ['qualifiedName', 'status'],
          values: [
            [qualifiedName, ArchetypeStatus.ACTIVE], // current one
          ],
        },
        approximateCount: 2,
      };

      atlas.post.mockResolvedValueOnce(searchResult);

      // allow any transition in this test
      const canTransitionSpy = jest.spyOn(service as any, 'canTransition');
      await expect(
        service.updateArchetypeDetails(projectId, archetypeId, attributes),
      ).rejects.toThrow(`Cannot transition archetype from ACTIVE to DRAFT`);

      const err = new BadRequestException(
        'Cannot transition archetype from ACTIVE to DRAFT',
      );
      expect(canTransitionSpy).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith(
        'Error updating archetype details',
        err,
      );
    });

    it('logs and rethrows when Atlas call fails', async () => {
      const projectId = 'p';
      const archetypeId = 'a';
      const qualifiedName = `${projectId}@${archetypeId}`;
      const attributes = { status: ArchetypeStatus.DRAFT };

      const searchResult: AtlasSearchBasicHeadlessResponseDto = {
        queryType: AtlasQueryType.BASIC,
        approximateCount: 1,
        searchParameters: {},
        attributes: {
          name: ['qualifiedName', 'status'],
          values: [[qualifiedName, ArchetypeStatus.ACTIVE]],
        },
      };

      atlas.post.mockResolvedValueOnce(searchResult);
      jest.spyOn(service as any, 'canTransition').mockReturnValue(true);

      const err = new Error('Unexpected server error');
      atlas.put.mockRejectedValueOnce(err);

      await expect(
        service.updateArchetypeDetails(projectId, archetypeId, attributes),
      ).rejects.toThrow('Unexpected server error');

      expect(logSpy).toHaveBeenCalledWith(
        'Error updating archetype details',
        err,
      );
    });
  });

  describe('getAnalysisArchetype', () => {
    it('returns a JSON Schema composed from template nodes/columns (with nesting under parent)', async () => {
      const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
      const token = 'test-token';
      const archetypeId = 'Xa7BAIWZCA8u';
      const templateGuid = '329fedeb-c6ac-4b37-996c-f658c2cdeafd';
      const templateName = 'My Archetype Title';

      // mock for getting GUID and name of PUBLISHED template
      // one result -> name + guid
      const headless: AtlasSearchBasicHeadlessResponseDto = {
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        attributes: {
          name: ['name', '__guid'],
          values: [[templateName, templateGuid]],
        },
        approximateCount: 1,
      };
      atlas.post.mockResolvedValueOnce(headless);

      // mock template entity with referredEntities: parent node and child node (with a column)
      // parent: label "Patient Info" (has child_nodes)
      // child: label "Age" (has parent_node=Patient Info, and has a column)
      const parentQN = `${projectId}@${archetypeId}@node_parent`;
      const childQN = `${projectId}@${archetypeId}@node_child`;
      const columnGuid = 'col-123';
      const tableName = `public.examination`;
      const columnQN = `${projectId}@${tableName}@column_age`;

      const templateEntity = {
        entity: {
          guid: templateGuid,
          typeName: AtlasArchetypeTypeName.Template,
          attributes: {
            name: templateName,
            status: 'PUBLISHED',
          },
        },
        referredEntities: {
          PARENT: {
            guid: 'PARENT',
            typeName: 'archetype_node',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: parentQN,
              label: 'Patient Info',
            },
            relationshipAttributes: {
              template: {
                guid: templateGuid,
                typeName: 'archetype_template',
                relationshipStatus: 'ACTIVE',
                qualifiedName: `${projectId}@${archetypeId}`,
              },
              parent_node: null,
              child_nodes: [{}, {}], // for length check
            },
          },
          CHILD: {
            guid: 'CHILD',
            typeName: 'archetype_node',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: childQN,
              label: 'Age',
            },
            relationshipAttributes: {
              parent_node: {
                typeName: 'archetype_node',
                relationshipStatus: 'ACTIVE',
                displayText: 'Patient Info',
                qualifiedName: parentQN,
              },
              template: {
                guid: templateGuid,
                typeName: 'archetype_template',
                relationshipStatus: 'ACTIVE',
                qualifiedName: `${projectId}@${archetypeId}`,
              },
              column: {
                typeName: 'rdbms_column',
                relationshipStatus: 'ACTIVE',
                guid: columnGuid,
                qualifiedName: columnQN,
              },
            },
          },
        },
      };
      atlas.get.mockResolvedValueOnce(templateEntity);

      // mock column entity lookup
      // provide data_type -> mapped to "integer"
      const columnEntity: AtlasEntityResponseDto = {
        entity: {
          guid: columnGuid,
          typeName: 'rdbms_column',
          attributes: { data_type: 'int' } as Record<string, unknown>,
        } as AtlasEntityDto,
        referredEntities: {},
      };
      atlas.get.mockResolvedValueOnce(columnEntity);

      const schema = (await service.getAnalysisArchetype(projectId, token)) as {
        $schema: 'https://json-schema.org/draft/2020-12/schema#';
        title: string;
        type: 'object';
        properties: Record<string, object>;
      };

      // Assert atlas.post called with endpoint, body, token
      expect(atlas.post).toHaveBeenCalledTimes(1);
      const [endpoint, body, fwdToken] = atlas.post.mock.calls[0];
      expect(endpoint).toBe('/search/basic');
      expect(fwdToken).toBe(token);

      expect(body).toMatchObject({
        typeName: AtlasArchetypeTypeName.Template,
        excludeDeletedEntities: true,
        includeSubClassifications: false,
        excludeHeaderAttributes: true,
        includeSubTypes: false,
        entityFilters: {
          condition: 'AND',
          criterion: [
            {
              attributeName: 'projectId',
              operator: 'eq',
              attributeValue: projectId,
            },
            {
              attributeName: 'status',
              operator: 'eq',
              attributeValue: 'PUBLISHED',
            },
          ],
        },
        attributes: ['name', '__guid'],
      });

      // fetch template by guid and column by guid
      expect(atlas.get).toHaveBeenNthCalledWith(
        1,
        `/entity/guid/${templateGuid}`,
        undefined,
        token,
      );
      expect(atlas.get).toHaveBeenNthCalledWith(
        2,
        `/entity/guid/${columnGuid}`,
        undefined,
        token,
      );

      // Schema basics
      expect(schema.$schema).toBe(
        'https://json-schema.org/draft/2020-12/schema#',
      );
      expect(schema.title).toBe(templateName);
      expect(schema.type).toBe('object');
      expect(schema.properties).toBeDefined();

      // Parent object should exist (derived from "Patient Info" -> "patient_info")
      const parentKey = 'patient_info';
      expect(schema.properties[parentKey]).toBeDefined();
      expect(schema.properties[parentKey]).toMatchObject({
        type: 'object',
        properties: expect.any(Object) as Record<string, unknown>,
      });

      // Child column "Age" -> objectName "age" becomes a property under parent
      expect(schema.properties[parentKey]['properties']).toMatchObject({
        age: {
          type: 'integer', // from atlasTypeToJSONType
          description: 'Age',
        },
      });
    });

    it('returns {} when no published archetype is found', async () => {
      const projectId = 'proj-empty';
      atlas.post.mockResolvedValueOnce({
        approximateCount: 0,
        queryType: 'BASIC',
        searchParameters: {},
      } as AtlasSearchBasicHeadlessResponseDto);

      const res = await service.getAnalysisArchetype(projectId);
      expect(res).toEqual({});
      expect(atlas.get).not.toHaveBeenCalled();
    });

    it('logs and rethrows on unexpected errors', async () => {
      const projectId = 'oops';
      const err = new Error('boom');

      atlas.post.mockRejectedValueOnce(err);

      await expect(service.getAnalysisArchetype(projectId)).rejects.toThrow(
        'boom',
      );
      expect(logSpy).toHaveBeenCalledWith(
        'Error getting Analysis Archetype structure',
        err,
      );
    });
  });

  // NODE: methods that implement queue will be tested in atlas.processor.spec.ts
});
