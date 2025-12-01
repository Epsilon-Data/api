/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
  customAlphabet: jest.fn(() => jest.fn(() => 'irqwYwvo6E5n')),
}));

describe('AtlasProcessor', () => {
  let service: AtlasProcessor;
  let atlasService: AtlasService;
  let prismaService: PrismaService;
  let spySeparate: jest.SpyInstance<any, unknown[], unknown>;
  let spyToAtlas: jest.SpyInstance<any, unknown[], unknown>;

  // MOCKS
  // add job mock
  const addJob = {
    id: 'add-archetype-job',
    data: {
      owner: 'test',
      projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
      archetype: {
        projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
        name: 'Test template',
        nodes: [
          {
            id: 'mhvu6ahr',
            data: { label: 'Patient', level: 0 },
            position: { x: 300, y: -5 },
            type: 'root',
          },
          {
            id: 'mhvuei98',
            data: { label: 'Health', level: 1 },
            position: { x: -62, y: 213.859375 },
            type: 'category',
          },
          {
            id: 'mhvuenar',
            data: { label: 'Heart rate', level: 2 },
            position: { x: -226, y: 361.859375 },
            type: 'category',
          },
          {
            id: 'mhvuer7n',
            data: { label: 'Blood pressure', level: 2 },
            position: { x: 73, y: 362.859375 },
            type: 'category',
          },
          {
            id: 'mhvuewou',
            data: { label: 'Demographics', level: 1 },
            position: { x: 325, y: 229.859375 },
            type: 'category',
          },
          {
            id: 'mhvuf2ff',
            data: { label: 'Age', level: 2 },
            position: { x: 321, y: 366.859375 },
            type: 'category',
          },
          {
            id: 'mhvuf6ps',
            data: { label: 'Condition', level: 1 },
            position: { x: 628, y: 228.859375 },
            type: 'category',
          },
          {
            id: 'mhvufchf',
            data: { label: 'Medications', level: 1 },
            position: { x: 1068.9608679668509, y: 230.859375 },
            type: 'category',
          },
          {
            id: 'mhvufnpk',
            data: { label: 'Critical', level: 2 },
            position: { x: 568, y: 364.859375 },
            type: 'category',
          },
          {
            id: 'mhvufva8',
            data: { label: 'Diagnosis', level: 2 },
            position: { x: 825, y: 363.859375 },
            type: 'category',
          },
          {
            id: '4abafb1e-d245-4494-bb21-86540fc8282e',
            data: { label: 'heart_rate', level: 3 },
            position: { x: -226, y: 511.859375 },
            type: 'column',
          },
          {
            id: 'fbefaa4f-c44c-4254-b6a6-baa1d5ee532b',
            data: { label: 'blood_pressure', level: 3 },
            position: { x: 73, y: 512.859375 },
            type: 'column',
          },
          {
            id: '1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
            data: { label: 'age', level: 3 },
            position: { x: 321, y: 516.859375 },
            type: 'column',
          },
          {
            id: '805ff4be-325a-4087-8693-1d5ddecf7dff',
            data: { label: 'critical', level: 3 },
            position: { x: 568, y: 514.859375 },
            type: 'column',
          },
          {
            id: '749b6ce3-d56b-46c4-b512-d11554c958a1',
            data: { label: 'diagnosis', level: 3 },
            position: { x: 825, y: 513.859375 },
            type: 'column',
          },
          {
            id: '1abb2a25-10b4-4b28-a36f-87e4965bd1b7',
            data: { label: 'medications', level: 2 },
            position: { x: 1072.9586939650092, y: 366.86698400644565 },
            type: 'column',
          },
        ],
        edges: [
          {
            id: 'edge_mhvu6ahr_mhvuei98',
            source: 'mhvu6ahr',
            target: 'mhvuei98',
          },
          {
            id: 'edge_mhvuei98_mhvuenar',
            source: 'mhvuei98',
            target: 'mhvuenar',
          },
          {
            id: 'edge_mhvuei98_mhvuer7n',
            source: 'mhvuei98',
            target: 'mhvuer7n',
          },
          {
            id: 'edge_mhvu6ahr_mhvuewou',
            source: 'mhvu6ahr',
            target: 'mhvuewou',
          },
          {
            id: 'edge_mhvuewou_mhvuf2ff',
            source: 'mhvuewou',
            target: 'mhvuf2ff',
          },
          {
            id: 'edge_mhvu6ahr_mhvuf6ps',
            source: 'mhvu6ahr',
            target: 'mhvuf6ps',
          },
          {
            id: 'edge_mhvu6ahr_mhvufchf',
            source: 'mhvu6ahr',
            target: 'mhvufchf',
          },
          {
            id: 'edge_mhvuf6ps_mhvufnpk',
            source: 'mhvuf6ps',
            target: 'mhvufnpk',
          },
          {
            id: 'edge_mhvuf6ps_mhvufva8',
            source: 'mhvuf6ps',
            target: 'mhvufva8',
          },
          {
            id: 'edge_mhvuenar_4abafb1e-d245-4494-bb21-86540fc8282e',
            source: 'mhvuenar',
            target: '4abafb1e-d245-4494-bb21-86540fc8282e',
          },
          {
            id: 'edge_mhvuer7n_fbefaa4f-c44c-4254-b6a6-baa1d5ee532b',
            source: 'mhvuer7n',
            target: 'fbefaa4f-c44c-4254-b6a6-baa1d5ee532b',
          },
          {
            id: 'edge_mhvuf2ff_1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
            source: 'mhvuf2ff',
            target: '1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
          },
          {
            id: 'edge_mhvufnpk_805ff4be-325a-4087-8693-1d5ddecf7dff',
            source: 'mhvufnpk',
            target: '805ff4be-325a-4087-8693-1d5ddecf7dff',
          },
          {
            id: 'edge_mhvufva8_749b6ce3-d56b-46c4-b512-d11554c958a1',
            source: 'mhvufva8',
            target: '749b6ce3-d56b-46c4-b512-d11554c958a1',
          },
          {
            id: 'edge_mhvufchf_1abb2a25-10b4-4b28-a36f-87e4965bd1b7',
            source: 'mhvufchf',
            target: '1abb2a25-10b4-4b28-a36f-87e4965bd1b7',
          },
        ],
        permissions: [
          { id: 'mhvuf6ps', permission: 'DETAILED' },
          { id: 'mhvuei98', permission: 'DETAILED' },
          { id: 'mhvuf2ff', permission: 'HIGH_LEVEL' },
          { id: 'mhvufchf', permission: 'HIGH_LEVEL' },
        ],
        status: 'ACTIVE', // full object, should be active
      } as ArchetypeDto,
    } as ArchetypeJobDataDto,
  } as Job;

  // update job mock
  const updateJob = {
    id: 'update-archetype-job',
    name: 'process-update-archetype',
    data: {
      owner: 'test',
      projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
      archetype: {
        projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
        archetypeId: 'irqwYwvo6E5n',
        name: 'Test template edit',
        nodes: [
          {
            id: 'mhvufva8',
            type: 'category',
            data: { label: 'Diagnosis', level: 2 },
            position: { x: 627, y: 360.85938 },
          },
          {
            id: '749b6ce3-d56b-46c4-b512-d11554c958a1',
            type: 'column',
            data: { label: 'diagnosis', level: 3 },
            position: { x: 825, y: 563.85938 },
          },
          {
            id: 'mhvuf2ff',
            type: 'category',
            data: { label: 'Age', level: 2 },
            position: { x: 321, y: 366.85938 },
          },
          {
            id: '1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
            type: 'column',
            data: { label: 'age', level: 3 },
            position: { x: 321, y: 566.85938 },
          },
          {
            id: 'mhvuenar',
            type: 'category',
            data: { label: 'Heart rate', level: 2 },
            position: { x: -226, y: 361.85938 },
          },
          {
            id: '4abafb1e-d245-4494-bb21-86540fc8282e',
            type: 'column',
            data: { label: 'heart_rate', level: 3 },
            position: { x: -226, y: 561.85938 },
          },
          {
            id: 'mhvuewou',
            type: 'category',
            data: { label: 'Demographics', level: 1 },
            position: { x: 325, y: 229.85938 },
          },
          {
            id: 'mhvuf6ps',
            type: 'category',
            data: { label: 'Condition', level: 1 },
            position: { x: 628, y: 228.85938 },
          },
          {
            id: 'mhvu6ahr',
            type: 'root',
            data: { label: 'Patient', level: 0 },
            position: { x: 300, y: -5 },
          },
          {
            id: 'mhvuei98',
            type: 'category',
            data: { label: 'Health', level: 1 },
            position: { x: -62, y: 213.85938 },
          },
          {
            id: 'mhvv5eju',
            type: 'category',
            data: { label: 'Admission date', level: 1 },
            position: { x: 881.703125, y: 228.789065 },
          },
          {
            id: '9ae6e615-98dc-46ba-a894-688f5fd07201',
            type: 'column',
            data: { label: 'admission_date', level: 2 },
            position: { x: 881.703125, y: 378.789065 },
          },
        ],
        edges: [
          {
            id: 'edge_mhvuf6ps_mhvufva8',
            source: 'mhvuf6ps',
            target: 'mhvufva8',
          },
          {
            id: 'edge_mhvufva8_749b6ce3-d56b-46c4-b512-d11554c958a1',
            source: 'mhvufva8',
            target: '749b6ce3-d56b-46c4-b512-d11554c958a1',
          },
          {
            id: 'edge_mhvuewou_mhvuf2ff',
            source: 'mhvuewou',
            target: 'mhvuf2ff',
          },
          {
            id: 'edge_mhvuf2ff_1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
            source: 'mhvuf2ff',
            target: '1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
          },
          {
            id: 'edge_mhvuei98_mhvuenar',
            source: 'mhvuei98',
            target: 'mhvuenar',
          },
          {
            id: 'edge_mhvuenar_4abafb1e-d245-4494-bb21-86540fc8282e',
            source: 'mhvuenar',
            target: '4abafb1e-d245-4494-bb21-86540fc8282e',
          },
          {
            id: 'edge_mhvu6ahr_mhvuewou',
            source: 'mhvu6ahr',
            target: 'mhvuewou',
          },
          {
            id: 'edge_mhvu6ahr_mhvuf6ps',
            source: 'mhvu6ahr',
            target: 'mhvuf6ps',
          },
          {
            id: 'edge_mhvu6ahr_mhvuei98',
            source: 'mhvu6ahr',
            target: 'mhvuei98',
          },
          {
            id: 'edge_mhvu6ahr_mhvv5eju',
            source: 'mhvu6ahr',
            target: 'mhvv5eju',
          },
          {
            id: 'edge_mhvv5eju_9ae6e615-98dc-46ba-a894-688f5fd07201',
            source: 'mhvv5eju',
            target: '9ae6e615-98dc-46ba-a894-688f5fd07201',
          },
        ],
        status: 'PUBLISHED',
        permissions: [
          { id: 'mhvuf6ps', permission: 'DETAILED' },
          { id: 'mhvuei98', permission: 'DETAILED' },
          { id: 'mhvufnpk', permission: 'DETAILED' },
          { id: 'mhvuer7n', permission: 'DETAILED' },
          { id: 'mhvuf2ff', permission: 'DETAILED' },
          { id: 'mhvufchf', permission: 'HIGH_LEVEL' },
          { id: 'mhvv5eju', permission: 'HIGH_LEVEL' },
        ],
      } as ArchetypeDto,
    } as ArchetypeJobDataDto,
  } as unknown as Job;

  // update job mock no nodes, edges or permissions mock
  const updateJobNoNodes = {
    id: 'update-archetype-job',
    name: 'process-update-archetype',
    data: {
      owner: 'test',
      projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
      archetype: {
        projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
        archetypeId: 'irqwYwvo6E5n',
        name: 'Test template edit no nodes',
        status: 'DRAFT', // not full object should be Draft (missing nodes, edges and permissions)
      } as ArchetypeDto,
    } as ArchetypeJobDataDto,
  } as unknown as Job;

  // existing archetype result mock
  const archetypeTemplateResult = {
    referredEntities: {
      '8cde5346-4ee8-481d-a927-34b5bc29386b': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufva8',
          name: 'Diagnosis',
        },
        guid: '8cde5346-4ee8-481d-a927-34b5bc29386b',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'leaf_node',
            entityGuid: '8cde5346-4ee8-481d-a927-34b5bc29386b',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'DETAILED' },
            entityGuid: '92c027a8-4630-4baa-b054-5e1b0d822356',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      '26ab17ff-e78a-4f8d-8ad5-f0cd06750853': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuer7n',
          name: 'Blood pressure',
        },
        guid: '26ab17ff-e78a-4f8d-8ad5-f0cd06750853',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'DETAILED' },
            entityGuid: '109cbab0-ae95-4843-bfc2-84a02db7dee7',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'leaf_node',
            entityGuid: '26ab17ff-e78a-4f8d-8ad5-f0cd06750853',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      '86131e90-738a-4f3f-a203-8e266a08e2b8': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf2ff',
          name: 'Age',
        },
        guid: '86131e90-738a-4f3f-a203-8e266a08e2b8',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'leaf_node',
            entityGuid: '86131e90-738a-4f3f-a203-8e266a08e2b8',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'HIGH_LEVEL' },
            entityGuid: '86131e90-738a-4f3f-a203-8e266a08e2b8',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      '21d80975-c06c-4cca-ae20-8647e30dd296': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuenar',
          name: 'Heart rate',
        },
        guid: '21d80975-c06c-4cca-ae20-8647e30dd296',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'DETAILED' },
            entityGuid: '109cbab0-ae95-4843-bfc2-84a02db7dee7',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'leaf_node',
            entityGuid: '21d80975-c06c-4cca-ae20-8647e30dd296',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      'ed9fc6f6-9753-462e-b059-96b3c9c1aad5': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuewou',
          name: 'Demographics',
        },
        guid: 'ed9fc6f6-9753-462e-b059-96b3c9c1aad5',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'branch_node',
            entityGuid: 'ed9fc6f6-9753-462e-b059-96b3c9c1aad5',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      '92c027a8-4630-4baa-b054-5e1b0d822356': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf6ps',
          name: 'Condition',
        },
        guid: '92c027a8-4630-4baa-b054-5e1b0d822356',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'branch_node',
            entityGuid: '92c027a8-4630-4baa-b054-5e1b0d822356',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'DETAILED' },
            entityGuid: '92c027a8-4630-4baa-b054-5e1b0d822356',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      'f45fc893-28a1-46b0-8503-a75a1cbefa6f': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
          name: 'Patient',
        },
        guid: 'f45fc893-28a1-46b0-8503-a75a1cbefa6f',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'root_node',
            entityGuid: 'f45fc893-28a1-46b0-8503-a75a1cbefa6f',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      '109cbab0-ae95-4843-bfc2-84a02db7dee7': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuei98',
          name: 'Health',
        },
        guid: '109cbab0-ae95-4843-bfc2-84a02db7dee7',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'DETAILED' },
            entityGuid: '109cbab0-ae95-4843-bfc2-84a02db7dee7',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'branch_node',
            entityGuid: '109cbab0-ae95-4843-bfc2-84a02db7dee7',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      'c103fb23-9aa8-4699-9491-4c2b69f0bd0b': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufnpk',
          name: 'Critical',
        },
        guid: 'c103fb23-9aa8-4699-9491-4c2b69f0bd0b',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'DETAILED' },
            entityGuid: '92c027a8-4630-4baa-b054-5e1b0d822356',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'leaf_node',
            entityGuid: 'c103fb23-9aa8-4699-9491-4c2b69f0bd0b',
            entityStatus: 'ACTIVE',
          },
        ],
      },
      'eb734494-b172-4069-9d37-96290b7a0691': {
        typeName: 'archetype_node',
        attributes: {
          owner: 'test',
          qualifiedName:
            'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufchf',
          name: 'Medications',
        },
        guid: 'eb734494-b172-4069-9d37-96290b7a0691',
        status: 'ACTIVE',
        classifications: [
          {
            typeName: 'leaf_node',
            entityGuid: 'eb734494-b172-4069-9d37-96290b7a0691',
            entityStatus: 'ACTIVE',
          },
          {
            typeName: 'archetype_node_analysis_permissions',
            attributes: { access_level: 'HIGH_LEVEL' },
            entityGuid: 'eb734494-b172-4069-9d37-96290b7a0691',
            entityStatus: 'ACTIVE',
          },
        ],
      },
    },
    entity: {
      typeName: 'archetype_template',
      attributes: {
        owner: 'test',
        qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
        name: 'Test template',
        projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
        status: 'DRAFT',
      },
      guid: '2fdf1a12-9a94-4251-ad5a-64fceba99b57',
    },
  };

  // update template edit nodes mock
  const templateNodeEntities = [
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Patient',
        name: 'Patient',
        level: 0,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
        position: { x: 300, y: -5 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
      },
    },
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Health',
        name: 'Health',
        level: 1,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuei98',
        position: { x: -62, y: 213.85938 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
          },
        },
      },
    },
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Heart rate',
        name: 'Heart rate',
        level: 2,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuenar',
        position: { x: -226, y: 361.85938 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuei98',
          },
        },
        column: {
          guid: '4abafb1e-d245-4494-bb21-86540fc8282e',
          typeName: 'rdbms_column',
        },
      },
    },
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Demographics',
        name: 'Demographics',
        level: 1,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuewou',
        position: { x: 325, y: 229.85938 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
          },
        },
      },
    },
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Age',
        name: 'Age',
        level: 2,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf2ff',
        position: { x: 321, y: 366.85938 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuewou',
          },
        },
        column: {
          guid: '1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
          typeName: 'rdbms_column',
        },
      },
    },
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Condition',
        name: 'Condition',
        level: 1,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf6ps',
        position: { x: 628, y: 228.85938 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
          },
        },
      },
    },
    {
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Diagnosis',
        name: 'Diagnosis',
        level: 2,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufva8',
        position: { x: 627, y: 360.85938 },
      },
      relationshipAttributes: {
        template: {
          typeName: 'archetype_template',
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf6ps',
          },
        },
        column: {
          guid: '749b6ce3-d56b-46c4-b512-d11554c958a1',
          typeName: 'rdbms_column',
        },
      },
    },
    {
      guid: '-9',
      typeName: 'archetype_node',
      status: 'ACTIVE',
      attributes: {
        label: 'Admission date',
        name: 'Admission date',
        owner: 'test',
        level: 1,
        qualifiedName:
          'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvv5eju',
        position: { x: 881.703125, y: 228.789065 },
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
          uniqueAttributes: {
            qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
          },
        },
        parent_node: {
          typeName: 'archetype_node',
          uniqueAttributes: {
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
          },
        },
        column: {
          guid: '9ae6e615-98dc-46ba-a894-688f5fd07201',
          typeName: 'rdbms_column',
        },
      },
    },
  ];

  // update edit (add, remove) nodes post entities mock
  const postUpdateEntities = [
    {
      typeName: 'archetype_template',
      attributes: {
        name: 'Test template edit',
        projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
        qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
        status: 'PUBLISHED',
      },
      relationshipAttributes: {
        instance: {
          typeName: 'rdbms_instance',
          uniqueAttributes: {
            projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
          },
        },
        nodes: [
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufva8',
            },
          },
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf2ff',
            },
          },
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuenar',
            },
          },
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuewou',
            },
          },
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf6ps',
            },
          },
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
            },
          },
          {
            typeName: 'archetype_node',
            uniqueAttributes: {
              qualifiedName:
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuei98',
            },
          },
          { guid: '-9', typeName: 'archetype_node' },
        ],
      },
    },
    ...templateNodeEntities,
  ];

  // update edit no nodes post entities mock
  const postNoNodesEntities = [
    {
      typeName: 'archetype_template',
      attributes: {
        name: 'Test template edit no nodes',
        projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
        qualifiedName: 'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
        status: 'DRAFT',
      },
      relationshipAttributes: {
        instance: {
          typeName: 'rdbms_instance',
          uniqueAttributes: {
            projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
          },
        },
        nodes: [],
      },
    },
  ];

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
            get: jest.fn(),
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
    // dockerService = module.get<DockerService>(DockerService);
    atlasService = module.get<AtlasService>(AtlasService);
    prismaService = module.get<PrismaService>(PrismaService);

    // Spies for methods
    spySeparate = jest.spyOn(service as any, 'separateColumnsNodes');
    spyToAtlas = jest.spyOn(service as any, 'archetypeTemplateToAtlasEntities');

    jest.clearAllMocks();
  });

  describe('handleAddArchetypeJob', () => {
    it('should handle new archetype creation', async () => {
      const postEntities = [
        {
          guid: '-2',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Patient',
            name: 'Patient',
            owner: 'test',
            level: 0,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvu6ahr',
            position: { x: 300, y: -5 },
          },
          classifications: [{ typeName: 'root_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'template_guid_123',
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
            owner: 'test',
            level: 1,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuei98',
            position: { x: -62, y: 213.859375 },
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
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
          },
        },
        {
          guid: '-4',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Heart rate',
            name: 'Heart rate',
            owner: 'test',
            level: 2,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuenar',
            position: { x: -226, y: 361.859375 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-3' },
            column: {
              guid: '4abafb1e-d245-4494-bb21-86540fc8282e',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-5',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Blood pressure',
            name: 'Blood pressure',
            owner: 'test',
            level: 2,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuer7n',
            position: { x: 73, y: 362.859375 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-3' },
            column: {
              guid: 'fbefaa4f-c44c-4254-b6a6-baa1d5ee532b',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-6',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Demographics',
            name: 'Demographics',
            owner: 'test',
            level: 1,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuewou',
            position: { x: 325, y: 229.859375 },
          },
          classifications: [{ typeName: 'branch_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
          },
        },
        {
          guid: '-7',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Age',
            name: 'Age',
            owner: 'test',
            level: 2,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf2ff',
            position: { x: 321, y: 366.859375 },
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
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-6' },
            column: {
              guid: '1d2c3b6c-e000-4e6f-a80c-b8be714e81cb',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-8',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Condition',
            name: 'Condition',
            owner: 'test',
            level: 1,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvuf6ps',
            position: { x: 628, y: 228.859375 },
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
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
          },
        },
        {
          guid: '-9',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Medications',
            name: 'Medications',
            owner: 'test',
            level: 1,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufchf',
            position: { x: 1068.9608679668509, y: 230.859375 },
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
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-2' },
            column: {
              guid: '1abb2a25-10b4-4b28-a36f-87e4965bd1b7',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-10',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Critical',
            name: 'Critical',
            owner: 'test',
            level: 2,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufnpk',
            position: { x: 568, y: 364.859375 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-8' },
            column: {
              guid: '805ff4be-325a-4087-8693-1d5ddecf7dff',
              typeName: 'rdbms_column',
            },
          },
        },
        {
          guid: '-11',
          typeName: 'archetype_node',
          status: 'ACTIVE',
          attributes: {
            label: 'Diagnosis',
            name: 'Diagnosis',
            owner: 'test',
            level: 2,
            qualifiedName:
              'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n@mhvufva8',
            position: { x: 825, y: 363.859375 },
          },
          classifications: [{ typeName: 'leaf_node', propagate: false }],
          relationshipAttributes: {
            template: {
              typeName: 'archetype_template',
              guid: 'template_guid_123',
            },
            parent_node: { typeName: 'archetype_node', guid: '-8' },
            column: {
              guid: '749b6ce3-d56b-46c4-b512-d11554c958a1',
              typeName: 'rdbms_column',
            },
          },
        },
      ];

      (atlasService.post as jest.Mock)
        .mockResolvedValueOnce({ guidAssignments: { t1: 'template_guid_123' } }) // for /entity
        .mockResolvedValueOnce({ success: true }); // for /entity/bulk

      // prisma update
      (prismaService.project.update as jest.Mock).mockResolvedValueOnce({});

      const result = await service.handleAddArchetypeJob(addJob);

      expect(atlasService.post).toHaveBeenCalledTimes(2);

      // verify archetypeId generated
      expect(result).toBe('irqwYwvo6E5n');

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
      expect(atlasEntitiesResult.guidAssignments).toEqual([]);

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
                'e638b66b-c509-44fe-b754-5b7c63a4879f@irqwYwvo6E5n',
            }),
          }),
        }),
      );

      expect(prismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f' },
        }),
      );
    });
    it('should process update archetype as archetypeId present', async () => {
      // for /entity/uniqueAttribute/type/archetype_template`
      (atlasService.get as jest.Mock).mockResolvedValueOnce(
        archetypeTemplateResult,
      );
      // for /entity/bulk
      (atlasService.post as jest.Mock).mockResolvedValueOnce({ success: true });

      await service.handleAddArchetypeJob(updateJob);

      // Inspect actual return from helper
      const atlasEntitiesResult = spyToAtlas.mock.results[0].value as Record<
        string,
        unknown
      >;

      expect(atlasEntitiesResult.guidAssignments).toEqual(['-9']);

      expect(atlasService.post).toHaveBeenCalledTimes(1);

      // update permissions classifications
      expect(atlasService.put).toHaveBeenCalledTimes(3);

      expect(atlasService.get).toHaveBeenCalledWith(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${updateJob.data.projectId}@${updateJob.data.archetype.archetypeId}`,
          ignoreRelationships: false,
          minExtInfo: true,
        },
      );
    });
  });

  describe('handleUpdateArchetypeJob', () => {
    it('should process update archetype job', async () => {
      // for /entity/uniqueAttribute/type/archetype_template`
      (atlasService.get as jest.Mock).mockResolvedValueOnce(
        archetypeTemplateResult,
      );
      // for /entity/bulk
      (atlasService.post as jest.Mock).mockResolvedValueOnce({ success: true });

      // prisma update
      (prismaService.project.update as jest.Mock).mockResolvedValueOnce({});

      const result = await service.handleUpdateArchetypeJob(updateJob);

      // verify archetypeId generated
      expect(result).toBe(updateJob.data.archetype.archetypeId);

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

      expect(atlasEntitiesResult.entities).toEqual(templateNodeEntities);
      expect(atlasEntitiesResult.guidAssignments).toEqual(['-9']);

      // Verify that the /entity/bulk call used those real entities
      expect(atlasService.post).toHaveBeenCalledWith('/entity/bulk', {
        entities: postUpdateEntities,
      });

      expect(atlasService.get).toHaveBeenCalledWith(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${updateJob.data.projectId}@${updateJob.data.archetype.archetypeId}`,
          ignoreRelationships: false,
          minExtInfo: true,
        },
      );

      expect(prismaService.project.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: updateJob.data.projectId },
        }),
      );
    });
    it('should process update archetype template info, but not nodes', async () => {
      // for /entity/uniqueAttribute/type/archetype_template`
      (atlasService.get as jest.Mock).mockResolvedValueOnce(
        archetypeTemplateResult,
      );
      // for /entity/bulk
      (atlasService.post as jest.Mock).mockResolvedValueOnce({ success: true });

      await service.handleUpdateArchetypeJob(updateJobNoNodes);

      expect(atlasService.get).toHaveBeenCalledWith(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${updateJob.data.projectId}@${updateJob.data.archetype.archetypeId}`,
          ignoreRelationships: false,
          minExtInfo: true,
        },
      );

      // Verify that the /entity/bulk call used those real entities
      expect(atlasService.post).toHaveBeenCalledWith('/entity/bulk', {
        entities: postNoNodesEntities,
      });
    });
  });

  describe('handleDeleteArchetypeJob', () => {
    it('should process delete archetype job', async () => {
      const job = {
        id: 'delete-archetype-job',
        data: {
          projectId: 'e638b66b-c509-44fe-b754-5b7c63a4879f',
          archetypeId: 'irqwYwvo6E5n',
        },
      } as unknown as Job;

      // for /entity/uniqueAttribute/type/archetype_template`
      (atlasService.delete as jest.Mock).mockResolvedValueOnce({
        deleted: true,
      });

      await service.handleDeleteArchetypeJob(job);

      expect(atlasService.delete).toHaveBeenCalledWith(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': `${job.data.projectId}@${job.data.archetypeId}`,
        },
      );
    });
  });
});
