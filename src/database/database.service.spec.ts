import { Test, TestingModule } from '@nestjs/testing';
import { DatabaseService } from './database.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { AtlasQueryType } from 'src/atlas/dto';

describe('DatabaseService', () => {
  let moduleRef: TestingModule;
  let service: DatabaseService;
  //   let prismaService: jest.Mocked<PrismaService>;
  let atlasService: jest.Mocked<AtlasService>;

  const projectId = '638c6f81-00c8-47f4-82ec-6b94240e757d';
  const schemaName = 'public';

  // mocks
  const getTablesResponse = {
    queryType: AtlasQueryType.DSL,
    queryText: '',
    entities: [
      {
        typeName: 'rdbms_table',
        guid: 'table1_guid',
        attributes: {
          qualifiedName: `${projectId}@${schemaName}.table_a`,
          name: `${schemaName}.table_a`,
          description: 'table description details',
        },
        status: 'ACTIVE',
        displayText: `${schemaName}.table_a`,
      },
      {
        typeName: 'rdbms_table',
        guid: 'table2_guid',
        attributes: {
          qualifiedName: `${projectId}@${schemaName}.table_b`,
          name: `${schemaName}.table_b`,
          description: 'table description details',
        },
        status: 'ACTIVE',
        displayText: `${schemaName}.table_b`,
      },
    ],
  };
  const getInstanceInfoResponse = {
    referredEntities: {},
    entity: {
      typeName: 'rdbms_instance',
      guid: 'instance_guid',
      status: 'ACTIVE',
      attributes: {
        projectId: projectId,
        erd: 'erDiagram\n\n\n"public.table_a" {\n  varchar blood_pressure\n  integer heart_rate\n  time_with_time_zone date\n  boolean stable\n  integer patient_id\n}\n"public.table_b" {\n  integer patient_id\n  integer age\n  varchar__ medications\n  time_with_time_zone admission_date\n  varchar diagnosis\n  boolean critical\n}\n',
      },
      relationshipAttributes: {
        databases: [
          {
            guid: 'database_guid',
            typeName: 'rdbms_db',
            entityStatus: 'ACTIVE',
            displayText: schemaName,
            qualifiedName: `${projectId}@${schemaName}`,
          },
        ],
      },
    },
  };
  // per-table details
  const tableDetail = (name: string) => ({
    entity: {
      guid: 'x',
      typeName: 'rdbms_table',
      attributes: { name: `${schemaName}.${name}` },
      relationshipAttributes: {
        db: { displayText: schemaName },
        foreign_keys: [{ typeName: 'rdbms_foreign_key' }],
      },
    },
    referredEntities: {
      c1: {
        guid: 'c1',
        status: 'ACTIVE',
        typeName: 'rdbms_column',
        attributes: {
          name: 'id',
          data_type: 'int',
          isNullable: false,
          isPrimaryKey: true,
        },
      },
      c2: {
        guid: 'c2',
        status: 'ACTIVE',
        typeName: 'rdbms_column',
        attributes: {
          name: 'name',
          data_type: 'text',
          isNullable: true,
          isPrimaryKey: false,
        },
      },
    },
  });

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: PrismaService,
          useValue: {
            project: { update: jest.fn() },
          },
        },
        {
          provide: AtlasService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(DatabaseService);
    // prismaService = moduleRef.get(PrismaService);
    atlasService = moduleRef.get(AtlasService);

    jest.clearAllMocks();
  });

  describe('summary', () => {
    it('returns database summary', async () => {
      //  mock Atlas responses

      const getColumnsBulkResponse = {
        referredEntities: {
          column1_guid: {
            typeName: 'rdbms_column',
            attributes: {},
            guid: 'column1_guid',
            status: 'ACTIVE',
          },
          column2_guid: {
            typeName: 'rdbms_column',
            attributes: {},
            guid: 'column2_guid',
            status: 'ACTIVE',
          },
          column3_guid: {
            typeName: 'rdbms_column',
            attributes: {},
            guid: 'column3_guid',
            status: 'ACTIVE',
          },
          fk_guid: {
            typeName: 'rdbms_foreign_key',
            attributes: {},
            guid: 'fk_guid',
            isIncomplete: false,
            status: 'ACTIVE',
          },
          deleted_column_guid: {
            typeName: 'rdbms_column',
            attributes: {},
            guid: 'deleted_column_guid',
            isIncomplete: false,
            status: 'DELETED',
          },
        },
        entities: [],
      };

      (atlasService.get as jest.Mock)
        .mockResolvedValueOnce(getInstanceInfoResponse)
        .mockResolvedValueOnce(getTablesResponse)
        .mockResolvedValueOnce(getColumnsBulkResponse);

      const result = await service.summary(projectId, 'token');

      expect(result).toEqual({
        overall: {
          schemaCount: 1,
          totalColCount: 3,
          totalTableCount: 2,
        },
        diagram:
          'erDiagram\n\n\n"public.table_a" {\n  varchar blood_pressure\n  integer heart_rate\n  time_with_time_zone date\n  boolean stable\n  integer patient_id\n}\n"public.table_b" {\n  integer patient_id\n  integer age\n  varchar__ medications\n  time_with_time_zone admission_date\n  varchar diagnosis\n  boolean critical\n}\n',
      });
    });
  });

  describe('tables', () => {
    it('returns an array with database tables details', async () => {
      // run getTables
      atlasService.get.mockResolvedValueOnce(getTablesResponse);

      // mock two table queries
      atlasService.get
        .mockResolvedValueOnce(tableDetail('table_a'))
        .mockResolvedValueOnce(tableDetail('table_b'));

      const result = await service.tables(projectId, 'token');

      expect(result).toEqual([
        {
          name: `${schemaName}.table_a`,
          colCount: 2,
          schema: schemaName,
          columns: [
            {
              name: 'id',
              type: 'int',
              nullable: false,
              primary: true,
            },
            {
              name: 'name',
              type: 'text',
              nullable: true,
              primary: false,
            },
          ],
        },
        {
          name: `${schemaName}.table_b`,
          colCount: 2,
          schema: schemaName,
          columns: [
            {
              name: 'id',
              type: 'int',
              nullable: false,
              primary: true,
            },
            {
              name: 'name',
              type: 'text',
              nullable: true,
              primary: false,
            },
          ],
        },
      ]);
    });
  });

  describe('columns', () => {
    it('returns an array with database columns details', async () => {
      // run getTables
      atlasService.get.mockResolvedValueOnce(getTablesResponse);

      // two table queries
      atlasService.get
        .mockResolvedValueOnce(tableDetail('table_a'))
        .mockResolvedValueOnce(tableDetail('table_b'));

      const result = await service.columns(projectId, 'token');

      expect(result).toEqual([
        {
          id: 'c1',
          name: 'id',
          table: `${schemaName}.table_a`,
        },
        {
          id: 'c2',
          name: 'name',
          table: `${schemaName}.table_a`,
        },
        {
          id: 'c1',
          name: 'id',
          table: `${schemaName}.table_b`,
        },
        {
          id: 'c2',
          name: 'name',
          table: `${schemaName}.table_b`,
        },
      ]);
    });
  });
});
