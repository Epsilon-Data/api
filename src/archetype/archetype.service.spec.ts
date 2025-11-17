/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ArchetypeService } from './archetype.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import {
  AtlasArchetypeEntityDto,
  AtlasArchetypeNodeAttributesDto,
  AtlasArchetypeTypeName,
  AtlasEntityDto,
  AtlasEntityResponseDto,
  AtlasQueryType,
  AtlasSearchBasicHeadlessResponseDto,
  AtlasSearchBasicResponseDto,
} from 'src/atlas/dto';
import { ArchetypeNodeType, ArchetypePermission, ArchetypeStatus } from './dto';
import { Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

describe('ArchetypeService', () => {
  let service: ArchetypeService;
  let atlas: jest.Mocked<AtlasService>;
  let logSpy: jest.SpyInstance<any, unknown[], unknown>;

  const mockQueue = {} as unknown as jest.Mocked<QueueService>;

  beforeAll(() => {
    logSpy = jest
      .spyOn(Logger.prototype as any, 'error')
      .mockImplementation(() => {});
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
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

    service = module.get(ArchetypeService);
    atlas = module.get(AtlasService);
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

  describe('getArchetypeDetails', () => {
    it('builds template info with nodes, edges, column nodes, and permissions', async () => {
      const projectId = '16297faf-b27d-4227-913b-9ccf4c480211';
      const templateGuid = 'template-guid';
      const archetypeId = '8ryVfIcqIpqN';
      const token = 'tkn';
      const createTime = 1762158127596;
      const updateTime = 1762177232106;

      // Root node (level 0) with ACTIVE status, no permissions expected for root
      const rootGuid = 'root-guid';
      const rootNodeId = 'node_0'; // needs to be random in the future
      const rootQN = `${projectId}@${archetypeId}@${rootNodeId}`;

      // Child category node (level 1), ACTIVE, with parent relation and a column relation
      const catGuid = 'cat-guid';
      const catNodeId = 'node_1';
      const catQN = `${projectId}@${archetypeId}@${catNodeId}`;
      const columnGuid = 'col-guid';
      const tableName = `public.examination`;
      const columnQN = `${projectId}@${tableName}@column_hr`;

      const atlasResponse = {
        entity: {
          guid: templateGuid,
          typeName: AtlasArchetypeTypeName.Template,
          attributes: {
            owner: 'owner',
            replicatedTo: null,
            userDescription: null,
            replicatedFrom: null,
            qualifiedName: '16297faf-b27d-4227-913b-9ccf4c480211@8ryVfIcqIpqN',
            displayName: null,
            name: 'Test archetype',
            description: null,
            projectId: '16297faf-b27d-4227-913b-9ccf4c480211',
            status: 'PUBLISHED',
          } as AtlasArchetypeNodeAttributesDto,
          updateTime, // used to set lastModified
          createTime,
        } as AtlasArchetypeEntityDto,
        referredEntities: {
          // Root node entity
          [rootGuid]: {
            guid: rootGuid,
            typeName: 'archetype_node',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: rootQN,
              level: 0,
              label: 'Root',
              position: { x: 100, y: 100 },
            },
            relationshipAttributes: {
              template: {
                guid: templateGuid,
                typeName: 'archetype_template',
                relationshipStatus: 'ACTIVE',
                qualifiedName: `${projectId}@${archetypeId}`,
              },
              parent_node: null, // no parents as it's root
              column: null, // not columns as it's root
              child_nodes: [],
            },
            classifications: [
              {
                typeName: 'root_node',
                entityGuid: rootGuid,
                entityStatus: 'ACTIVE',
                propagate: false,
                removePropagationsOnEntityDelete: false,
              },
            ],
          },

          // Category child entity with parent relation to root, and a column relation
          [catGuid]: {
            guid: catGuid,
            typeName: 'archetype_node',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: catQN,
              level: 1,
              label: 'Heart rate',
              position: { x: 200, y: 220 },
            },
            relationshipAttributes: {
              template: {
                guid: templateGuid,
                typeName: 'archetype_template',
                relationshipStatus: 'ACTIVE',
                qualifiedName: `${projectId}@${archetypeId}`,
              },
              parent_node: {
                relationshipStatus: 'ACTIVE',
                typeName: 'archetype_node',
                qualifiedName: rootQN,
              },
              column: {
                relationshipStatus: 'ACTIVE',
                typeName: 'rdbms_column',
                guid: columnGuid,
                qualifiedName: columnQN,
              },
            },
            classifications: [
              {
                typeName: 'leaf_node',
                entityGuid: catGuid,
                entityStatus: 'ACTIVE',
                propagate: false,
                removePropagationsOnEntityDelete: false,
              },
              {
                typeName: 'archetype_node_analysis_permissions',
                entityStatus: 'ACTIVE',
                entityGuid: catGuid,
                attributes: { access_level: 'DETAILED' },
              },
              // Simulate a propagated permission on someone else — should not match entityGuid and thus ignored
              {
                typeName: 'archetype_node_analysis_permissions',
                entityStatus: 'ACTIVE',
                entityGuid: 'some-other-guid',
                attributes: { access_level: 'HIGH' },
              },
            ],
          },

          // column related to template (should not exist, but testing if it gets excluded)
          [columnGuid]: {
            guid: columnGuid,
            typeName: 'rdbms_column',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: columnQN,
            },
            relationshipAttributes: {
              archetype_nodes: [],
              table: {},
            },
            classifications: [],
          },

          // Add an INACTIVE node to ensure it is skipped entirely
          inactive: {
            guid: 'inactive-guid',
            typeName: 'archetype_node',
            status: 'DELETED',
            attributes: {
              qualifiedName: `${projectId}@${archetypeId}@node_inactive`,
              level: 1,
              label: 'Inactive',
              position: { x: 0, y: 0 },
            },
            relationshipAttributes: {},
          },
        },
      };

      atlas.get.mockResolvedValueOnce(atlasResponse);

      const result = await service.getArchetypeDetails(
        projectId,
        archetypeId,
        token,
      );

      // Call + params assertions
      expect(atlas.get).toHaveBeenCalledTimes(1);
      const [endpoint, params, forwardedToken] = atlas.get.mock.calls[0];
      expect(endpoint).toBe(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
      );
      expect(params).toEqual({
        'attr:qualifiedName': `${projectId}@${archetypeId}`,
        ignoreRelationships: false,
        minExtInfo: false,
      });
      expect(forwardedToken).toBe(token);

      // Template-level mapping
      expect(result.projectId).toBe(projectId);
      expect(result.archetypeId).toBe(archetypeId);
      expect(result.name).toBe('Test archetype');
      expect(result.status).toBe('PUBLISHED' as ArchetypeStatus);
      expect(result.lastModified).toEqual(new Date(updateTime));

      // Nodes:
      // - root node: id=node_0, type=root, position from attributes
      // - category child: id=node_1, type=category, position from attributes
      // - column node derived from relation: id=columnGuid, type=Column, label from qn last segment
      // order is based on iteration over referredEntities; assert presence rather than strict order
      result.nodes = result.nodes || [];
      const nodeIds = result.nodes?.map((n) => n.id);
      expect(nodeIds).toEqual(
        expect.arrayContaining([rootNodeId, catNodeId, columnGuid]),
      );

      const rootNode = result.nodes.find((n) => n.id === rootNodeId)!;
      expect(rootNode.type).toBe('root' as ArchetypeNodeType);
      expect(rootNode.data).toEqual({ label: 'Root', level: 0 });
      expect(rootNode.position).toEqual({ x: 100, y: 100 });

      const catNode = result.nodes.find((n) => n.id === catNodeId)!;
      expect(catNode.type).toBe('category' as ArchetypeNodeType);
      expect(catNode.data).toEqual({ label: 'Heart rate', level: 1 });
      expect(catNode.position).toEqual({ x: 200, y: 220 });

      const columnNode = result.nodes.find((n) => n.id === columnGuid)!;
      expect(columnNode.type).toBe(ArchetypeNodeType.Column);
      expect(columnNode.data.label).toBe('column_hr');
      // derived position: y + 200 from parent category node
      expect(columnNode.position).toEqual({ x: 200, y: 220 + 200 });
      expect(columnNode.data.level).toBe(2); // cat level + 1

      // Edges:
      // - parent edge: root -> category
      // - column edge: category -> column
      result.edges = result.edges || [];
      const edgeIds = result.edges?.map((e) => e.id);
      expect(edgeIds).toEqual(
        expect.arrayContaining([
          `edge_${rootNodeId}_${catNodeId}`,
          `edge_${catNodeId}_${columnGuid}`,
        ]),
      );

      const parentEdge = result.edges.find(
        (e) => e.id === `edge_${rootNodeId}_${catNodeId}`,
      )!;
      expect(parentEdge.source).toBe(rootNodeId);
      expect(parentEdge.target).toBe(catNodeId);

      const columnEdge = result.edges.find(
        (e) => e.id === `edge_${catNodeId}_${columnGuid}`,
      )!;
      expect(columnEdge.source).toBe(catNodeId);
      expect(columnEdge.target).toBe(columnGuid);

      // Permissions:
      // - root should NOT have permissions due to level === 0
      // - category node has an ACTIVE matching classification with same entityGuid
      expect(result.permissions).toEqual([
        { id: catNodeId, permission: 'DETAILED' as ArchetypePermission },
      ]);
    });

    it('skips edges/column when relationship entityStatus is not ACTIVE', async () => {
      const projectId = 'proj-x';
      const archetypeId = 'arch-y';

      const rootGuid = 'a';
      const catGuid = 'b';
      const rootNodeId = 'node_0'; // needs to be random in the future
      const catNodeId = 'node_1';

      const rootQN = `${projectId}@${archetypeId}@${rootNodeId}`;
      const catQN = `${projectId}@${archetypeId}@${catNodeId}`;

      const atlasResponse = {
        entity: {
          typeName: AtlasArchetypeTypeName.Template,
          attributes: { name: 'X', status: 'DRAFT' },
          updateTime: 1,
        },
        referredEntities: {
          [rootGuid]: {
            guid: 'a',
            typeName: 'archetype_node',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: rootQN,
              level: 0,
              label: 'Root',
              position: { x: 0, y: 0 },
            },
            relationshipAttributes: {},
          },
          [catGuid]: {
            guid: 'b',
            typeName: 'archetype_node',
            status: 'ACTIVE',
            attributes: {
              qualifiedName: catQN,
              level: 1,
              label: 'Child',
              position: { x: 10, y: 10 },
            },
            relationshipAttributes: {
              parent_node: {
                relationshipStatus: 'ACTIVE',
                guid: rootGuid,
                qualifiedName: rootQN,
              },
              column: {
                relationshipStatus: 'DELETED',
                guid: 'cg',
                qualifiedName: `${projectId}@${archetypeId}@col`,
              }, // skip column
            },
          },
        },
      };

      atlas.get.mockResolvedValueOnce(atlasResponse);

      const result = await service.getArchetypeDetails(projectId, archetypeId);

      // nodes should include root + child only (no column)
      result.nodes = result.nodes || [];
      expect(result.nodes.map((n) => n.id)).toEqual(
        expect.arrayContaining([rootNodeId, catNodeId]),
      );
      expect(result.nodes.find((n) => n.id === 'cg')).toBeUndefined();

      // no edges due to non-ACTIVE relations
      expect(result.edges).toHaveLength(1);

      result.edges = result.edges || [];
      const parentEdge = result.edges.find(
        (e) => e.id === `edge_${rootNodeId}_${catNodeId}`,
      )!;
      expect(parentEdge.source).toBe(rootNodeId);
      expect(parentEdge.target).toBe(catNodeId);
    });

    // TODO: this needs to be better tested
    it('forwards AtlasService errors', async () => {
      const projectId = 'p';
      const archetypeId = 'a';
      atlas.get.mockRejectedValueOnce(new Error('atlas down'));
      await expect(
        service.getArchetypeDetails(projectId, archetypeId),
      ).rejects.toThrow('atlas down');
    });
  });

  describe('updateArchetypeDetails', () => {
    it('calls Atlas PUT with correct endpoint, body, params, and token', async () => {
      const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
      const archetypeId = 'Xa7BAIWZCA8u';
      const token = 'test-token';
      const attributes = {
        name: 'New Name',
        status: ArchetypeStatus.PUBLISHED,
      };

      atlas.put.mockResolvedValueOnce({});

      await expect(
        service.updateArchetypeDetails(
          projectId,
          archetypeId,
          attributes,
          token,
        ),
      ).resolves.toBeUndefined();

      expect(atlas.put).toHaveBeenCalledTimes(1);
      const [endpoint, body, params, forwardedToken] = atlas.put.mock.calls[0];

      expect(endpoint).toBe(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
      );
      expect(body).toEqual({
        entity: {
          typeName: AtlasArchetypeTypeName.Template,
          attributes,
        },
      });
      expect(params).toEqual({
        'attr:qualifiedName': `${projectId}@${archetypeId}`,
      });
      expect(forwardedToken).toBe(token);
    });

    it('logs and rethrows when Atlas PUT fails', async () => {
      const projectId = 'p';
      const archetypeId = 'a';
      const attributes = { status: ArchetypeStatus.DRAFT };
      const err = new Error('Atlas PUT failed');
      atlas.put.mockRejectedValueOnce(err);

      await expect(
        service.updateArchetypeDetails(projectId, archetypeId, attributes),
      ).rejects.toThrow('Atlas PUT failed');

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
