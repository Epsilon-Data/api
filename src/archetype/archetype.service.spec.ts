/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/unbound-method */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Readable } from 'stream';
import { ArchetypeService } from './archetype.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { QueueService } from 'src/queue/queue.service';
import {
  AtlasArchetypeEntityDto,
  AtlasArchetypeNodeAttributesDto,
  AtlasArchetypeTypeName,
  AtlasEntityDto,
  AtlasEntityResponseDto,
  AtlasPutEntityResponseDto,
  AtlasQueryType,
  AtlasSearchBasicHeadlessResponseDto,
  AtlasSearchBasicResponseDto,
} from 'src/atlas/dto';
import { ArchetypeNodeType, ArchetypePermission, ArchetypeStatus } from './dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { FileStorageService } from 'src/file-storage/file_storage.service';
import { $Enums } from 'src/generated/prisma/client';
import { KeycloakAdminService } from 'src/admin/keycloak/keycloak-admin.service';

describe('ArchetypeService', () => {
  let service: ArchetypeService;
  let atlas: jest.Mocked<AtlasService>;
  let prisma: jest.Mocked<PrismaService>;
  let keycloak: jest.Mocked<KeycloakAdminService>;
  let fileStorage: jest.Mocked<FileStorageService>;
  let moduleRef: TestingModule;

  const mockQueue = {} as unknown as jest.Mocked<QueueService>;

  beforeAll(() => {});

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
            project: {
              update: jest.fn(),
              findUnique: jest.fn(),
              findUniqueOrThrow: jest.fn(),
            },
          },
        },
        { provide: QueueService, useValue: mockQueue },
        {
          provide: KeycloakAdminService,
          useValue: {
            getUserInfoById: jest.fn(),
          },
        },
        {
          provide: FileStorageService,
          useValue: { getFileUrl: jest.fn(), getFile: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(ArchetypeService);
    atlas = moduleRef.get(AtlasService);
    prisma = moduleRef.get(PrismaService);
    keycloak = moduleRef.get(KeycloakAdminService);
    fileStorage = moduleRef.get(FileStorageService);
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

      // mock keycloak lookup for owner -> we'll prefer `username` in display logic
      (keycloak.getUserInfoById as jest.Mock).mockResolvedValue({
        id: 'owner',
        username: 'ownerUser',
        firstName: 'Owner',
        lastName: 'User',
        email: 'owner@example.com',
        lastLogin: null,
      } as any);

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
        createdBy: 'Owner User',
        created: new Date(ts),
        lastModified: new Date(modTs),
      });
      expect(result[1]).toEqual({
        id: 'Xmh_T6fKZnqY',
        name: 'Details Updated 6',
        status: 'PUBLISHED',
        createdBy: 'Owner User',
        created: new Date(ts + 1000),
        lastModified: new Date(modTs + 1000),
      });

      expect(keycloak.getUserInfoById).toHaveBeenCalledTimes(1);
      expect(keycloak.getUserInfoById).toHaveBeenCalledWith('owner');
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
          relationshipAttributes: {
            instance: { qualifiedName: `${projectId}@my-db-instance` },
          },
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

      atlas.get.mockResolvedValueOnce(atlasResponse).mockResolvedValueOnce({
        entity: {
          attributes: {
            name: 'my-db',
            rdbms_type: 'postgres',
          },
        },
      } as unknown as AtlasEntityResponseDto);

      const result = await service.getArchetypeDetails(
        projectId,
        archetypeId,
        token,
      );

      // Call + params assertions
      expect(atlas.get).toHaveBeenCalledTimes(2);
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

      const [endpoint2, params2, forwardedToken2] = atlas.get.mock.calls[1];
      expect(endpoint2).toBe(`/entity/uniqueAttribute/type/rdbms_instance`);
      expect(params2).toEqual({
        'attr:qualifiedName': `${projectId}@my-db-instance`,
        ignoreRelationships: true,
        minExtInfo: true,
      });
      expect(forwardedToken2).toBe(token);

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
      expect(result.dbName).toBe('my-db');
      expect(result.dbType).toBe('postgres');
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

      atlas.get.mockResolvedValueOnce(atlasResponse).mockResolvedValueOnce({
        entity: { attributes: { name: 'my-db', rdbms_type: 'postgres' } },
      } as unknown as AtlasEntityResponseDto);

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

  describe('getPublishedArchetype', () => {
    it('builds published template info with nodes, edges, permissions, minus columns', async () => {
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

      const headless: AtlasSearchBasicHeadlessResponseDto = {
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        attributes: {
          name: ['name', '__guid'],
          values: [['Test archetype', templateGuid]],
        },
        approximateCount: 1,
      };
      atlas.post.mockResolvedValueOnce(headless);

      atlas.get.mockResolvedValueOnce(atlasResponse);

      const result = await service.getPublishedArchetype(projectId, token);

      // Call + params assertions
      expect(atlas.post).toHaveBeenCalledTimes(1);

      // Template-level mapping
      expect(result.projectId).toBe(projectId);
      expect(result.archetypeId).toBe(archetypeId);
      expect(result.name).toBe('Test archetype');
      expect(result.status).toBe('PUBLISHED' as ArchetypeStatus);
      expect(result.lastModified).toEqual(new Date(updateTime));

      // Nodes:
      // - root node: id=node_0, type=root, position from attributes
      // - category child: id=node_1, type=category, position from attributes
      // - column node: undefined
      // order is based on iteration over referredEntities; assert presence rather than strict order
      result.nodes = result.nodes || [];
      const nodeIds = result.nodes?.map((n) => n.id);
      expect(nodeIds).toEqual(expect.arrayContaining([rootNodeId, catNodeId]));

      const rootNode = result.nodes.find((n) => n.id === rootNodeId)!;
      expect(rootNode.type).toBe('root' as ArchetypeNodeType);
      expect(rootNode.data).toEqual({ label: 'Root', level: 0 });
      expect(rootNode.position).toEqual({ x: 100, y: 100 });

      const catNode = result.nodes.find((n) => n.id === catNodeId)!;
      expect(catNode.type).toBe('category' as ArchetypeNodeType);
      expect(catNode.data).toEqual({ label: 'Heart rate', level: 1 });
      expect(catNode.position).toEqual({ x: 200, y: 220 });

      const columnNode = result.nodes.find((n) => n.id === columnGuid)!;
      expect(columnNode).toBeUndefined();

      // Edges:
      // - parent edge: root -> category
      // - column edge: undefined
      result.edges = result.edges || [];
      const edgeIds = result.edges?.map((e) => e.id);
      expect(edgeIds).toEqual(
        expect.arrayContaining([`edge_${rootNodeId}_${catNodeId}`]),
      );

      const parentEdge = result.edges.find(
        (e) => e.id === `edge_${rootNodeId}_${catNodeId}`,
      )!;
      expect(parentEdge.source).toBe(rootNodeId);
      expect(parentEdge.target).toBe(catNodeId);

      const columnEdge = result.edges.find(
        (e) => e.id === `edge_${catNodeId}_${columnGuid}`,
      )!;
      expect(columnEdge).toBeUndefined();

      // Permissions: catNode has DETAILED, root is skipped, propagated is ignored
      expect(result.permissions).toEqual([
        { id: catNodeId, permission: 'DETAILED' },
      ]);
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
      expect(canTransitionSpy).toHaveBeenCalledTimes(1);
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
    });
  });

  describe('getAnalysisArchetype', () => {
    it('returns a JSON Schema composed from template nodes/columns (with nesting under parent)', async () => {
      const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
      const token = 'test-token';
      const archetypeId = 'Xa7BAIWZCA8u';
      const templateGuid = '329fedeb-c6ac-4b37-996c-f658c2cdeafd';
      const templateQN = `${projectId}@${archetypeId}`;
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
            qualifiedName: templateQN,
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
            classifications: [
              {
                typeName: 'root_node',
                entityGuid: 'PARENT',
                entityStatus: 'ACTIVE',
                propagate: false,
                removePropagationsOnEntityDelete: false,
              },
            ],
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
            classifications: [
              {
                typeName: 'leaf_node',
                entityGuid: 'CHILD',
                entityStatus: 'ACTIVE',
                propagate: false,
                removePropagationsOnEntityDelete: false,
              },
              {
                typeName: 'archetype_node_analysis_permissions',
                entityStatus: 'ACTIVE',
                entityGuid: 'CHILD',
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

      // synthetic dataset with a manifest attached -> descriptor is available
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/v3/synthetic.csv`,
        syntheticDataSchemaHash: 'hash-abc',
        syntheticDataVersion: 3,
      });

      const schema = (await service.getAnalysisArchetype(projectId, token)) as {
        $id: string;
        $schema: 'https://json-schema.org/draft/2020-12/schema#';
        title: string;
        type: 'object';
        properties: Record<string, object>;
        syntheticData?: {
          available: boolean;
          schemaHash?: string;
          version?: number;
        };
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

      expect(schema.$id).toBe(`${projectId}/${archetypeId}`);
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

      // synthetic dataset descriptor replaces the old syntheticDataUrl field
      expect(schema.syntheticData).toEqual({
        available: true,
        schemaHash: 'hash-abc',
        version: 3,
      });
      expect(schema).not.toHaveProperty('syntheticDataUrl');
    });

    it('marks the synthetic descriptor unavailable for legacy attachments', async () => {
      const { projectId } = mockPublishedTemplateWithLeaves();

      // legacy: S3 key without a manifest hash (predates manifest support)
      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/synthetic.csv`,
        syntheticDataSchemaHash: null,
        syntheticDataVersion: 0,
      });

      const schema = (await service.getAnalysisArchetype(projectId)) as {
        syntheticData?: object;
      };

      expect(schema.syntheticData).toEqual({ available: false });
      expect(schema).not.toHaveProperty('syntheticDataUrl');
    });

    it('throws not found when no published archetype is found', async () => {
      const projectId = 'proj-empty';
      atlas.post.mockResolvedValueOnce({
        approximateCount: 0,
        queryType: 'BASIC',
        searchParameters: {},
      } as AtlasSearchBasicHeadlessResponseDto);

      await expect(service.getAnalysisArchetype(projectId)).rejects.toThrow(
        'No published archetypes found for project proj-empty',
      );
      expect(atlas.get).not.toHaveBeenCalled();
    });
  });

  /**
   * Mock a PUBLISHED template with two allowed leaves:
   *  - "Age" under parent "Patient Info" -> path patient_info.age, column age_years
   *  - "Sex" at the root -> path sex, column sex
   * Returns the ids used by the mocks.
   */
  const mockPublishedTemplateWithLeaves = () => {
    const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
    const archetypeId = 'Xa7BAIWZCA8u';
    const templateGuid = 'tpl-guid';
    const parentQN = `${projectId}@${archetypeId}@node_parent`;

    const headless: AtlasSearchBasicHeadlessResponseDto = {
      queryType: AtlasQueryType.BASIC,
      searchParameters: {},
      attributes: {
        name: ['name', '__guid'],
        values: [['My Archetype', templateGuid]],
      },
      approximateCount: 1,
    };
    atlas.post.mockResolvedValue(headless);

    const templateEntity = {
      entity: {
        guid: templateGuid,
        typeName: AtlasArchetypeTypeName.Template,
        attributes: {
          qualifiedName: `${projectId}@${archetypeId}`,
          name: 'My Archetype',
          status: 'PUBLISHED',
        },
      },
      referredEntities: {
        PARENT: {
          guid: 'PARENT',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: { qualifiedName: parentQN, label: 'Patient Info' },
          relationshipAttributes: {
            parent_node: null,
            child_nodes: [{}],
          },
          classifications: [
            {
              typeName: 'root_node',
              entityGuid: 'PARENT',
              entityStatus: 'ACTIVE',
            },
          ],
        },
        CHILD: {
          guid: 'CHILD',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            qualifiedName: `${projectId}@${archetypeId}@node_child`,
            label: 'Age',
          },
          relationshipAttributes: {
            parent_node: {
              typeName: 'archetype_node',
              relationshipStatus: 'ACTIVE',
              displayText: 'Patient Info',
              qualifiedName: parentQN,
            },
            column: {
              typeName: 'rdbms_column',
              relationshipStatus: 'ACTIVE',
              guid: 'col-age',
              qualifiedName: `${projectId}@public.examination@age_years`,
            },
          },
          classifications: [
            {
              typeName: 'archetype_node_analysis_permissions',
              entityStatus: 'ACTIVE',
              entityGuid: 'CHILD',
              attributes: { access_level: 'DETAILED' },
            },
          ],
        },
        SEX: {
          guid: 'SEX',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            qualifiedName: `${projectId}@${archetypeId}@node_sex`,
            label: 'Sex',
          },
          relationshipAttributes: {
            parent_node: null,
            column: {
              typeName: 'rdbms_column',
              relationshipStatus: 'ACTIVE',
              guid: 'col-sex',
              qualifiedName: `${projectId}@public.examination@sex`,
            },
          },
          classifications: [
            {
              typeName: 'archetype_node_analysis_permissions',
              entityStatus: 'ACTIVE',
              entityGuid: 'SEX',
              attributes: { access_level: 'DETAILED' },
            },
          ],
        },
      },
    };

    atlas.get.mockImplementation(((endpoint: string) => {
      if (endpoint === `/entity/guid/${templateGuid}`)
        return Promise.resolve(templateEntity);
      if (endpoint === '/entity/guid/col-age')
        return Promise.resolve({
          entity: {
            guid: 'col-age',
            typeName: 'rdbms_column',
            attributes: { data_type: 'int', name: 'age_years' },
          },
          referredEntities: {},
        });
      if (endpoint === '/entity/guid/col-sex')
        return Promise.resolve({
          entity: {
            guid: 'col-sex',
            typeName: 'rdbms_column',
            attributes: { data_type: 'string', name: 'sex' },
          },
          referredEntities: {},
        });
      return Promise.reject(new Error(`unexpected atlas GET ${endpoint}`));
    }) as never);

    return { projectId, archetypeId, templateGuid };
  };

  describe('getProjectedSyntheticData', () => {
    it('serves the CSV projected to the archetype leaves with renamed headers', async () => {
      const { projectId } = mockPublishedTemplateWithLeaves();

      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/v2/synthetic.csv`,
        syntheticDataSchemaHash: 'hash-1',
        syntheticDataColumns: ['age_years', 'sex', 'extra'],
        syntheticDataVersion: 2,
      });
      (fileStorage.getFile as jest.Mock).mockResolvedValue(
        Readable.from(['age_years,sex,extra\n54,Female,x\n"3,6",Male,y\n']),
      );

      const result = await service.getProjectedSyntheticData(projectId);

      expect(fileStorage.getFile).toHaveBeenCalledWith(
        'synthetic',
        `${projectId}/v2/synthetic.csv`,
      );
      // projected to the two leaves, renamed to property paths, RFC4180-quoted;
      // the 'extra' source column is never exposed
      expect(result.csv).toBe('patient_info.age,sex\n54,Female\n"3,6",Male\n');
      expect(result.schemaHash).toBe('hash-1');
      expect(result.version).toBe(2);
    });

    it('collapses colliding normalized leaf paths instead of emitting duplicate headers', async () => {
      const projectId = 'proj-collide';
      const templateGuid = 'tpl-collide';
      atlas.post.mockResolvedValue({
        queryType: AtlasQueryType.BASIC,
        searchParameters: {},
        attributes: {
          name: ['name', '__guid'],
          values: [['My Archetype', templateGuid]],
        },
        approximateCount: 1,
      } as AtlasSearchBasicHeadlessResponseDto);

      // two allowed root leaves whose labels normalize to the same path 'age'
      const leaf = (guid: string, label: string, columnGuid: string) => ({
        guid,
        typeName: 'archetype_node',
        status: 'ACTIVE',
        attributes: { qualifiedName: `${projectId}@arch@${guid}`, label },
        relationshipAttributes: {
          parent_node: null,
          column: {
            typeName: 'rdbms_column',
            relationshipStatus: 'ACTIVE',
            guid: columnGuid,
            qualifiedName: `${projectId}@public.t@${columnGuid}`,
          },
        },
        classifications: [
          {
            typeName: 'archetype_node_analysis_permissions',
            entityStatus: 'ACTIVE',
            entityGuid: guid,
            attributes: { access_level: 'DETAILED' },
          },
        ],
      });
      const templateEntity = {
        entity: {
          guid: templateGuid,
          typeName: AtlasArchetypeTypeName.Template,
          attributes: {
            qualifiedName: `${projectId}@arch`,
            name: 'My Archetype',
            status: 'PUBLISHED',
          },
        },
        referredEntities: {
          A: leaf('A', 'Age', 'col-a'),
          B: leaf('B', 'AGE', 'col-b'),
        },
      };
      atlas.get.mockImplementation(((endpoint: string) => {
        if (endpoint === `/entity/guid/${templateGuid}`)
          return Promise.resolve(templateEntity);
        if (endpoint === '/entity/guid/col-a')
          return Promise.resolve({
            entity: {
              guid: 'col-a',
              typeName: 'rdbms_column',
              attributes: { data_type: 'int', name: 'age_a' },
            },
            referredEntities: {},
          });
        if (endpoint === '/entity/guid/col-b')
          return Promise.resolve({
            entity: {
              guid: 'col-b',
              typeName: 'rdbms_column',
              attributes: { data_type: 'int', name: 'age_b' },
            },
            referredEntities: {},
          });
        return Promise.reject(new Error(`unexpected atlas GET ${endpoint}`));
      }) as never);

      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/v1/synthetic.csv`,
        syntheticDataSchemaHash: 'hash-1',
        syntheticDataColumns: ['age_a', 'age_b'],
        syntheticDataVersion: 1,
      });
      (fileStorage.getFile as jest.Mock).mockResolvedValue(
        Readable.from(['age_a,age_b\n1,2\n3,4\n']),
      );

      const result = await service.getProjectedSyntheticData(projectId);

      // one 'age' header only — the last leaf wins, mirroring the schema's
      // object-spread merge, so the CSV always matches the advertised schema
      expect(result.csv).toBe('age\n2\n4\n');
    });

    it('throws 409 with missingColumns when the manifest lacks archetype columns', async () => {
      const { projectId } = mockPublishedTemplateWithLeaves();

      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/v2/synthetic.csv`,
        syntheticDataSchemaHash: 'hash-1',
        syntheticDataColumns: ['sex', 'extra'],
        syntheticDataVersion: 2,
      });

      const err: unknown = await service
        .getProjectedSyntheticData(projectId)
        .catch((e) => e as unknown);
      expect(err).toBeInstanceOf(ConflictException);
      expect((err as ConflictException).getResponse()).toMatchObject({
        statusCode: 409,
        missingColumns: ['age_years'],
      });
      expect(fileStorage.getFile).not.toHaveBeenCalled();
    });

    it('throws 404 when no published archetype exists', async () => {
      atlas.post.mockResolvedValueOnce({
        approximateCount: 0,
        queryType: 'BASIC',
        searchParameters: {},
      } as AtlasSearchBasicHeadlessResponseDto);

      await expect(
        service.getProjectedSyntheticData('proj-empty'),
      ).rejects.toThrow('No published archetypes found for project proj-empty');
    });

    it('throws 404 for legacy attachments without a manifest', async () => {
      const { projectId } = mockPublishedTemplateWithLeaves();

      (prisma.project.findUnique as jest.Mock).mockResolvedValue({
        syntheticDataKey: null,
        syntheticDataSchemaHash: null,
        syntheticDataColumns: null,
        syntheticDataVersion: 0,
      });

      await expect(
        service.getProjectedSyntheticData(projectId),
      ).rejects.toThrow(
        `No synthetic dataset with a manifest is attached to project ${projectId}`,
      );
      expect(fileStorage.getFile).not.toHaveBeenCalled();
    });
  });

  describe('getSyntheticDataPreview', () => {
    it('previews only the projected + renamed archetype columns', async () => {
      const { projectId } = mockPublishedTemplateWithLeaves();

      (prisma.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/v2/synthetic.csv`,
        syntheticDataSchemaHash: 'hash-1',
      });
      (fileStorage.getFile as jest.Mock).mockResolvedValue(
        Readable.from(['age_years,sex,extra\n54,Female,x\n36,Male,y\n']),
      );

      const result = await service.getSyntheticDataPreview(projectId, 20);

      expect(result).toEqual({
        attached: true,
        columns: ['patient_info.age', 'sex'],
        rows: [
          ['54', 'Female'],
          ['36', 'Male'],
        ],
        rowCount: 2,
      });
    });

    it('returns attached:false when there is no published archetype', async () => {
      atlas.post.mockResolvedValueOnce({
        approximateCount: 0,
        queryType: 'BASIC',
        searchParameters: {},
      } as AtlasSearchBasicHeadlessResponseDto);

      const result = await service.getSyntheticDataPreview('proj-empty');

      expect(result).toEqual({
        attached: false,
        columns: [],
        rows: [],
        rowCount: 0,
      });
      expect(fileStorage.getFile).not.toHaveBeenCalled();
    });

    it('returns attached:false when the dataset has no manifest', async () => {
      const { projectId } = mockPublishedTemplateWithLeaves();

      (prisma.project.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        syntheticDataKey: `${projectId}/synthetic.csv`,
        syntheticDataSchemaHash: null,
      });

      const result = await service.getSyntheticDataPreview(projectId);

      expect(result).toEqual({
        attached: false,
        columns: [],
        rows: [],
        rowCount: 0,
      });
      expect(fileStorage.getFile).not.toHaveBeenCalled();
    });
  });

  describe('atlasTypeToJSONType (column data_type -> JSON Schema type)', () => {
    const map = (dt: string): string =>
      (
        service as unknown as { atlasTypeToJSONType(d: string): string }
      ).atlasTypeToJSONType(dt);

    it('maps Atlas-native type names', () => {
      expect(map('string')).toBe('string');
      expect(map('int')).toBe('integer');
      expect(map('integer')).toBe('integer');
      expect(map('double')).toBe('number');
      expect(map('boolean')).toBe('boolean');
      expect(map('array<string>')).toBe('array');
    });

    it('maps native SQL/Postgres type names (regression: text/numeric no longer fall through to object)', () => {
      expect(map('text')).toBe('string');
      expect(map('varchar')).toBe('string');
      expect(map('character varying')).toBe('string');
      expect(map('uuid')).toBe('string');
      expect(map('timestamp')).toBe('string');
      expect(map('numeric')).toBe('number');
      expect(map('decimal')).toBe('number');
      expect(map('real')).toBe('number');
      expect(map('double precision')).toBe('number');
      expect(map('bigint')).toBe('integer');
      expect(map('smallint')).toBe('integer');
      expect(map('bool')).toBe('boolean');
    });

    it('normalises case and strips length/precision qualifiers', () => {
      expect(map('VARCHAR(255)')).toBe('string');
      expect(map('numeric(10,2)')).toBe('number');
      expect(map('Character Varying(64)')).toBe('string');
    });

    it('falls back to object for genuinely unknown types', () => {
      expect(map('geometry')).toBe('object');
      expect(map('')).toBe('object');
    });
  });

  // NODE: methods that implement queue will be tested in atlas.processor.spec.ts
});
